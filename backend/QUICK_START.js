#!/usr/bin/env node

/**
 * 🚀 Multi-Agent Test Error Healing - Quick Start Guide
 *
 * This file demonstrates the fastest way to get started with
 * the multi-agent healing system.
 */

const { healTestErrors } = require("./services/healingService");

// ===========================
// 📝 QUICK START
// ===========================
console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🤖 Multi-Agent Test Error Healing System - Quick Start       ║
╚════════════════════════════════════════════════════════════════╝
`);

// ===========================
// STEP 1: Setup
// ===========================
console.log(`\n📋 STEP 1: Setup\n`);
console.log(`1. Ensure .env has OPENAI_API_KEY:`);
console.log(`   OPENAI_API_KEY=sk-...`);
console.log(
  `\n2. Packages already installed: @langchain/openai, @langchain/langgraph, zod`,
);

// ===========================
// STEP 2: Basic Usage
// ===========================
console.log(`\n📋 STEP 2: Basic Usage Examples\n`);

console.log(`🔹 Via Command Line:`);
console.log(`   npm run heal:simple  # Run simple example`);
console.log(`   npm run heal:report  # Generate markdown report`);
console.log(`   npm run heal:graph   # Direct graph invocation`);
console.log(`   npm run heal:batch   # Batch multiple test sessions\n`);

console.log(`🔹 Via HTTP API:`);
console.log(`   POST /api/healing/heal`);
console.log(
  `   Body: { "testLogs": "your test output", "options": { "reportFormat": "json" } }\n`,
);

console.log(`🔹 Programmatically:`);
console.log(
  `   const { healTestErrors } = require('./services/healingService');`,
);
console.log(`   const result = await healTestErrors(testLogs);`);
console.log(`   console.log(result.statistics);\n`);

// ===========================
// STEP 3: Core Features
// ===========================
console.log(`📋 STEP 3: Core Features\n`);

const features = [
  { icon: "📊", name: "Extract", desc: "Identify all failures in test logs" },
  {
    icon: "🏷️",
    name: "Classify",
    desc: "Categorize errors (SYNTAX, LOGIC, TYPE_ERROR, etc.)",
  },
  { icon: "🔧", name: "Patch", desc: "Generate minimal fixes using GPT-4" },
  { icon: "✅", name: "Verify", desc: "Validate patches are correct and safe" },
];

features.forEach((f) => {
  console.log(`${f.icon} ${f.name.padEnd(12)} → ${f.desc}`);
});

// ===========================
// STEP 4: Architecture
// ===========================
console.log(`\n📋 STEP 4: Architecture\n`);
console.log(`
┌──────────────┐
│  Test Logs   │
└──────┬───────┘
       │
       ▼
    ┌─────────────┐
    │   EXTRACT   │ ← Identifies failures
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  CLASSIFY   │ ← Categorizes errors (parallel)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │    PATCH    │ ← Generates fixes (parallel)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   VERIFY    │ ← Validates fixes (parallel)
    └──────┬──────┘
           │
           ▼
    ┌─────────────────┐
    │ Approved Fixes  │
    └─────────────────┘
`);

// ===========================
// STEP 5: File Structure
// ===========================
console.log(`📋 STEP 5: Project Structure\n`);

const structure = [
  { path: "agentGraph.js", desc: "Main graph definition and agents" },
  { path: "services/healingService.js", desc: "High-level healing API" },
  { path: "controllers/healingController.js", desc: "Express route handlers" },
  { path: "routes/healingRoutes.js", desc: "HTTP API endpoints" },
  { path: "examples/agentGraphExamples.js", desc: "Usage examples" },
  { path: "AGENT_GRAPH_README.md", desc: "Full documentation" },
];

structure.forEach((f) => {
  console.log(`  📄 ${f.path.padEnd(35)} - ${f.desc}`);
});

// ===========================
// STEP 6: Quick Examples
// ===========================
console.log(`\n📋 STEP 6: Usage Examples\n`);

console.log(`🔹 Example 1: Heal test logs programmatically\n`);
console.log(`const { healTestErrors } = require('./services/healingService');

const logs = \`
FAIL src/users.test.js
  ✗ should create user
    TypeError: Cannot read properties of undefined (reading 'email')
\`;

const result = await healTestErrors(logs);
console.log(result.statistics);
// Output: { totalFailures: 1, approved: 1, approvalRate: "100%" }
\n`);

console.log(`🔹 Example 2: Get markdown report\n`);
console.log(`const result = await healTestErrors(logs, {
  reportFormat: "markdown"
});
console.log(result.report);
// Returns formatted markdown with all fixes
\n`);

console.log(`🔹 Example 3: HTTP API call\n`);
console.log(`curl -X POST http://localhost:5001/api/healing/heal \\
  -H "Content-Type: application/json" \\
  -d '{ 
    "testLogs": "FAIL ...",
    "options": { "reportFormat": "json" }
  }'
\n`);

