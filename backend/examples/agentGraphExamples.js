/**
 * Example Usage of Multi-Agent Healing System
 *
 * This demonstrates how to use the LangChain multi-agent graph
 * to automatically extract, classify, patch, and verify test errors
 */

const { runAgentGraph } = require("../agentGraph");
const {
  healTestErrors,
  processTestResults,
  formatReport,
} = require("../services/healingService");

// ===========================
// 📝 Example 1: Simple Usage
// ===========================

async function example1_SimpleUsage() {
  console.log("\n🎯 Example 1: Simple Usage\n");

  const sampleTestLogs = `
[FAIL] tests/userController.test.js
  ✓ GET /api/users (200ms)
  ✗ POST /api/users - TypeError: Cannot read properties of undefined (reading 'email')
    at userController.js:42:15
    at runMicrotasks
  
[FAIL] tests/dockerController.test.js
  ✗ POST /api/docker/clone - SyntaxError: Unexpected token } in JSON at position 156
    at JSON.parse (native)
    at dockerController.js:78:3
  
[FAIL] tests/integration.test.js
  ✗ beforeAll hook for "should initialize database" - Error: ENOENT: no such file or directory, open 'config/database.json'
    at Object.openSync (fs.js:462:28)
`;

  const result = await healTestErrors(sampleTestLogs, {
    verbose: true,
    reportFormat: "json",
  });

  console.log("\n📊 Result:");
  console.log(JSON.stringify(result, null, 2));

  return result;
}

// ===========================
// 📝 Example 2: With Report Formatting
// ===========================

async function example2_WithReporting() {
  console.log("\n🎯 Example 2: With Report Formatting\n");

  const testLogs = `
FAIL  src/services/auth.test.js
  Auth Service
    ✗ should validate token
      ReferenceError: refreshToken is not defined
        at validateToken (auth.js:25:10)
    ✗ should hash password
      TypeError: bcrypt.hash is not a function
        at hashPassword (auth.js:40:5)

ERROR in ./src/utils/helpers.js
  Line 12: Expected 'return' statement
  
Tests: 2 failed, 3 passed
`;

  const result = await healTestErrors(testLogs, {
    verbose: true,
    reportFormat: "markdown",
  });

  if (result.success) {
    console.log("\n📄 Markdown Report:\n");
    console.log(result.report);
  }

  return result;
}

// ===========================
// 📝 Example 3: Direct Graph Usage
// ===========================

async function example3_DirectGraphUsage() {
  console.log("\n🎯 Example 3: Direct Graph Invocation\n");

  const testLogs = `
[ERROR] /home/user/project/tests/api.test.js:45
  expect(response.status).toBe(200)
  Received: undefined
  
[ERROR] /home/user/project/src/middleware/auth.js:12
  module.exports = {
  ^
  SyntaxError: Unexpected token }

[stderr] Cannot find module 'express-validator'
[stderr] at Module._load (internal/modules/require_cache.js:314:1)
`;

  try {
    const graph = await require("./agentGraph").buildAgentGraph();

    const result = await graph.invoke({
      logs: testLogs,
      failures: [],
      classifiedFailures: [],
      generatedPatches: [],
      verifiedPatches: [],
      finalFixes: [],
      processedCount: 0,
    });

    console.log("\n✅ Graph Result:");
    console.log(`Failures: ${result.failures.length}`);
    console.log(`Classified: ${result.classifiedFailures.length}`);
    console.log(`Patches: ${result.generatedPatches.length}`);
    console.log(`Approved: ${result.finalFixes.length}`);

    if (result.finalFixes.length > 0) {
      console.log("\n🎯 Final Approved Fixes:");
      result.finalFixes.forEach((fix, i) => {
        console.log(`${i + 1}. ${fix.file}:${fix.line} [${fix.bug_type}]`);
        console.log(`   Fix: ${fix.patch_instructions}`);
      });
    }

    return result;
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// ===========================
// 📝 Example 4: Integration with Test Results
// ===========================

async function example4_TestResultsIntegration() {
  console.log("\n🎯 Example 4: Integration with Test Results Processing\n");

  const mockTestResults = {
    success: false,
    exit_code: 1,
    stdout: `FAIL src/services/userService.test.js
  User Service
    ✓ should create user (15ms)
    ✗ should find user by email
      TypeError: Cannot read properties of undefined (reading 'findOne')
        at userService.js:18:20`,
    stderr: `npm ERR! Test failed with exit code 1`,
  };

  const healed = await processTestResults(mockTestResults);

  console.log("\n📋 Processed Results:");
  console.log(JSON.stringify(healed.healingAttempt, null, 2));

  return healed;
}

// ===========================
// 📝 Example 5: Batch Processing Multiple Test Files
// ===========================

async function example5_BatchProcessing() {
  console.log("\n🎯 Example 5: Batch Processing\n");

  const testSessions = [
    {
      name: "Unit Tests",
      logs: `FAIL src/utils/validation.test.js
  ✗ should validate email
    ReferenceError: emailRegex is not defined`,
    },
    {
      name: "Integration Tests",
      logs: `FAIL src/integration/database.test.js
  ✗ should connect to database
    Error: ECONNREFUSED 127.0.0.1:5432`,
    },
    {
      name: "E2E Tests",
      logs: `FAIL tests/e2e/login.test.js
  ✗ should login user
    AssertionError: expected 302 to equal 200`,
    },
  ];

  const results = [];

  for (const session of testSessions) {
    console.log(`\n⚙️  Processing: ${session.name}...`);
    const result = await healTestErrors(session.logs, {
      verbose: false,
      reportFormat: "summary",
    });
    results.push({
      session: session.name,
      ...result,
    });
  }

  console.log("\n📊 Batch Results:");
  results.forEach((r) => {
    console.log(`\n${r.session}:`);
    console.log(`  Status: ${r.success ? "✅" : "❌"}`);
    if (r.statistics) {
      console.log(
        `  Approved Fixes: ${r.statistics.approved}/${r.statistics.patched}`,
      );
    }
  });

  return results;
}

// ===========================
// 🚀 Run Examples
// ===========================

async function runAllExamples() {
  console.log("=".repeat(70));
  console.log("🤖 Multi-Agent Test Error Healing System - Examples");
  console.log("=".repeat(70));

  try {
    // Uncomment examples to run:

    // await example1_SimpleUsage();
    // await example2_WithReporting();
    // await example3_DirectGraphUsage();
    // await example4_TestResultsIntegration();
    // await example5_BatchProcessing();

    console.log("\n✅ All examples completed!\n");
  } catch (error) {
    console.error("❌ Example error:", error);
  }
}

// ===========================
// 📤 Export
// ===========================

module.exports = {
  example1_SimpleUsage,
  example2_WithReporting,
  example3_DirectGraphUsage,
  example4_TestResultsIntegration,
  example5_BatchProcessing,
  runAllExamples,
};

// Uncomment to run examples:
// runAllExamples().catch(console.error);
