const { runAgentGraph } = require("../agentGraph");
const { applyFixesAndVerify, commitChanges } = require("./patchApplicator");

// ===========================
// 🔧 Test Error Healing Service
// ===========================

/**
 * Main service function to automatically extract, classify,
 * patch, and verify test failures
 */
async function healTestErrors(testLogs, options = {}) {
  const {
    verbose = true,
    autoApply = false,
    reportFormat = "json",
    containerName = null,
    workDir = null,
    commitMessage = null,
  } = options;

  if (!testLogs || testLogs.trim().length === 0) {
    console.warn("⚠️  No test logs provided");
    return {
      success: false,
      message: "No test logs to process",
      results: null,
    };
  }

  try {
    // Run the multi-agent workflow
    const workflowResult = await runAgentGraph(testLogs);

    // Format output
    const report = formatReport(workflowResult, reportFormat);

    if (verbose) {
      console.log("\n📋 Detailed Report:");
      console.log(JSON.stringify(report, null, 2));
    }

    const response = {
      success: true,
      message: `Successfully processed ${workflowResult.failures.length} failures`,
      statistics: {
        totalFailures: workflowResult.failures.length,
        classified: workflowResult.classifiedFailures.length,
        patched: workflowResult.generatedPatches.length,
        verified: workflowResult.verifiedPatches.length,
        approved: workflowResult.finalFixes.length,
        approvalRate:
          workflowResult.generatedPatches.length > 0
            ? (
                (workflowResult.finalFixes.length /
                  workflowResult.generatedPatches.length) *
                100
              ).toFixed(2) + "%"
            : "N/A",
      },
      results: workflowResult,
      report: report,
      autoApply: autoApply,
      timestamp: new Date().toISOString(),
    };

    // If autoApply enabled and approved fixes exist
    if (
      autoApply &&
      workflowResult.finalFixes.length > 0 &&
      containerName &&
      workDir
    ) {
      console.log("\n🔄 [AUTO-APPLY] Auto-apply is enabled. Applying fixes...");

      const applyResult = await applyFixesAndVerify(
        containerName,
        workDir,
        workflowResult.finalFixes,
        { stdout: testLogs },
      );

      response.autoApplyResult = applyResult;
      response.fixesApplied = applyResult.success;

      // Optionally commit changes
      if (applyResult.success && commitMessage) {
        const commitResult = await commitChanges(
          containerName,
          workDir,
          commitMessage,
        );
        response.commitResult = commitResult;
      }
    } else if (autoApply && workflowResult.finalFixes.length === 0) {
      console.log("\n⚠️  No approved fixes to apply");
      response.autoApplyResult = {
        success: false,
        message: "No approved fixes",
      };
    }

    return response;
  } catch (error) {
    console.error("❌ Healing service error:", error);
    return {
      success: false,
      message: `Error in healing service: ${error.message}`,
      results: null,
      error: error.message,
    };
  }
}

/**
 * Format the workflow results into different report formats
 */
function formatReport(workflowResult, format = "json") {
  switch (format) {
    case "markdown":
      return formatMarkdownReport(workflowResult);
    case "json":
      return formatJsonReport(workflowResult);
    case "summary":
      return formatSummaryReport(workflowResult);
    default:
      return formatJsonReport(workflowResult);
  }
}

/**
 * Generate JSON format report
 */
function formatJsonReport(result) {
  return {
    extracted: result.failures.map((f) => ({
      file: f.file,
      line: f.line,
      error: f.error_message,
    })),
    classified: result.classifiedFailures.map((c) => ({
      file: c.file,
      line: c.line,
      type: c.bug_type,
      error: c.error_message,
    })),
    patched: result.generatedPatches.map((p) => ({
      file: p.file,
      line: p.line,
      type: p.bug_type,
      fix: p.patch_instructions,
      expected_output: p.required_dashboard_output,
    })),
    verified: result.verifiedPatches.map((v) => ({
      file: v.file,
      line: v.line,
      status: v.verification_status,
      fix: v.patch_instructions,
    })),
    approved: result.finalFixes.map((a) => ({
      file: a.file,
      line: a.line,
      type: a.bug_type,
      fix: a.patch_instructions,
      priority: calculatePriority(a.bug_type),
    })),
  };
}

