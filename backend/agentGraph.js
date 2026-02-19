const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { StateGraph } = require("@langchain/langgraph");
const { z } = require("zod");

// ===========================
// 🧠 STEP 1: Define Shared State Schema using Zod
// ===========================
const StateSchema = z.object({
  logs: z.string().default(""),
  failures: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        error_message: z.string(),
      }),
    )
    .default([]),
  classifiedFailures: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        error_message: z.string(),
        bug_type: z.string(),
      }),
    )
    .default([]),
  generatedPatches: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        error_message: z.string(),
        bug_type: z.string(),
        patch_instructions: z.string(),
        required_dashboard_output: z.string(),
      }),
    )
    .default([]),
  verifiedPatches: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        error_message: z.string(),
        bug_type: z.string(),
        patch_instructions: z.string(),
        required_dashboard_output: z.string(),
        verification_status: z.string(),
      }),
    )
    .default([]),
  finalFixes: z.array(z.any()).default([]),
  processedCount: z.number().default(0),
});

// ===========================
// 🧩 STEP 2: Initialize Multi-Model Agents (Using Google Gemini)
// ===========================
const extractorModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
  maxOutputTokens: 2000,
});

const classifierModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
  maxOutputTokens: 1000,
});

const patchModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
  maxOutputTokens: 3000,
});

const verifierModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
  maxOutputTokens: 500,
});

// ===========================
// 🔹 STEP 3: Create Agent Nodes
// ===========================

/**
 * Node 1: Extract Failures from Logs
 * Parses test logs and identifies individual failures
 */
async function extractNode(state) {
  console.log("\n📍 [EXTRACT NODE] Processing logs...");

  const prompt = `You are a DevOps Error Extraction Agent.

Extract structured test failures from the provided logs.

Return a JSON array with this exact format:
[
  {
    "file": "path/to/file.js",
    "line": 42,
    "error_message": "exact error message"
  }
]

Rules:
- Extract EVERY error you find
- Use exact file paths from logs
- Include line numbers if available
- Keep error messages concise but complete
- If no line number, use 0
- Return ONLY valid JSON, no markdown or explanation

Test Logs:
${state.logs}`;

  try {
    const response = await extractorModel.invoke([
      { role: "user", content: prompt },
    ]);

    let content = response.content;
    if (typeof content === "string") {
      // Clean up markdown code blocks if present
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }

    const failures = JSON.parse(content);
    console.log(`✅ Extracted ${failures.length} failures`);

    return {
      ...state,
      failures: failures || [],
      processedCount: failures?.length || 0,
    };
  } catch (error) {
    console.error("❌ Extraction error:", error.message);
    return { ...state, failures: [] };
  }
}

/**
 * Node 2: Classify Failures (Parallel Processing)
 * Categorizes each failure by error type
 */
async function classifyNode(state) {
  console.log(
    `\n📍 [CLASSIFY NODE] Processing ${state.failures.length} failures...`,
  );

  if (state.failures.length === 0) {
    console.log("⏭️  No failures to classify");
    return state;
  }

  // Parallel classification
  const classificationPromises = state.failures.map(async (failure) => {
    const prompt = `Classify this error into ONE category only:
- LINTING (code style, formatting)
- SYNTAX (parsing, invalid code structure)
- LOGIC (incorrect algorithm, wrong implementation)
- TYPE_ERROR (type mismatch, undefined variable)
- IMPORT (missing module, wrong import path)
- INDENTATION (whitespace, tab issues)
- RUNTIME (execution error)
- CONFIG (configuration, environment issue)

Error Message:
${failure.error_message}

File: ${failure.file}
Line: ${failure.line}

Return ONLY the category name, nothing else.`;

    try {
      const response = await classifierModel.invoke([
        { role: "user", content: prompt },
      ]);

      return {
        ...failure,
        bug_type: response.content.trim(),
      };
    } catch (error) {
      console.error(`Cannot classify ${failure.file}:`, error.message);
      return {
        ...failure,
        bug_type: "UNKNOWN",
      };
    }
  });

  const classified = await Promise.all(classificationPromises);
  console.log(`✅ Classified ${classified.length} failures`);

  return { ...state, classifiedFailures: classified };
}

/**
 * Node 3: Generate Patches (Parallel Processing)
 * Creates fixes for each classified failure
 */
