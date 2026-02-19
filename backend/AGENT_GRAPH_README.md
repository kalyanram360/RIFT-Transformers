# 🤖 Multi-Agent Test Error Healing System

A powerful LangChain-based multi-agent system that automatically extracts, classifies, patches, and verifies test failures using parallel processing and multi-model orchestration.

## 🎯 Overview

This system uses a **State Graph** with specialized agents running in parallel:

```
Test Logs
   ↓
[EXTRACT] → Identifies all failures
   ↓
[CLASSIFY] → Categorizes by error type (parallel)
   ↓
[PATCH] → Generates fixes (parallel)
   ↓
[VERIFY] → Validates fixes (parallel)
   ↓
Approved Fixes → Ready for Application
```

## ✨ Features

✅ **Multi-Agent Architecture**: 4 specialized agents (Extract, Classify, Patch, Verify)
✅ **Parallel Processing**: Classify, patch, and verify errors concurrently
✅ **Multi-Model**: Uses GPT-4 for complex fixes, GPT-4o-mini for fast classification
✅ **Structured State**: Zod-validated state management
✅ **Error Classification**: 8 error types (SYNTAX, LOGIC, TYPE_ERROR, IMPORT, etc.)
✅ **Multiple Report Formats**: JSON, Markdown, Summary
✅ **Auto-Healing**: Integrates with test runner for automatic error recovery

## 🚀 Installation

```bash
cd backend
npm install @langchain/openai @langchain/langgraph zod
```

## 📋 Environment Setup

Add to your `.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## 💻 Usage

### Basic Usage

```javascript
const { healTestErrors } = require("./services/healingService");

const testLogs = `
FAIL src/users.test.js
  ✗ should create user
    TypeError: Cannot read properties of undefined (reading 'email')
      at userController.js:42:15
`;

const result = await healTestErrors(testLogs);
console.log(result.statistics);
// Output:
// {
//   totalFailures: 1,
//   classified: 1,
//   patched: 1,
//   verified: 1,
//   approved: 1,
//   approvalRate: "100%"
// }
```

### With Options

```javascript
const result = await healTestErrors(testLogs, {
  verbose: true,
  autoApply: false,
  reportFormat: "markdown",
});

console.log(result.report); // Markdown formatted report
```

### Get Report Formats

```javascript
// JSON Format
const jsonReport = result.report; // Structured JSON

// Markdown Format
const markdownReport = await healTestErrors(testLogs, {
  reportFormat: "markdown",
});
console.log(markdownReport.report);

// Summary Format
const summary = await healTestErrors(testLogs, {
  reportFormat: "summary",
});
```

## 🧠 Agent Details

### 1. Extract Agent

- **Model**: GPT-4o-mini
- **Task**: Parse test logs and identify failures
- **Output**: List of failures with file, line, and error message

**Prompt Strategy**: Direct JSON extraction with format validation

```
Extract structured failures from logs.
Return JSON array: [{file, line, error_message}]
```

### 2. Classify Agent

- **Model**: GPT-4o-mini
- **Task**: Categorize each failure by type
- **Output**: Classified failures with bug_type

**Categories**:

- `SYNTAX` - Parsing/code structure errors
- `TYPE_ERROR` - Type mismatches, undefined variables
- `LOGIC` - Incorrect algorithm/implementation
- `IMPORT` - Missing modules or wrong paths
- `LINTING` - Code style/formatting
- `INDENTATION` - Tab/whitespace issues
- `RUNTIME` - Execution errors
- `CONFIG` - Configuration issues

### 3. Patch Agent

- **Model**: GPT-4
- **Task**: Generate minimal fixes
- **Output**: Patch instructions and expected output

**Uses**: Stronger model for complex fixes
**Strategy**: Minimal, direct fixes only

```
Fix this error minimally.
Return JSON: {patch_instructions, required_dashboard_output}
```

### 4. Verify Agent

- **Model**: GPT-4o-mini
- **Task**: Validate patch correctness
- **Output**: APPROVED or REJECTED status

**Validation Criteria**:

- Minimal (only fixes identified issue)
- Correct (actually solves problem)
- Safe (doesn't introduce new issues)

## 📊 Result Structure

```javascript
{
  success: boolean,
  message: string,
  statistics: {
    totalFailures: number,
    classified: number,
    patched: number,
    verified: number,
    approved: number,
    approvalRate: string
  },
  results: {
    failures: [{file, line, error_message}],
    classifiedFailures: [{...failure, bug_type}],
    generatedPatches: [{...failure, patch_instructions, required_dashboard_output}],
    verifiedPatches: [{...failure, verification_status}],
    finalFixes: [approved patches]
  },
  report: string | object,
  timestamp: ISO string
}
```

## 🔄 Integration with Test Runner

### Automatic Healing After Tests

```javascript
const { processTestResults } = require("./services/healingService");

