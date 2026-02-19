/**
 * Test Healing Routes
 *
 * Endpoints for the multi-agent test error healing system
 */

const express = require("express");
const router = express.Router();
const {
  healTestErrors_Controller,
  getHealingStats_Controller,
  runTestsAndHeal_Controller,
  getRecommendations_Controller,
  applyFixes_Controller,
  getDashboard_Controller,
} = require("../controllers/healingController");

// ===========================
// 🏥 Healing Endpoints
// ===========================

/**
 * POST /api/healing/heal
 * Start healing workflow for test errors
 *
 * Body:
 * {
 *   "testLogs": "string - test output",
 *   "options": {
 *     "reportFormat": "json|markdown|summary",
 *     "autoApply": boolean
 *   }
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "message": string,
 *   "statistics": {...},
 *   "approvedFixesCount": number,
 *   "report": string|object,
 *   "timestamp": ISO string
 * }
 */
router.post("/heal", async (req, res) => {
  console.log("📥 [POST /api/healing/heal]");
  await healTestErrors_Controller(req, res);
});

/**
 * GET /api/healing/stats
 * Get healing statistics and history
 *
 * Response:
 * {
 *   "success": boolean,
 *   "stats": {
 *     "totalHealingAttempts": number,
 *     "totalErrorsFound": number,
 *     "totalFixesApproved": number,
 *     "averageApprovalRate": percentage,
 *     "errorTypeBreakdown": {...},
 *     "lastHealing": timestamp
 *   }
 * }
 */
router.get("/stats", async (req, res) => {
  console.log("📥 [GET /api/healing/stats]");
  await getHealingStats_Controller(req, res);
});

/**
 * POST /api/healing/run-and-heal
 * Execute tests and automatically start healing workflow
 *
 * Body:
 * {
 *   "testCommand": "npm test",
 *   "containerName": "optional",
 *   "autoApplyFixes": boolean
 * }
 *
 * Response:
 * {
 *   "testResults": {...},
 *   "healing": {...},
 *   "recommendations": string
 * }
 */
router.post("/run-and-heal", async (req, res) => {
  console.log("📥 [POST /api/healing/run-and-heal]");
  await runTestsAndHeal_Controller(req, res);
});

/**
 * GET /api/healing/recommendations
 * Get fix recommendations for a specific log file
 *
 * Query:
 * - logFile: string (required) - filename of test log
 *
 * Response:
 * {
 *   "success": boolean,
 *   "logFile": string,
 *   "healing": {...},
 *   "recommendations": [
 *     {
 *       "priority": number,
 *       "file": string,
 *       "line": number,
 *       "issue": string,
 *       "type": string,
 *       "fix": string,
 *       "expectedOutcome": string
 *     }
 *   ]
 * }
 */
router.get("/recommendations", async (req, res) => {
  console.log("📥 [GET /api/healing/recommendations]");
  await getRecommendations_Controller(req, res);
});

/**
 * POST /api/healing/apply-fixes
 * Apply approved fixes to codebase
 *
 * Body:
 * {
 *   "fixes": [
 *     { "file": "path", "patch_instructions": "..." }
 *   ]
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "message": string,
 *   "appliedFixes": [...],
 *   "nextSteps": [...]
 * }
 */
router.post("/apply-fixes", async (req, res) => {
  console.log("📥 [POST /api/healing/apply-fixes]");
  await applyFixes_Controller(req, res);
});

/**
 * GET /api/healing/dashboard
 * Get healing system status and dashboard data
 *
 * Response:
 * {
 *   "success": boolean,
 *   "dashboard": {
 *     "status": "active",
 *     "agents": {...},
 *     "workflow": {...},
 *     "lastRun": {...}
 *   }
 * }
 */
router.get("/dashboard", async (req, res) => {
  console.log("📥 [GET /api/healing/dashboard]");
  await getDashboard_Controller(req, res);
});

// ===========================
// 📤 Export Routes
// ===========================

module.exports = router;
