const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const util = require("util");
const execPromise = util.promisify(exec);
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
if (typeof input !== "string") throw new Error("Invalid input type");
// Allow alphanumeric, hyphens, underscores, dots, slashes, colons, spaces, and brackets
if (!/^[a-zA-Z0-9_\-./:\[\] ]+$/.test(input))
  throw new Error(`Unsafe input detected: ${input}`);
return input.trim();
const validateGithubUrl = (url) => {
  const githubPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
  if (!githubPattern.test(url)) throw new Error("Invalid GitHub URL format");
  return url;
};

/**
 * Helper: Get directory structure from container
 */
const getDirectoryStructure = async (containerName, workDir) => {
  try {
    const { stdout } = await execPromise(
      `docker exec ${containerName} find ${workDir} -maxdepth 4 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*"`,
      { timeout: 30000 },
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch (error) {
    throw new Error(`Failed to fetch directory structure: ${error.message}`);
  }
};

/**
 * Helper: Ask Gemini to identify test config file
 */
const askApiWhereTestConfigIs = async (fileList) => {
  try {
    const prompt = `You are a build system expert. Given this list of files, identify which single file contains the test command configuration (e.g. package.json, pyproject.toml, setup.cfg, Makefile, etc.). Reply with ONLY the full file path, nothing else.

Files:
${fileList.slice(0, 100).join("\n")}`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();

    return text.trim();
  } catch (error) {
    console.log("Gemini config detection skipped:", error.message);
    return null;
  }
};

/**
 * Helper: Read file from container
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
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
};

/**
 * Helper: Ask Gemini for test command
 */
const askApiForTestCommand = async (filePath, fileContent) => {
  try {
    const prompt = `You are a build system expert. Extract the exact shell command to run the test suite from "${filePath}".

Content:
\`\`\`
${fileContent.substring(0, 2000)}
\`\`\`

Reply with ONLY the shell command (e.g., "npm test", "pytest", "python -m unittest"). If not found, reply "NO_TEST_COMMAND_FOUND".`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();

    return text.trim();
  } catch (error) {
    console.log("Gemini test command extraction skipped:", error.message);
    return null;
  }
};

/**
 * Helper: Run tests in container
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

    // Install Node dependencies if needed
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
      logToFile(`[SETUP] npm install skipped: ${e.message}`, logFile);
    }

    // Install Python dependencies if needed
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
      logToFile(`[SETUP] pip install skipped: ${e.message}`, logFile);
    }

    // Run tests
    let testResult = { stdout: "", stderr: "", exitCode: 0 };
    try {
      logToFile(`\n[TEST] Running: ${testCommand}`, logFile);
      logToFile(`${"─".repeat(70)}`, logFile);

      const { stdout, stderr } = await execPromise(
        `docker exec -w ${workDir} ${containerName} sh -c ${JSON.stringify(testCommand)}`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
      );

      logToFile(`[STDOUT]\n${stdout}`, logFile);
      if (stderr) {
        logToFile(`[STDERR]\n${stderr}`, logFile);
      }
      logToFile(`[EXIT CODE] 0 (Success)`, logFile);

      testResult = { stdout, stderr, exitCode: 0 };
    } catch (error) {
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
    logToFile(`[ERROR] Failed to run tests: ${error.message}`, logFile);
    throw new Error(`Failed to run tests: ${error.message}`);
  }
};

/**
 * Helper: Auto-run tests after cloning
 */
const autoRunTests = async (containerName, workDir) => {
  // Create a unique log file for this test run
  const logFileName = `auto-test-${containerName}-${Date.now()}.log`;
  const logFile = path.join(logsDir, logFileName);

  logToFile(`\n${"=".repeat(80)}`, logFile);
  logToFile(`AUTO-TEST RUN STARTED - ${new Date().toISOString()}`, logFile);
  logToFile(`Container: ${containerName} | WorkDir: ${workDir}`, logFile);
  logToFile(`${"=".repeat(80)}\n`, logFile);

  try {
    // Step 1: Get directory structure
    logToFile(`[AUTO-TEST] STEP 1: Fetching directory structure...`, logFile);
    console.log("[AUTO-TEST] Starting automatic test run...");
    const fileList = await getDirectoryStructure(containerName, workDir);

    if (fileList.length === 0) {
      logToFile(`[AUTO-TEST] No files found, skipping tests`, logFile);
      console.log("[AUTO-TEST] No files found, skipping tests");
      return null;
    }

    logToFile(`[AUTO-TEST] ✓ Found ${fileList.length} files`, logFile);

    // Step 2: Identify test config file
    logToFile(`[AUTO-TEST] STEP 2: Identifying test config file...`, logFile);
    const configFile = await askApiWhereTestConfigIs(fileList);

    if (!configFile || configFile.includes("NONE")) {
      logToFile(`[AUTO-TEST] Could not identify test config file`, logFile);
      console.log("[AUTO-TEST] Could not identify test config file");
      return null;
    }

    logToFile(`[AUTO-TEST] ✓ Config file: ${configFile}`, logFile);
    console.log(`[AUTO-TEST] Config file: ${configFile}`);

    // Step 3: Read config file
    logToFile(`[AUTO-TEST] STEP 3: Reading config file...`, logFile);
    const fileContent = await readFileFromContainer(containerName, configFile);
    logToFile(`[AUTO-TEST] ✓ Read ${fileContent.length} bytes`, logFile);

    // Step 4: Extract test command
    logToFile(`[AUTO-TEST] STEP 4: Extracting test command...`, logFile);
    const testCommand = await askApiForTestCommand(configFile, fileContent);

    if (!testCommand || testCommand === "NO_TEST_COMMAND_FOUND") {
      logToFile(`[AUTO-TEST] No test command found`, logFile);
      console.log("[AUTO-TEST] No test command found");
      return null;
    }

    logToFile(`[AUTO-TEST] ✓ Test command: ${testCommand}`, logFile);
    console.log(`[AUTO-TEST] Test command: ${testCommand}`);

    // Step 5: Run tests
    logToFile(`[AUTO-TEST] STEP 5: Running tests...`, logFile);
    console.log("[AUTO-TEST] Running tests...");
    const testOutput = await runTestCommandInContainer(
      containerName,
      workDir,
      testCommand,
      logFile,
    );

    logToFile(
      `[AUTO-TEST] ✓ Tests completed (exit code: ${testOutput.exitCode})`,
      logFile,
    );
    console.log(
      `[AUTO-TEST] ✓ Tests completed (exit code: ${testOutput.exitCode})`,
    );

    logToFile(`\n${"=".repeat(80)}`, logFile);
    logToFile(`AUTO-TEST RUN COMPLETED - ${new Date().toISOString()}`, logFile);
    logToFile(
      `Exit Code: ${testOutput.exitCode} | Log file: ${logFileName}`,
      logFile,
    );
    logToFile(`${"=".repeat(80)}\n`, logFile);

    return {
      configFile,
      testCommand,
      output: testOutput,
      success: testOutput.exitCode === 0,
      logFile: logFileName,
      logPath: logFile,
    };
  } catch (error) {
    console.error("[AUTO-TEST] Error:", error.message);
    logToFile(`[AUTO-TEST] ✗ Error: ${error.message}`, logFile);
    logToFile(`${"=".repeat(80)}\n`, logFile);
    return null;
  }
};

// Clone repo INSIDE a Docker sandbox container and keep it running for agent use
const cloneIntoSandbox = async (req, res) => {
  try {
    const rawUrl = req.body.githubUrl;
    const rawTeamName = req.body.teamName || "TEAM";
    const rawLeaderName = req.body.leaderName || "LEADER";

    // Validate & sanitize
    const githubUrl = validateGithubUrl(rawUrl);
    const teamName = sanitize(rawTeamName).toUpperCase().replace(/\s+/g, "_");
    const leaderName = sanitize(rawLeaderName)
      .toUpperCase()
      .replace(/\s+/g, "_");

    const repoName = githubUrl.split("/").pop().replace(".git", "");
    const branchName = `${teamName}_${leaderName}_AI_Fix`;
    const containerName = `sandbox-${repoName}-${Date.now()}`;
    const workDir = `/workspace/${repoName}`;

    // Use a safe base image with git + python pre-installed
    const baseImage = "python:3.11-slim";

    console.log(`Pulling base image ${baseImage}...`);
    try {
      await execPromise(`docker pull ${baseImage}`, { timeout: 300000 }); // 5 min timeout
    } catch (pullError) {
      console.log("Image may already exist, continuing...");
    }

    // Run a long-lived sandbox container
    console.log(`Starting sandbox container: ${containerName}`);
    await execPromise(
      `docker run -d --name ${containerName} --memory="512m" --cpus="1" --network=host ${baseImage} sleep infinity`,
    );

    // Install git inside the container
    console.log(`Installing git in sandbox...`);
    await execPromise(
      `docker exec ${containerName} apt-get update -qq && docker exec ${containerName} apt-get install -y git -qq`,
    );

    // Clone the repo inside the container
    console.log(`Cloning ${githubUrl} inside sandbox...`);
    await execPromise(
      `docker exec ${containerName} git clone ${githubUrl} ${workDir}`,
    );

    // Configure git identity for AI commits
    await execPromise(
      `docker exec ${containerName} git config --global user.email "ai-agent@rift2026.dev"`,
    );
    await execPromise(
      `docker exec ${containerName} git config --global user.name "AI Agent"`,
    );

    // Create the required branch inside the container
    console.log(`Creating branch ${branchName}...`);
    await execPromise(
      `docker exec -w ${workDir} ${containerName} git checkout -b ${branchName}`,
    );

    // List repo structure for the agent to analyze
    const { stdout: repoStructure } = await execPromise(
      `docker exec ${containerName} find ${workDir} -type f -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.json"`,
    );

    // AUTO-RUN TESTS
    console.log("Auto-running tests...");
    const testResults = await autoRunTests(containerName, workDir);

    res.status(201).json({
      message: "Repository cloned and tests executed",
      containerName,
      repoName,
      branchName,
      workDir,
      repoFiles: repoStructure.trim().split("\n").filter(Boolean),
      sandboxReady: true,
      tests: testResults
        ? {
            configFile: testResults.configFile,
            testCommand: testResults.testCommand,
            exitCode: testResults.output.exitCode,
            success: testResults.success,
            stdout: testResults.output.stdout,
            stderr: testResults.output.stderr,
            logFile: testResults.logFile,
            logPath: testResults.logPath,
          }
        : {
            configured: false,
            message: "No tests configured in this repository",
          },
    });
  } catch (error) {
    console.error("Sandbox clone error:", error.message);
    res.status(500).json({
      message: "Failed to clone repository into sandbox",
      error: error.message,
    });
  }
};

// Run a command inside the sandbox (used by agent steps)
const execInSandbox = async (req, res) => {
  try {
    const { containerName, command, workDir } = req.body;

    sanitize(containerName);
    if (!command || typeof command !== "string")
      throw new Error("Command is required");

    const safeWorkDir = workDir ? sanitize(workDir) : "/workspace";

    const { stdout, stderr } = await execPromise(
      `docker exec -w ${safeWorkDir} ${containerName} sh -c ${JSON.stringify(command)}`,
    );

    res.status(200).json({ stdout, stderr });
  } catch (error) {
    res.status(500).json({
      message: "Command execution failed",
      error: error.message,
    });
  }
};

// Cleanup sandbox after agent finishes
const destroySandbox = async (req, res) => {
  try {
    const { containerName } = req.params;
    sanitize(containerName);

    await execPromise(`docker rm -f ${containerName}`);

    res.status(200).json({
      message: `Sandbox ${containerName} destroyed successfully`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error destroying sandbox",
      error: error.message,
    });
  }
};

// Get sandbox status
const getSandboxStatus = async (req, res) => {
  try {
    const { containerName } = req.params;
    sanitize(containerName);

    const { stdout } = await execPromise(
      `docker inspect ${containerName} --format='{{.State.Running}}'`,
    );
    const isRunning = stdout.trim() === "true";

    res.status(200).json({
      containerName,
      isRunning,
      status: isRunning ? "running" : "stopped",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching sandbox status",
      error: error.message,
    });
  }
};

module.exports = {
  cloneIntoSandbox,
  execInSandbox,
  destroySandbox,
  getSandboxStatus,
};
