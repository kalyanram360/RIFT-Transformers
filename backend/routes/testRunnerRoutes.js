const express = require("express");
const router = express.Router();
const testRunnerController = require("../controllers/testRunnerController");

/**
 * POST /api/test-runner/:containerName/run-tests
 *
 * Runs tests inside a Docker container with AI-powered test detection
 *
 * Params:
 *   - containerName: Docker container name (e.g., sandbox-repo-123)
 *
 * Body:
 *   - workDir: Working directory in container (e.g., /workspace/repo)
 *
 * Returns:
 *   {
 *     message: string,
 *     containerName: string,
 *     workDir: string,
 *     steps: {
 *       directoryFetch: boolean,
 *       configFileDetected: string,
 *       configFileRead: boolean,
 *       testCommandDetected: string,
 *       testsRun: boolean,
 *       totalDuration: number (ms)
 *     },
 *     configFilePath: string,
 *     testCommand: string,
 *     output: {
 *       stdout: string,
 *       stderr: string,
 *       exitCode: number
 *     },
 *     logFile: string (filename),
 *     logPath: string (full path),
 *     executionLog: Array<{
 *       timestamp: string,
 *       step: number,
 *       action: string,
 *       status: string,
 *       duration: number
 *     }>
 *   }
 */
router.post(
  "/:containerName/run-tests",
  testRunnerController.runTestsInSandbox,
);

/**
 * GET /api/test-runner/logs/:logFileName
 *
 * Retrieve a specific test log file
 *
 * Params:
 *   - logFileName: Name of the log file (e.g., test-sandbox-repo-123-1708345678.log)
 *
 * Returns:
 *   {
 *     message: string,
 *     logFile: string,
 *     logPath: string,
 *     content: string,
 *     size: number
 *   }
 */
router.get("/logs/:logFileName", testRunnerController.getTestLog);

/**
 * GET /api/test-runner/logs
 *
 * List all available test logs
 *
 * Returns:
 *   {
 *     message: string,
 *     totalLogs: number,
 *     logs: Array<{
 *       fileName: string,
 *       createdAt: string,
 *       modifiedAt: string,
 *       size: number
 *     }>
 *   }
 */
router.get("/logs", testRunnerController.listTestLogs);

module.exports = router;