async function patchNode(state) {
  console.log(
    `\n📍 [PATCH NODE] Generating fixes for ${state.classifiedFailures.length} failures...`,
  );

  if (state.classifiedFailures.length === 0) {
    console.log("⏭️  No failures to patch");
    return state;
  }

  // Parallel patch generation
  const patchPromises = state.classifiedFailures.map(async (failure) => {
    const prompt = `You are an autonomous DevOps Patch Generation Agent.

Generate a MINIMAL, DIRECT fix for this error.

File: ${failure.file}
Line: ${failure.line}
Error: ${failure.error_message}
Bug Type: ${failure.bug_type}

Return a JSON object:
{
  "patch_instructions": "Exact code fix or command to run",
  "required_dashboard_output": "Expected output after fix"
}

Rules:
- Fix ONLY what's broken, nothing else
- Be specific and minimal
- If it's a code fix, provide exact code
- If it's a command, provide the exact command
- Return ONLY valid JSON`;

    try {
      const response = await patchModel.invoke([
        { role: "user", content: prompt },
      ]);

      let content = response.content;
      if (typeof content === "string") {
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      const parsed = JSON.parse(content);
      return {
        ...failure,
        patch_instructions: parsed.patch_instructions,
        required_dashboard_output: parsed.required_dashboard_output,
      };
    } catch (error) {
      console.error(`Cannot patch ${failure.file}:`, error.message);
      return {
        ...failure,
        patch_instructions: `Review ${failure.file}:${failure.line}`,
        required_dashboard_output: "Manual review needed",
      };
    }
  });

  const patches = await Promise.all(patchPromises);
  console.log(`✅ Generated ${patches.length} patches`);

  return { ...state, generatedPatches: patches };
}

/**
 * Node 4: Verify Patches (Parallel Processing)
 * Validates that each patch fixes the issue without side effects
 */
async function verifyNode(state) {
  console.log(
    `\n📍 [VERIFY NODE] Verifying ${state.generatedPatches.length} patches...`,
  );

  if (state.generatedPatches.length === 0) {
    console.log("⏭️  No patches to verify");
    return state;
  }

  // Parallel verification
  const verificationPromises = state.generatedPatches.map(async (patch) => {
    const prompt = `You are a Patch Verification Agent.

Verify this fix is:
1. Minimal (only fixes the identified issue)
2. Correct (actually solves the problem)
3. Safe (doesn't introduce new issues)

Error: ${patch.error_message}
Patch: ${patch.patch_instructions}

Return only: APPROVED or REJECTED`;

    try {
      const response = await verifierModel.invoke([
        { role: "user", content: prompt },
      ]);

      const verificationResult = response.content.trim().toUpperCase();
      const isApproved = verificationResult.includes("APPROVED");

      return {
        ...patch,
        verification_status: isApproved ? "APPROVED" : "REJECTED",
      };
    } catch (error) {
      console.error(`Cannot verify ${patch.file}:`, error.message);
      return {
        ...patch,
        verification_status: "PENDING_REVIEW",
      };
    }
  });

  const verified = await Promise.all(verificationPromises);

  const approved = verified.filter((v) => v.verification_status === "APPROVED");
  console.log(
    `✅ Verified ${approved.length}/${verified.length} patches approved`,
  );

  return {
    ...state,
    verifiedPatches: verified,
    finalFixes: approved,
  };
}

// ===========================
// 🧠 STEP 4: Define Conditional Routing
// ===========================

/**
 * Conditional routing after verification
 * Routes approved patches to final output
 */
function shouldApplyFixes(state) {
  const approvedCount = state.finalFixes.length;
  const totalPatches = state.generatedPatches.length;

  console.log(`\n🔀 [ROUTING] Approved: ${approvedCount}/${totalPatches}`);

  if (approvedCount > 0) {
    return "apply";
  }
  return "reject";
}

// ===========================
// 🧠 STEP 5: Build the Graph
// ===========================

async function buildAgentGraph() {
  const workflow = new StateGraph({
    channels: {
      logs: { value: null, default: "" },
      failures: { value: null, default: [] },
      classifiedFailures: { value: null, default: [] },
      generatedPatches: { value: null, default: [] },
      verifiedPatches: { value: null, default: [] },
      finalFixes: { value: null, default: [] },
      processedCount: { value: null, default: 0 },
    },
  });

  // Add nodes
  workflow.addNode("extract", extractNode);
  workflow.addNode("classify", classifyNode);
  workflow.addNode("patch", patchNode);
  workflow.addNode("verify", verifyNode);

  // Set entry point
  workflow.setEntryPoint("extract");

  // Add edges (linear flow)
  workflow.addEdge("extract", "classify");
  workflow.addEdge("classify", "patch");
  workflow.addEdge("patch", "verify");

  // Compile graph
  const graph = workflow.compile();
  console.log("✅ Agent Graph compiled successfully");

  return graph;
}

// ===========================
// 🚀 STEP 6: Execute Graph
// ===========================

async function runAgentGraph(testLogs) {
  console.log("\n🚀 Starting Agent Graph Workflow...\n");
  console.log("=".repeat(60));

  try {
    const graph = await buildAgentGraph();

    const initialState = {
      logs: testLogs,
      failures: [],
      classifiedFailures: [],
      generatedPatches: [],
      verifiedPatches: [],
      finalFixes: [],
      processedCount: 0,
    };

    const result = await graph.invoke(initialState);

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ WORKFLOW COMPLETE\n");
    console.log("📊 SUMMARY:");
    console.log(`  - Extracted Failures: ${result.failures.length}`);
    console.log(`  - Classified: ${result.classifiedFailures.length}`);
    console.log(`  - Patches Generated: ${result.generatedPatches.length}`);
    console.log(`  - Patches Verified: ${result.verifiedPatches.length}`);
    console.log(`  - Approved Fixes: ${result.finalFixes.length}`);

    if (result.finalFixes.length > 0) {
      console.log("\n🎯 APPROVED FIXES:");
      result.finalFixes.forEach((fix, idx) => {
        console.log(`\n  ${idx + 1}. ${fix.file}:${fix.line}`);
        console.log(`     Bug Type: ${fix.bug_type}`);
        console.log(`     Error: ${fix.error_message}`);
        console.log(`     Fix: ${fix.patch_instructions}`);
      });
    }

    return result;
  } catch (error) {
    console.error("\n❌ Workflow Error:", error.message);
    throw error;
  }
}

// ===========================
// 📤 Export Functions
// ===========================

module.exports = {
  runAgentGraph,
  buildAgentGraph,
  extractNode,
  classifyNode,
  patchNode,
  verifyNode,
  StateSchema,
};
