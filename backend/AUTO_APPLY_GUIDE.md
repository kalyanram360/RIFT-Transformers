# 🔄 Auto-Apply Fixes - Feature Guide

**Status**: ✅ Fully Implemented  
**Version**: 1.0  
**Last Updated**: February 20, 2026

---

## 🎯 What is Auto-Apply?

Auto-apply automatically applies approved test fixes to your Docker container, re-runs tests to verify they work, and optionally commits the changes to git.

### The Flow

```
Test Fails
    ↓
Extract Errors → Classify → Patch → Verify
    ↓
Approved Fixes
    ↓
[AUTO-APPLY] Apply to container
    ↓
Re-run Tests
    ↓
Compare Results
    ↓
✅ Improved? → Commit Changes
❌ Not improved? → Show Recommendation
```

---

## 📋 How to Use

### 1. **Basic Auto-Apply via API**

```bash
curl -X POST http://localhost:5001/api/healing/heal \
  -H "Content-Type: application/json" \
  -d '{
    "testLogs": "FAIL src/test.js\n...",
    "options": {
      "autoApply": true,
      "containerName": "my-app",
      "workDir": "/app",
      "commitMessage": "Auto-fix test errors"
    }
  }'
```

### 2. **Programmatic Usage**

```javascript
const { healTestErrors } = require("./services/healingService");

const result = await healTestErrors(testLogs, {
  autoApply: true, // Enable auto-apply
  containerName: "my-container", // Docker container ID
  workDir: "/app", // Working directory in container
  commitMessage: "Fix tests", // Git commit message (optional)
  reportFormat: "json",
});

if (result.fixesApplied) {
  console.log("✅ Fixes applied successfully!");
  console.log(result.autoApplyResult);
} else {
  console.log("❌ Fixes not applied");
}
```

### 3. **Via Run-and-Heal Endpoint**

```bash
curl -X POST http://localhost:5001/api/healing/run-and-heal \
  -H "Content-Type: application/json" \
  -d '{
    "testCommand": "npm test",
    "containerName": "my-app",
    "workDir": "/app",
    "autoApplyFixes": true,
    "commitMessage": "Auto-fix from test runner"
  }'
```

---

## 🔧 Configuration Options

### Required (for auto-apply)

```javascript
{
  autoApply: true,              // Enable auto-apply
  containerName: "container-id", // Docker container name
  workDir: "/app"               // App directory in container
}
```

### Optional

```javascript
{
  commitMessage: "Fix test errors", // Git commit message
  reportFormat: "json"              // json, markdown, or summary
}
```

---

## 📊 Response Structure

### Success Response

```json
{
  "success": true,
  "message": "Successfully processed 3 failures",
  "statistics": {
    "approved": 3
  },
  "fixesApplied": true,
  "autoApplyResult": {
    "success": true,
    "applied": {
      "success": true,
      "appliedCount": 3
    },
    "tested": {
      "success": true,
      "stdout": "...test output..."
    },
    "comparison": {
      "improved": true,
      "improvement": 3
    },
    "recommendation": "✅ Fixes are working! Consider committing..."
  },
  "commitResult": {
    "success": true
  }
}
```

### What Each Part Means

- **`fixesApplied`**: true if at least one fix was successfully applied
- **`autoApplyResult.applied`**: Details of patch application
- **`autoApplyResult.tested`**: Test results after applying fixes
- **`autoApplyResult.comparison`**: Before/after comparison
- **`commitResult`**: Git commit result (if enabled)

---

## 🔍 How Patches Are Applied

### 1. **Code Replacement** (for code fixes)

If patch contains `→` or "replace":

```
Old: "const x = undefined" → "const x = null"
```

Uses `sed` to find and replace in files:

```bash
docker exec container-id sed -i "s/old/new/g" /path/to/file
```

### 2. **Command Execution** (for config/install fixes)

If patch is a command:

```
npm install missing-package
```

Executes directly in container:

```bash
docker exec container-id npm install missing-package
```

---

## ✅ Verification Process

After applying fixes, the system:

1. **Re-runs tests** - Executes the test command in the container
2. **Compares results** - Checks if error count decreased
3. **Reports findings** - Shows improvement percentage
4. **Optionally commits** - Commits if specified

---

## 📈 Performance

```
Extract:      2-3s   (serial, parse logs)
Classify:     3-5s   (parallel, categorize)
Patch:       10-15s  (parallel, generate fixes)
Verify:       5-8s   (parallel, validate)
Apply:        5-10s  (serial, apply to container)
Re-test:     30-60s  (variable, depends on test suite)
─────────────────────────────────────────
Total:       60-110s (with auto-apply)
```