// ===========================
// STEP 7: Models Used
// ===========================
console.log(`📋 STEP 7: AI Models\n`);

const models = [
  { agent: "Extract", model: "GPT-4o-mini", temp: "0", tokens: "2000" },
  { agent: "Classify", model: "GPT-4o-mini", temp: "0", tokens: "1000" },
  { agent: "Patch", model: "GPT-4", temp: "0", tokens: "3000" },
  { agent: "Verify", model: "GPT-4o-mini", temp: "0", tokens: "500" },
];

console.log(`${"Agent".padEnd(12)} | ${"Model".padEnd(15)} | Temp | Tokens`);
console.log(`${"-".repeat(12)}-+-${"-".repeat(15)}-+------+-------`);
models.forEach((m) => {
  console.log(
    `${m.agent.padEnd(12)} | ${m.model.padEnd(15)} | ${m.temp}    | ${m.tokens}`,
  );
});

console.log(`\nNote: Temperature = 0 for deterministic results (non-creative)`);

// ===========================
// STEP 8: Performance Tips
// ===========================
console.log(`\n📋 STEP 8: Performance Tips\n`);

const tips = [
  "✅ Parallel processing (Classify, Patch, Verify run in parallel)",
  "✅ Fast models (GPT-4o-mini) for quick operations",
  "✅ Strong model (GPT-4) only for complex fixes",
  "⚠️  Monitor OpenAI API usage (each fix call = API cost)",
  "⚠️  Set reasonable timeouts for production",
  "💡 Batch multiple test files for better cost efficiency",
];

tips.forEach((tip) => console.log(`   ${tip}`));

// ===========================
// STEP 9: Next Steps
// ===========================
console.log(`\n📋 STEP 9: Next Steps\n`);

const steps = [
  {
    num: "1",
    action: "Try: npm run heal:simple",
    desc: "Run a simple example",
  },
  {
    num: "2",
    action: "Read: AGENT_GRAPH_README.md",
    desc: "Full documentation",
  },
  {
    num: "3",
    action: "Explore: examples/agentGraphExamples.js",
    desc: "More examples",
  },
  {
    num: "4",
    action: "Integrate: Call from your test runner",
    desc: "Auto-healing",
  },
  {
    num: "5",
    action: "Monitor: Track metrics and performance",
    desc: "Optimize",
  },
];

steps.forEach((s) => {
  console.log(`   ${s.num}. ${s.action}`);
  console.log(`      └─ ${s.desc}\n`);
});

// ===========================
// STEP 10: Available Endpoints
// ===========================
console.log(`📋 STEP 10: API Endpoints\n`);

const endpoints = [
  { method: "POST", url: "/api/healing/heal", desc: "Start healing workflow" },
  { method: "GET", url: "/api/healing/stats", desc: "Get healing statistics" },
  {
    method: "POST",
    url: "/api/healing/run-and-heal",
    desc: "Execute tests + heal",
  },
  {
    method: "GET",
    url: "/api/healing/recommendations",
    desc: "Get fix recommendations",
  },
  {
    method: "POST",
    url: "/api/healing/apply-fixes",
    desc: "Apply approved fixes",
  },
  {
    method: "GET",
    url: "/api/healing/dashboard",
    desc: "Healing system status",
  },
];

console.log(`${"Method".padEnd(8)} | URL`);
console.log(`${"-".repeat(8)}-+-${"-".repeat(40)}`);
endpoints.forEach((e) => {
  console.log(`${e.method.padEnd(8)} | ${e.url}`);
});

// ===========================
// TROUBLESHOOTING
// ===========================
console.log(`\n📋 Troubleshooting\n`);

const troubleshoot = [
  {
    issue: "API Key Error",
    solution: "Ensure OPENAI_API_KEY is set in .env",
  },
  {
    issue: "Module not found",
    solution: "Run: npm install in backend directory",
  },
  {
    issue: "No fixes approved",
    solution: "Try simpler test cases or increase maxTokens",
  },
  {
    issue: "Rate limit errors",
    solution: "Implement backoff/retry in production",
  },
];

troubleshoot.forEach((t) => {
  console.log(`❌ ${t.issue}`);
  console.log(`   ✅ ${t.solution}\n`);
});

// ===========================
// SUMMARY
// ===========================
console.log(
  `\n╔════════════════════════════════════════════════════════════════╗`,
);
console.log(
  `║                    🎉 YOU'RE READY!                           ║`,
);
console.log(
  `╠════════════════════════════════════════════════════════════════╣`,
);
console.log(
  `║  Next: Run 'npm run heal:simple' to see it in action           ║`,
);
console.log(
  `║  Docs: Read AGENT_GRAPH_README.md for full details             ║`,
);
console.log(
  `║  Code: Check examples/agentGraphExamples.js for more           ║`,
);
console.log(
  `╚════════════════════════════════════════════════════════════════╝\n`,
);

module.exports = {
  features,
  models,
  endpoints,
  troubleshoot,
};
