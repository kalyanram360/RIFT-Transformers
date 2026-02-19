const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log to both console and file
 */
const logToFile = (message, logFile) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    fs.appendFileSync(logFile, logMessage, "utf8");
  } catch (err) {
    console.error("Failed to write to log file:", err.message);
  }
};

const sanitize = (input) => {
  if (typeof input !== "string") throw new Error("Invalid input type");
  if (!/^[a-zA-Z0-9_\-./:\[\] ]+$/.test(input))
    throw new Error(`Unsafe input detected: ${input}`);
  return input.trim();
};

/**
 * STEP 1 — Get directory structure from the container
 */
const getDirectoryStructure = async (containerName, workDir) => {
  try {
    const { stdout } = await execPromise(
      `docker exec ${containerName} find ${workDir} -maxdepth 4 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" -not -path "*/dist/*"`,
      { timeout: 30000 },
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch (error) {
    throw new Error(`Failed to fetch directory structure: ${error.message}`);
  }
};

/**
 * STEP 2 — Ask Claude which file contains test config
 */
const askApiWhereTestConfigIs = async (fileList) => {
  try {
    const prompt = `You are a build system expert. Given this list of files from a repository, identify which single file most likely contains the test command configuration (e.g. package.json for Node.js, pyproject.toml or setup.cfg or Makefile for Python, etc.).

File list:
${fileList.slice(0, 100).join("\n")}

Reply with ONLY the full file path. Nothing else. No explanation.`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();

    return text.trim();
  } catch (error) {
    throw new Error(
      `Gemini API error (config file detection): ${error.message}`,
    );
  }
};

/**
 * STEP 3 — Read the config file content from the container
 */
const readFileFromContainer = async (containerName, filePath) => {
  try {
    const safeFilePath = sanitize(filePath);
    const { stdout } = await execPromise(
      `docker exec ${containerName} cat ${safeFilePath}`,
      { timeout: 10000 },
    );
    return stdout;
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
};

/**
 * STEP 4 — Ask Claude what the test command is
 */
const askApiForTestCommand = async (filePath, fileContent) => {
  try {
    const prompt = `You are a build system expert. Given the content of "${filePath}", extract the exact shell command to run the test suite.

File content:
\`\`\`
${fileContent.substring(0, 3000)}
\`\`\`

Rules:
- For package.json: return something like "npm test" or "npm run test" or whatever the "test" script is.
- For pyproject.toml / setup.cfg: return the pytest or unittest command.
- For Makefile: return "make test" or the appropriate target.
- If no test command is found, return "NO_TEST_COMMAND_FOUND".

Reply with ONLY the shell command. No explanation, no markdown, no quotes.`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();

    return text.trim();
  } catch (error) {
    throw new Error(
      `Gemini API error (test command extraction): ${error.message}`,
    );
  }
};

/**
 * STEP 5 — Run the test command inside the Docker container
 */
const runTestCommandInContainer = async (
  containerName,
  workDir,
  testCommand,
  logFile,
) => {
  try {
    logToFile(`\n${"=".repeat(70)}`, logFile);
    logToFile(`Starting test execution...`, logFile);
    logToFile(`Container: ${containerName}`, logFile);
    logToFile(`Working Directory: ${workDir}`, logFile);
    logToFile(`Test Command: ${testCommand}`, logFile);
    logToFile(`${"=".repeat(70)}\n`, logFile);

    // For Node.js projects, ensure dependencies are installed first
    try {
      logToFile(`[SETUP] Installing Node dependencies...`, logFile);
      const { stdout: npmOutput } = await execPromise(
        `docker exec -w ${workDir} ${containerName} sh -c "[ -f package.json ] && npm install 2>&1 || true"`,
        { timeout: 120000 },
      );
      if (npmOutput) {
        logToFile(`[NPM] ${npmOutput}`, logFile);
      }
    } catch (e) {
      logToFile(
        `[SETUP] npm install skipped or failed (non-fatal): ${e.message}`,
        logFile,
      );
    }

    // For Python projects, try installing dependencies
    try {
      logToFile(`[SETUP] Installing Python dependencies...`, logFile);
      const { stdout: pipOutput } = await execPromise(
        `docker exec -w ${workDir} ${containerName} sh -c "[ -f requirements.txt ] && pip install -r requirements.txt 2>&1 || true"`,
        { timeout: 120000 },
      );
      if (pipOutput) {
        logToFile(`[PIP] ${pipOutput}`, logFile);
      }
    } catch (e) {
      logToFile(
        `[SETUP] pip install skipped or failed (non-fatal): ${e.message}`,
        logFile,
      );
    }

    // Run the actual test command
    let testResult = { stdout: "", stderr: "", exitCode: 0 };
    try {
      logToFile(`\n[TEST] Running: ${testCommand}`, logFile);
      logToFile(`${"─".repeat(70)}`, logFile);

      const { stdout, stderr } = await execPromise(
        `docker exec -w ${workDir} ${containerName} sh -c ${JSON.stringify(testCommand)}`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, // 5 min timeout, 10MB buffer for tests
      );

      logToFile(`[STDOUT]\n${stdout}`, logFile);
      if (stderr) {
        logToFile(`[STDERR]\n${stderr}`, logFile);
      }
      logToFile(`[EXIT CODE] 0 (Success)`, logFile);

      testResult = { stdout, stderr, exitCode: 0 };
    } catch (error) {
      // Tests ran but failed (non-zero exit)
      const stdout = error.stdout || "";
      const stderr = error.stderr || "";
      const exitCode = error.code || 1;

      if (stdout) {
        logToFile(`[STDOUT]\n${stdout}`, logFile);
      }
      if (stderr) {
        logToFile(`[STDERR]\n${stderr}`, logFile);
      }
      logToFile(`[EXIT CODE] ${exitCode} (Failure)`, logFile);

      testResult = { stdout, stderr, exitCode };
    }

    logToFile(`${"─".repeat(70)}\n`, logFile);
    return testResult;
  } catch (error) {
    logToFile(`[ERROR] Failed to run test command: ${error.message}`, logFile);
    throw new Error(`Failed to run test command: ${error.message}`);
  }
};

/**
 * MAIN CONTROLLER — Orchestrates all steps
 * POST /sandbox/:containerName/run-tests
 * Body: { workDir }
 */
const runTestsInSandbox = async (req, res) => {
  const executionLog = [];
  const steps = {
    directoryFetch: false,
    configFileDetected: null,
    configFileRead: false,
    testCommandDetected: null,
    testsRun: false,
    totalDuration: 0,
  };

  const startTime = Date.now();
  const { containerName } = req.params;
  const { workDir } = req.body;

  // Create a unique log file for this test run
  const logFileName = `test-${containerName}-${Date.now()}.log`;
  const logFile = path.join(logsDir, logFileName);

  try {
    if (!containerName || !workDir) {
      return res.status(400).json({
        message: "containerName and workDir are required",
        example: {
          containerName: "sandbox-repo-123",
          workDir: "/workspace/repo",
        },
      });
    }

    sanitize(containerName);
    sanitize(workDir);

    logToFile(`\n${"=".repeat(80)}`, logFile);
    logToFile(`TEST RUN STARTED - ${new Date().toISOString()}`, logFile);
    logToFile(`Container: ${containerName} | WorkDir: ${workDir}`, logFile);
    logToFile(`${"=".repeat(80)}\n`, logFile);

    // ── STEP 1: Get directory structure ──────────────────────────────
    const step1Start = Date.now();
    console.log("[TEST-RUNNER] STEP 1: Fetching directory structure...");
    logToFile("[STEP 1] Fetching directory structure...", logFile);
    executionLog.push({
      timestamp: new Date(),
      step: 1,
      action: "Fetching directory structure",
      container: containerName,
      workDir: workDir,
    });

    const fileList = await getDirectoryStructure(containerName, workDir);
    steps.directoryFetch = true;
    const step1Duration = Date.now() - step1Start;

    console.log(
      `[TEST-RUNNER]         Found ${fileList.length} files (${step1Duration}ms)`,
    );
    logToFile(
      `[STEP 1] ✓ Found ${fileList.length} files (${step1Duration}ms)`,
      logFile,
    );
    executionLog.push({
      timestamp: new Date(),
      step: 1,
      status: "completed",
      filesFound: fileList.length,
      duration: step1Duration,
    });

    // ── STEP 2: Ask API which file has test config ────────────────────
    const step2Start = Date.now();
    console.log(
      "[TEST-RUNNER] STEP 2: Asking Claude to identify test config file...",
    );
    logToFile(
      "[STEP 2] Asking Claude to identify test config file...",
      logFile,
    );
    executionLog.push({
      timestamp: new Date(),
      step: 2,
      action: "Identifying test config file via Claude",
    });

    const configFilePath = await askApiWhereTestConfigIs(fileList);
    steps.configFileDetected = configFilePath;
    const step2Duration = Date.now() - step2Start;

    console.log(
      `[TEST-RUNNER]         Config file: ${configFilePath} (${step2Duration}ms)`,
    );
    logToFile(
      `[STEP 2] ✓ Config file: ${configFilePath} (${step2Duration}ms)`,
      logFile,
    );
    executionLog.push({
      timestamp: new Date(),
      step: 2,
      status: "completed",
      configFile: configFilePath,
      duration: step2Duration,
    });

    if (!configFilePath || configFilePath.includes("NONE")) {
      logToFile(
        `[ERROR] Could not identify a test configuration file`,
        logFile,
      );
      return res.status(422).json({
        message: "Could not identify a test configuration file",
        steps,
        executionLog,
        fileList: fileList.slice(0, 50), // Return first 50 files
        logFile: logFileName,
      });
    }

    // ── STEP 3: Read config file from container ───────────────────────
    const step3Start = Date.now();
    console.log("[TEST-RUNNER] STEP 3: Reading config file from container...");
    logToFile(`[STEP 3] Reading config file: ${configFilePath}`, logFile);
    executionLog.push({
      timestamp: new Date(),
      step: 3,
      action: `Reading ${configFilePath}`,
    });

    const fileContent = await readFileFromContainer(
      containerName,
      configFilePath,
    );
    steps.configFileRead = true;
    const step3Duration = Date.now() - step3Start;

    console.log(
      `[TEST-RUNNER]         Read ${fileContent.length} bytes (${step3Duration}ms)`,
    );
    logToFile(
      `[STEP 3] ✓ Read ${fileContent.length} bytes (${step3Duration}ms)`,
      logFile,
    );
    executionLog.push({
      timestamp: new Date(),
      step: 3,
      status: "completed",
      fileSize: fileContent.length,
      duration: step3Duration,
    });

    // ── STEP 4: Ask API for the test command ──────────────────────────
    const step4Start = Date.now();
    console.log(
      "[TEST-RUNNER] STEP 4: Asking Claude to extract test command...",
    );
    logToFile("[STEP 4] Asking Claude to extract test command...", logFile);
    executionLog.push({
      timestamp: new Date(),
      step: 4,
      action: "Extracting test command via Claude",
    });

    const testCommand = await askApiForTestCommand(configFilePath, fileContent);
    steps.testCommandDetected = testCommand;
    const step4Duration = Date.now() - step4Start;

    console.log(
      `[TEST-RUNNER]         Test command: ${testCommand} (${step4Duration}ms)`,
    );
    logToFile(
      `[STEP 4] ✓ Test command: ${testCommand} (${step4Duration}ms)`,
      logFile,
    );
    executionLog.push({
      timestamp: new Date(),
      step: 4,
      status: "completed",
      testCommand: testCommand,
      duration: step4Duration,
    });

    if (!testCommand || testCommand === "NO_TEST_COMMAND_FOUND") {
      logToFile(`[ERROR] No test command found in the config file`, logFile);
      return res.status(422).json({
        message: "No test command found in the config file",
        steps,
        executionLog,
        configFilePath,
        configFilePreview: fileContent.substring(0, 500),
        logFile: logFileName,
      });
    }

    // ── STEP 5: Run tests inside the container ────────────────────────
    const step5Start = Date.now();
    console.log("[TEST-RUNNER] STEP 5: Running tests in container...");
    logToFile("\n[STEP 5] Running tests in container...", logFile);
    executionLog.push({
      timestamp: new Date(),
      step: 5,
      action: `Executing: ${testCommand}`,
      workDir: workDir,
    });

    const testOutput = await runTestCommandInContainer(
      containerName,
      workDir,
      testCommand,
      logFile,
    );
    steps.testsRun = true;
    const step5Duration = Date.now() - step5Start;

    console.log(
      `[TEST-RUNNER]         Tests completed (${step5Duration}ms, exit code: ${testOutput.exitCode})`,
    );
    logToFile(
      `[STEP 5] ✓ Tests completed in ${step5Duration}ms (exit code: ${testOutput.exitCode})`,
      logFile,
    );
    executionLog.push({
      timestamp: new Date(),
      step: 5,
      status: "completed",
      exitCode: testOutput.exitCode,
      stdoutSize: testOutput.stdout.length,
      stderrSize: testOutput.stderr.length,
      duration: step5Duration,
    });

    const totalDuration = Date.now() - startTime;
    steps.totalDuration = totalDuration;

    console.log(`[TEST-RUNNER] ✓ Complete (${totalDuration}ms total)`);
    logToFile(`\n${"=".repeat(80)}`, logFile);
    logToFile(`TEST RUN COMPLETED - ${new Date().toISOString()}`, logFile);
    logToFile(
      `Total Duration: ${totalDuration}ms | Exit Code: ${testOutput.exitCode}`,
      logFile,
    );
    logToFile(`Log file: ${logFileName}`, logFile);
    logToFile(`${"=".repeat(80)}\n`, logFile);
    executionLog.push({
      timestamp: new Date(),
      status: "SUCCESS",
      totalDuration: totalDuration,
    });

    return res.status(200).json({
      message:
        testOutput.exitCode === 0
          ? "All tests passed"
          : "Tests executed (some failures)",
      containerName,
      workDir,
      steps,
      configFilePath,
      testCommand,
      output: {
        stdout: testOutput.stdout,
        stderr: testOutput.stderr,
        exitCode: testOutput.exitCode,
      },
      executionLog,
      logFile: logFileName,
      logPath: logFile,
      summary: {
        configDetectionTime: steps.configFileDetected
          ? "via Claude API"
          : "N/A",
        testCommandTime: steps.testCommandDetected ? "via Claude API" : "N/A",
        totalExecutionTime: `${totalDuration}ms`,
      },
    });
  } catch (error) {
    console.error("[TEST-RUNNER] ✗ Error:", error.message);
    logToFile(`\n[ERROR] Test run failed: ${error.message}`, logFile);

    const totalDuration = Date.now() - startTime;
    steps.totalDuration = totalDuration;

    executionLog.push({
      timestamp: new Date(),
      status: "FAILED",
      error: error.message,
      totalDuration: totalDuration,
    });

    logToFile(`${"=".repeat(80)}`, logFile);
    logToFile(`Total Duration: ${totalDuration}ms`, logFile);
    logToFile(`${"=".repeat(80)}\n`, logFile);

    return res.status(500).json({
      message: "Test run failed",
      error: error.message,
      steps,
      executionLog,
      logFile: logFileName,
      logPath: logFile,
      suggestion:
        "Ensure GOOGLE_API_KEY is set and the container is running with proper directory structure",
    });
  }
};

/**
 * GET /api/test-runner/logs/:logFileName
 * Retrieve a specific test log file
 */
const getTestLog = async (req, res) => {
  try {
    const { logFileName } = req.params;

    // Validate filename to prevent directory traversal
    if (
      !logFileName ||
      logFileName.includes("..") ||
      logFileName.includes("/")
    ) {
      return res.status(400).json({
        message: "Invalid log file name",
      });
    }

    const logPath = path.join(logsDir, logFileName);

    // Check if file exists
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({
        message: "Log file not found",
        logFile: logFileName,
      });
    }

    // Read the log file
    const logContent = fs.readFileSync(logPath, "utf8");

    res.status(200).json({
      message: "Log file retrieved successfully",
      logFile: logFileName,
      logPath: logPath,
      content: logContent,
      size: logContent.length,
    });
  } catch (error) {
    console.error("[TEST-RUNNER] Error retrieving log:", error.message);
    res.status(500).json({
      message: "Failed to retrieve log file",
      error: error.message,
    });
  }
};

/**
 * GET /api/test-runner/logs
 * List all available test logs
 */
const listTestLogs = async (req, res) => {
  try {
    if (!fs.existsSync(logsDir)) {
      return res.status(200).json({
        message: "No logs available yet",
        logs: [],
      });
    }

    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith(".log"));
    const logs = files
      .map((file) => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          size: stats.size,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({
      message: "Test logs retrieved successfully",
      totalLogs: logs.length,
      logs: logs,
    });
  } catch (error) {
    console.error("[TEST-RUNNER] Error listing logs:", error.message);
    res.status(500).json({
      message: "Failed to list logs",
      error: error.message,
    });
  }
};

module.exports = {
  runTestsInSandbox,
  getTestLog,
  listTestLogs,
};
