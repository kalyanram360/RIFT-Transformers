/**
 * Patch Applicator Service
 *
 * Automatically applies approved fixes to files in Docker container
 * and re-runs tests to verify improvements
 */

const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

// ===========================
// 🔧 Apply Patches to Container
// ===========================

/**
 * Apply approved fixes to files in Docker container
 */
async function applyFixesToContainer(containerName, fixes) {
  console.log(
    `\n🔧 [APPLY] Applying ${fixes.length} fixes to container ${containerName}...`,
  );

  const results = [];

  for (const fix of fixes) {
    try {
      console.log(`\n📝 Applying fix to ${fix.file}:${fix.line}`);
      console.log(`   Fix: ${fix.patch_instructions}`);

      // Parse the patch instructions
      const patchResult = await executePatchInstruction(
        containerName,
        fix.file,
        fix.patch_instructions,
      );

      results.push({
        file: fix.file,
        line: fix.line,
        status: "APPLIED",
        output: patchResult,
        timestamp: new Date().toISOString(),
      });

      console.log(`   ✅ Applied successfully`);
    } catch (error) {
      console.error(`   ❌ Failed to apply: ${error.message}`);
      results.push({
        file: fix.file,
        line: fix.line,
        status: "FAILED",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const successful = results.filter((r) => r.status === "APPLIED").length;
  console.log(`\n✅ Applied ${successful}/${fixes.length} fixes`);

  return {
    success: successful > 0,
    appliedCount: successful,
    totalCount: fixes.length,
    results: results,
  };
}

/**
 * Execute individual patch instruction
 * Handles different fix types (code replacement, command execution, etc.)
 */
async function executePatchInstruction(containerName, filePath, instruction) {
  // Check if it's a code replacement (contains "→" or "replace")
  if (
    instruction.includes("→") ||
    instruction.toLowerCase().includes("replace")
  ) {
    return await applyCodePatch(containerName, filePath, instruction);
  }

  // Otherwise, treat as shell command
  return await executeShellCommand(containerName, instruction);
}

/**
 * Apply code patch (find and replace)
 */
async function applyCodePatch(containerName, filePath, instruction) {
  try {
    // Parse: "old code → new code"
    const parts = instruction.split("→").map((s) => s.trim());

    if (parts.length !== 2) {
      throw new Error("Invalid patch format. Expected: 'old_code → new_code'");
    }

    const [oldCode, newCode] = parts;

    // Escape special characters for shell
    const escapedOld = oldCode.replace(/'/g, "'\\''");
    const escapedNew = newCode.replace(/'/g, "'\\''");

    // Use sed to replace in container
    const cmd = `docker exec ${containerName} sed -i "s/'${escapedOld}'/'${escapedNew}'/g" ${filePath}`;

    const { stdout, stderr } = await execPromise(cmd, { timeout: 30000 });

    if (stderr && !stderr.includes("warning")) {
      throw new Error(`sed error: ${stderr}`);
    }

    return `Code replaced in ${filePath}`;
  } catch (error) {
    throw new Error(`Code patch failed: ${error.message}`);
  }
}

/**
 * Execute shell command in container
 */
async function executeShellCommand(containerName, command) {
  try {
    const { stdout, stderr } = await execPromise(
      `docker exec ${containerName} ${command}`,
      { timeout: 30000 },
    );

    return stdout || stderr || "Command executed";
  } catch (error) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

/**
 * Re-run tests after applying fixes
 */
async function reRunTests(containerName, workDir) {
  console.log(`\n🧪 [RE-TEST] Re-running tests in ${containerName}...`);

  try {
    // Detect test command from config file
    const testCommand = await detectTestCommand(containerName, workDir);

    console.log(`   Running: ${testCommand}`);

    const { stdout, stderr } = await execPromise(
      `docker exec ${containerName} bash -c "cd ${workDir} && ${testCommand}"`,
      { timeout: 120000 },
    );

    const success = !stderr.includes("failed") && !stdout.includes("failed");

    console.log(
      `   ${success ? "✅" : "❌"} Tests ${success ? "passed" : "failed"}`,
    );

    return {
      success: success,
      stdout: stdout,
      stderr: stderr,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`   ❌ Test execution error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Detect test command from package.json or other config files
 */
async function detectTestCommand(containerName, workDir) {
  try {
    // Try package.json first
    const { stdout } = await execPromise(
      `docker exec ${containerName} cat ${workDir}/package.json`,
      { timeout: 10000 },
    );

    const packageJson = JSON.parse(stdout);
    return packageJson.scripts?.test || "npm test";
  } catch (error) {
    // Fallback to npm test
    return "npm test";
  }
}

/**
 * Compare test results before and after
 */
function compareTestResults(beforeResults, afterResults) {
  console.log(`\n📊 [COMPARISON] Test Results Before vs After\n`);

  const beforeFailed =
    (beforeResults.stdout || "").match(/failed|error/gi)?.length || 0;
  const afterFailed =
    (afterResults.stdout || "").match(/failed|error/gi)?.length || 0;

  const improvement = beforeFailed - afterFailed;
  const improved = improvement > 0;

  console.log(`   Before: ${beforeFailed} errors`);
  console.log(`   After:  ${afterFailed} errors`);
  console.log(
    `   Change: ${improved ? "✅ " : "❌ "}${improvement > 0 ? "-" : "+"}${Math.abs(improvement)}`,
  );

  return {
    before: beforeFailed,
    after: afterFailed,
    improved: improved,
    improvement: improvement,
    assessmentReport: {
      initialFailures: beforeFailed,
      finalFailures: afterFailed,
      fixesSuccessful: improved,
      successRate:
        beforeFailed > 0
          ? ((improvement / beforeFailed) * 100).toFixed(2) + "%"
          : "N/A",
    },
  };
}

/**
 * Full workflow: Apply fixes and verify
 */
async function applyFixesAndVerify(
  containerName,
  workDir,
  fixes,
  beforeTestResults,
) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🚀 [PATCH & VERIFY] Starting automatic fix application`);
  console.log(`${"=".repeat(70)}`);

  // Step 1: Apply patches
  const applyResult = await applyFixesToContainer(containerName, fixes);

  if (!applyResult.success) {
    console.log(
      `\n⚠️  No fixes were applied successfully. Skipping test re-run.`,
    );
    return {
      success: false,
      applied: applyResult,
      tested: null,
      comparison: null,
    };
  }

  // Step 2: Re-run tests
  const afterTestResults = await reRunTests(containerName, workDir);

  // Step 3: Compare results
  const comparison = compareTestResults(beforeTestResults, afterTestResults);

  console.log(`\n${"=".repeat(70)}`);
  console.log(
    `${comparison.improved ? "✅ SUCCESS" : "❌ NO IMPROVEMENT"}: Fixes ${comparison.improved ? "resolved" : "did not resolve"} ${Math.abs(comparison.improvement)} errors`,
  );
  console.log(`${"=".repeat(70)}\n`);

  return {
    success: comparison.improved,
    applied: applyResult,
    tested: afterTestResults,
    comparison: comparison,
    recommendation: comparison.improved
      ? "✅ Fixes are working! Consider committing these changes."
      : "❌ Fixes did not improve test results. May need manual review.",
  };
}

/**
 * Rollback applied changes (git undo)
 */
async function rollbackChanges(containerName, workDir) {
  console.log(`\n⏮️  [ROLLBACK] Reverting applied changes...`);

  try {
    await execPromise(
      `docker exec ${containerName} bash -c "cd ${workDir} && git checkout ."`,
      { timeout: 30000 },
    );

    console.log(`   ✅ Rolled back to last commit`);
    return { success: true };
  } catch (error) {
    console.log(`   ⚠️  Rollback failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Commit changes to git
 */
async function commitChanges(containerName, workDir, message) {
  console.log(`\n📝 [COMMIT] Committing fixes with message: "${message}"`);

  try {
    await execPromise(
      `docker exec ${containerName} bash -c "cd ${workDir} && git add -A && git commit -m '${message}'"`,
      { timeout: 30000 },
    );

    console.log(`   ✅ Changes committed`);
    return { success: true };
  } catch (error) {
    console.log(`   ⚠️  Commit failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ===========================
// 📤 Export Functions
// ===========================

module.exports = {
  applyFixesToContainer,
  reRunTests,
  compareTestResults,
  applyFixesAndVerify,
  rollbackChanges,
  commitChanges,
  detectTestCommand,
  executePatchInstruction,
};