// After running tests
const testResults = {
  success: false,
  stdout: "FAIL src/test.js\n  ✗ test name\n    Error: ...",
  stderr: "npm ERR! ...",
};

const healed = await processTestResults(testResults);

if (healed.healed) {
  console.log("✅ Found and approved fixes:");
  healed.healingAttempt.results.finalFixes.forEach((fix) => {
    console.log(`- ${fix.file}:${fix.line}: ${fix.patch_instructions}`);
  });
}
```

## 📝 Examples

Run the examples file:

```bash
# Enable in agentGraphExamples.js then:
node backend/examples/agentGraphExamples.js
```

Available examples:

1. **Simple Usage** - Basic healing workflow
2. **With Reporting** - Generate different report formats
3. **Direct Graph Usage** - Invoke graph directly
4. **Test Integration** - Process test results
5. **Batch Processing** - Handle multiple test sessions

## 🎛️ Configuration

### Model Selection

Edit `agentGraph.js` to change models:

```javascript
const extractorModel = new ChatOpenAI({
  model: "gpt-4o-mini", // Change here
  temperature: 0,
  maxTokens: 2000,
});
```

### Custom Prompts

Modify prompts in each node function:

```javascript
const prompt = `
Your custom prompt here
${state.logs}
`;
```

### Parallel Processing Control

All Classify, Patch, and Verify operations use `Promise.all()` for parallelization. Adjust timeout as needed:

```javascript
Promise.race([
  Promise.all(classificationPromises),
  timeout(30000), // 30 second timeout
]);
```

## 🔐 Security Considerations

- **API Keys**: Store in `.env`, never commit
- **Rate Limiting**: Implement in production
- **Cost Control**: Monitor OpenAI API usage
- **Auto-Apply**: Disable by default, review fixes before applying
- **Validation**: All AI responses are parsed/validated

## 📈 Performance Metrics

Typical performance (with parallel processing):

```
Task                  Time        Model
─────────────────────────────────────────
Extract (100 logs)    2-3s        GPT-4o-mini
Classify (10 errors)  3-5s        GPT-4o-mini (parallel)
Patch (10 errors)     10-15s      GPT-4 (parallel)
Verify (10 patches)   5-8s        GPT-4o-mini (parallel)
─────────────────────────────────────────
Total                 20-30s      (vs 60-80s sequential)
```

## 🐛 Troubleshooting

### Issue: "Cannot read properties of undefined"

```
Error: Cannot read properties of undefined (reading 'invoke')
```

**Solution**: Ensure OpenAI API key is set in `.env`

```env
OPENAI_API_KEY=sk-...
```

### Issue: JSON Parse Error

```
SyntaxError: Unexpected token in JSON
```

**Solution**: Model may return markdown code blocks. The code already handles this:

````javascript
content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
````

### Issue: No Failures Extracted

Ensure logs are properly formatted and test output is included:

```javascript
const logs = stdout + "\n" + stderr; // Combine both
await healTestErrors(logs);
```

### Issue: Low Approval Rate

Patches may be too complex. Try:

- Simpler test cases first
- Increase `maxTokens` for patch model
- Use more specific error descriptions

## 🚀 Advanced Usage

### Custom Agent Node

```javascript
async function customNode(state) {
  // Your logic
  return {
    ...state,
    newField: value,
  };
}

workflow.addNode("custom", customNode);
```

### Conditional Routing

```javascript
function routingLogic(state) {
  if (state.finalFixes.length > 5) {
    return "alert_team";
  }
  return "auto_apply";
}

workflow.addConditionalEdges("verify", routingLogic, {
  alert_team: "notification_node",
  auto_apply: "apply_node",
});
```

## 📚 State Graph Architecture

```
┌─────────────────┐
│  Entry Point    │
└────────┬────────┘
         │ logs
         ▼
    ┌─────────┐
    │ EXTRACT │ ◎─────────────┐
    └────┬────┘              │
         │ failures          │
         ▼                   │
    ┌─────────┐              │ State shared
    │ CLASSIFY│ ◎────────────┤ across all
    └────┬────┘              │ agents
         │ classifiedFailures│
         ▼                   │
    ┌─────────┐              │
    │  PATCH  │ ◎────────────┤
    └────┬────┘              │
         │ generatedPatches  │
         ▼                   │
    ┌─────────┐              │
    │ VERIFY  │ ◎────────────┘
    └────┬────┘
         │ finalFixes
         ▼
    ┌────────────────┐
    │ Final Results  │
    └────────────────┘
```

## 📞 Support

For issues or questions:

1. Check logs in console output
2. Verify `.env` configuration
3. Check OpenAI API status
4. Review examples in `agentGraphExamples.js`

## 📄 License

MIT

---

**Built with**: LangChain, LangGraph, OpenAI, Zod
