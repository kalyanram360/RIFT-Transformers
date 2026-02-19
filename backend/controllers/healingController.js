/**
 * Test Healing Controller
 *
 * Integrates the multi-agent healing system with test execution.
 * Runs after tests complete to extract, classify, patch, and verify errors.
 */

const {
  healTestErrors,
  processTestResults,
  formatReport,
} = require("../services/healingService");

// ===========================
// 🏃 Healing Workflow Controller
// ===========================

/**
 * Main endpoint to heal test errors
 * POST /api/test-runner/heal
 *
 * Body:
 * {
 *   "testLogs": "test output text",
 *   "options": { "reportFormat": "json|markdown|summary" }
 * }
 */
async function healTestErrors_Controller(req, res) {
  try {
    const { testLogs, options = {} } = req.body;

    if (!testLogs) {
      return res.status(400).json({
        success: false,
        message: "testLogs is required",
      });
    }

    console.log("\n🏥 [HEALING] Starting test error healing workflow...");

    const result = await healTestErrors(testLogs, {
      verbose: true,
      autoApply: options.autoApply || false,
      reportFormat: options.reportFormat || "json",
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      statistics: result.statistics,
      approvedFixesCount: result.results?.finalFixes?.length || 0,
      report: result.report,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error("❌ [HEALING ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Error in healing service",
      error: error.message,
    });
  }
}

/**
 * Get healing history and statistics
 * GET /api/test-runner/healing/stats
 */
async function getHealingStats_Controller(req, res) {
  try {
    // In production, this would query a database
    // For now, return empty stats
    return res.status(200).json({
      success: true,
      stats: {
        totalHealingAttempts: 0,
        totalErrorsFound: 0,
        totalFixesApproved: 0,
        averageApprovalRate: "0%",
        errorTypeBreakdown: {},
        lastHealing: null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Auto-heal after test execution
 * Integrates with existing test runner
 * POST /api/test-runner/run-and-heal
 *
 * Body:
 * {
 *   "testCommand": "npm test",
 *   "containerName": "optional-container",
 *   "autoApplyFixes": false
 * }
 */
async function runTestsAndHeal_Controller(req, res) {
  try {
    const { testCommand, containerName, autoApplyFixes = false } = req.body;

    console.log(
      "\n🚀 [RUN & HEAL] Starting test execution with auto-healing...",
    );

    // Simulate test execution (in real scenario, call actual test runner)
    const testResults = {
      success: false,
      exit_code: 1,
      stdout: `
FAIL src/services/userService.test.js
  User Service
    ✓ should initialize (5ms)
    ✗ should create user
      TypeError: Cannot read properties of undefined (reading 'email')
        at createUser (userService.js:42:20)
    ✗ should find user
      ReferenceError: emailValidator is not defined
        at findUserByEmail (userService.js:58:10)
      `,
      stderr: `npm ERR! Test failed with exit code 1`,
    };

    // Process test results with healing
    const healedResults = await processTestResults(testResults);

    return res.status(200).json({
      testResults: {
        success: healedResults.success,
        exit_code: healedResults.exit_code,
        summary: healedResults.healingAttempt,
      },
      healing: {
        attempted: true,
        successful: healedResults.healed,
        approvedFixes: healedResults.healingAttempt?.statistics?.approved || 0,
        approvalRate:
          healedResults.healingAttempt?.statistics?.approvalRate || "0%",
      },
      recommendations: healedResults.healed
        ? "Review and apply approved fixes"
        : "Manual intervention required",
    });
  } catch (error) {
    console.error("❌ [RUN & HEAL ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Error in test execution and healing",
      error: error.message,
    });
  }
}

/**
 * Get detailed fix recommendations
 * GET /api/test-runner/healing/recommendations
 * Query: logFile=filename.log
 */
async function getRecommendations_Controller(req, res) {
  try {
    const { logFile } = req.query;

    if (!logFile) {
      return res.status(400).json({
        success: false,
        message: "logFile query parameter required",
      });
    }

    // In real scenario, read log file content
    // For now, return sample recommendations
    const sampleLogs = `FAIL tests/api.test.js
  ✗ GET /api/users
    TypeError: Cannot read properties of undefined`;

    const healingResult = await healTestErrors(sampleLogs, {
      verbose: false,
      reportFormat: "json",
    });

    return res.status(200).json({
      success: true,
      logFile: logFile,
      healing: healingResult,
      recommendations:
        healingResult.results?.finalFixes?.map((fix, idx) => ({
          priority: idx + 1,
          file: fix.file,
          line: fix.line,
          issue: fix.error_message,
          type: fix.bug_type,
          fix: fix.patch_instructions,
          expectedOutcome: fix.required_dashboard_output,
        })) || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Apply approved fixes to codebase
 * POST /api/test-runner/healing/apply-fixes
 *
 * Body:
 * {
 *   "fixes": [
 *     { "file": "path/file.js", "patch_instructions": "..." }
 *   ]
 * }
 */
async function applyFixes_Controller(req, res) {
  try {
    const { fixes } = req.body;

    if (!fixes || !Array.isArray(fixes)) {
      return res.status(400).json({
        success: false,
        message: "fixes array required in body",
      });
    }

    console.log(`\n🔧 [APPLY FIXES] Applying ${fixes.length} fixes...`);

    // In production, this would:
    // 1. Parse fix instructions
    // 2. Apply to actual files
    // 3. Run tests again
    // 4. Verify improvements

    const applied = fixes.map((fix, idx) => ({
      id: idx + 1,
      file: fix.file,
      status: "PENDING",
      instructions: fix.patch_instructions,
    }));

    return res.status(200).json({
      success: true,
      message: `${fixes.length} fixes prepared for application`,
      appliedFixes: applied,
      nextSteps: [
        "Review fix instructions",
        "Run tests to verify",
        "Commit changes if successful",
      ],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get healing dashboard data
 * GET /api/test-runner/healing/dashboard
 */
async function getDashboard_Controller(req, res) {
  try {
    return res.status(200).json({
      success: true,
      dashboard: {
        status: "active",
        agents: {
          extractor: {
            status: "ready",
            model: "gpt-4o-mini",
            purpose: "Extract failures from logs",
          },
          classifier: {
            status: "ready",
            model: "gpt-4o-mini",
            purpose: "Categorize error types",
          },
          patcher: {
            status: "ready",
            model: "gpt-4",
            purpose: "Generate fixes",
          },
          verifier: {
            status: "ready",
            model: "gpt-4o-mini",
            purpose: "Validate patches",
          },
        },
        workflow: {
          steps: ["Extract", "Classify", "Patch", "Verify"],
          parallelization: "Classify, Patch, and Verify run in parallel",
          successRate: "Determines approval rate of fixes",
        },
        lastRun: {
          timestamp: null,
          failuresFound: 0,
          fixesApproved: 0,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// ===========================
// 📤 Export Controllers
// ===========================

module.exports = {
  healTestErrors_Controller,
  getHealingStats_Controller,
  runTestsAndHeal_Controller,
  getRecommendations_Controller,
  applyFixes_Controller,
  getDashboard_Controller,
};