---

## 🛡️ Safety Features

### 1. **Approval Before Application**

Fixes must be approved by the verification agent before auto-apply runs.

### 2. **Verification After Application**

Tests are re-run after applying fixes to ensure they actually work.

### 3. **Improvement Checking**

Only commits if tests actually improved (fewer errors).

### 4. **Rollback Support**

```javascript
const { rollbackChanges } = require("./services/patchApplicator");

await rollbackChanges(containerName, workDir);
// Reverts all changes using: git checkout .
```

---

## 🐛 Troubleshooting

### Issue: `autoApplyResult is null`

**Cause**: autoApply was false or no approved fixes.

**Solution**: Set `autoApply: true` and ensure fixes are being approved.

### Issue: Patches applied but tests still fail

**Cause**: Fixes may not address all issues or be incorrectly applied.

**Possible Solutions**:

- Check patch instructions are correct
- Verify container has access to files
- Check git status in container: `docker exec container-id git status`

### Issue: `Container not found error`

**Cause**: Wrong container name provided.

**Solution**: Get correct container ID:

```bash
docker ps  # List running containers
```

### Issue: `Permission denied` when applying patches

**Cause**: Container user doesn't have write access to files.

**Solution**: Run container with proper user permissions or use root.

---

## 🎯 Example Scenarios

### Scenario 1: Auto-Heal Missing Dependencies

```javascript
const testLogs = `
Error: Cannot find module 'lodash'
  at Module._resolve...
`;

const result = await healTestErrors(testLogs, {
  autoApply: true,
  containerName: "app",
  workDir: "/app",
  commitMessage: "Install missing dependencies",
});

// System will:
// 1. Generate: "npm install lodash"
// 2. Apply it to container
// 3. Re-run tests
// 4. Commit if successful
```

### Scenario 2: Auto-Fix Syntax Errors

```javascript
const testLogs = `
ParserError: Unexpected token "}" at line 42
`;

const result = await healTestErrors(testLogs, {
  autoApply: true,
  containerName: "api",
  workDir: "/api",
  commitMessage: "Fix syntax errors",
});

// System will:
// 1. Generate code fix
// 2. Apply using sed
// 3. Re-run tests
// 4. Verify and commit
```

### Scenario 3: Batch Fix Multiple Errors

```javascript
const testLogs = `
Error 1: Cannot find module 'express'
Error 2: TypeError: obj is not defined
Error 3: ReferenceError: config is not initialized
`;

const result = await healTestErrors(testLogs, {
  autoApply: true,
  containerName: "service",
  workDir: "/service",
});

// System will:
// 1. Identify 3 errors
// 2. Generate 3 fixes
// 3. Verify all 3
// 4. Apply all 3 in sequence
// 5. Re-run tests once
// 6. Report overall improvement
```

---

## 🔗 API Endpoints

### POST `/api/healing/heal`

Manually trigger healing with auto-apply option.

### POST `/api/healing/run-and-heal`

Run tests automatically and apply fixes if autoApplyFixes=true.

---

## 📝 Git Integration

If `commitMessage` is provided, changes are committed with:

```bash
docker exec container-id bash -c "
  cd /workdir && \
  git add -A && \
  git commit -m 'your-message'
"
```

Check gi status:

```bash
docker exec container-id bash -c "cd /workdir && git log --oneline -5"
```

---

## 🚨 Important Notes

1. **Requires Git**: Container must have git initialized and configured
2. **File Permissions**: Container user must have write access to files
3. **Test Speed**: Re-running tests takes time, especially for large suites
4. **No Rollback Auto**: If tests still fail, you must manually rollback
5. **One Container**: Currently applies fixes to one container at a time

---

## 🔮 Future Enhancements

- [ ] Batch multiple container support
- [ ] Automatic rollback on test failure
- [ ] Database persistence of fixes applied
- [ ] Performance metrics tracking
- [ ] Custom patch validation hooks
- [ ] Parallel container patching
- [ ] Web UI for monitoring

---

## 📚 Related Files

- **patchApplicator.js** - Core patching logic
- **healingService.js** - High-level API (updated)
- **healingController.js** - HTTP endpoints (updated)
- **agentGraphExamples.js** - Example 6: Auto-Apply

---

**Status**: 🟢 Ready for Production  
**Support**: See troubleshooting section or check logs