/**
 * Generate Markdown format report
 */
function formatMarkdownReport(result) {
  let markdown = "# Test Error Healing Report\n\n";

  markdown += `**Report Generated**: ${new Date().toLocaleString()}\n\n`;

  markdown += `## 📊 Summary\n`;
  markdown += `- **Total Failures**: ${result.failures.length}\n`;
  markdown += `- **Classified**: ${result.classifiedFailures.length}\n`;
  markdown += `- **Patches Generated**: ${result.generatedPatches.length}\n`;
  markdown += `- **Patches Verified**: ${result.verifiedPatches.length}\n`;
  markdown += `- **Approved Fixes**: ${result.finalFixes.length}\n\n`;

  if (result.finalFixes.length > 0) {
    markdown += `## ✅ Approved Fixes\n\n`;
    result.finalFixes.forEach((fix, idx) => {
      markdown += `### ${idx + 1}. ${fix.file}:${fix.line}\n`;
      markdown += `**Type**: \`${fix.bug_type}\`\n\n`;
      markdown += `**Error**:\n\`\`\`\n${fix.error_message}\n\`\`\`\n\n`;
      markdown += `**Fix**:\n\`\`\`\n${fix.patch_instructions}\n\`\`\`\n\n`;
      markdown += `**Expected Output**:\n\`\`\`\n${fix.required_dashboard_output}\n\`\`\`\n\n`;
      markdown += `---\n\n`;
    });
  }

  if (
    result.verifiedPatches.filter((v) => v.verification_status === "REJECTED")
      .length > 0
  ) {
    markdown += `## ❌ Rejected Patches\n\n`;
    result.verifiedPatches
      .filter((v) => v.verification_status === "REJECTED")
      .forEach((patch, idx) => {
        markdown += `${idx + 1}. **${patch.file}:${patch.line}** - ${patch.error_message}\n`;
      });
  }

  return markdown;
}

/**
 * Generate Summary format report
 */
function formatSummaryReport(result) {
  const failuresByType = {};
  result.classifiedFailures.forEach((f) => {
    failuresByType[f.bug_type] = (failuresByType[f.bug_type] || 0) + 1;
  });

  return {
    timestamp: new Date().toISOString(),
    totals: {
      extracted: result.failures.length,
      classified: result.classifiedFailures.length,
      patched: result.generatedPatches.length,
      verified: result.verifiedPatches.length,
      approved: result.finalFixes.length,
    },
    failuresByType,
    approvalRate:
      result.generatedPatches.length > 0
        ? (
            (result.finalFixes.length / result.generatedPatches.length) *
            100
          ).toFixed(2) + "%"
        : "N/A",
    approvedFixes: result.finalFixes.map((f) => ({
      file: f.file,
      line: f.line,
      type: f.bug_type,
    })),
  };
}

/**
 * Calculate fix priority based on bug type
 */
function calculatePriority(bugType) {
  const priorities = {
    SYNTAX: "CRITICAL",
    TYPE_ERROR: "HIGH",
    IMPORT: "HIGH",
    RUNTIME: "CRITICAL",
    LOGIC: "HIGH",
    CONFIG: "MEDIUM",
    INDENTATION: "LOW",
    LINTING: "LOW",
  };
  return priorities[bugType] || "MEDIUM";
}

/**
 * Integration with existing test runner
 * Call this after getting test results from Docker
 */
async function processTestResults(testResults) {
  if (!testResults.success) {
    console.log("🔍 Tests failed. Starting autoheal workflow...\n");

    const healingResult = await healTestErrors(
      testResults.stdout + "\n" + (testResults.stderr || ""),
      {
        verbose: true,
        autoApply: false,
        reportFormat: "json",
      },
    );

    return {
      ...testResults,
      healingAttempt: healingResult,
      healed: healingResult.success && healingResult.statistics.approved > 0,
    };
  }

  return testResults;
}

// ===========================
// 📤 Export Functions
// ===========================

module.exports = {
  healTestErrors,
  processTestResults,
  formatReport,
  calculatePriority,
};
