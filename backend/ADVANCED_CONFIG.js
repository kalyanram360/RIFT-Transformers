/**
 * 🔧 Advanced Configuration Guide
 *
 * Customize the multi-agent healing system for your specific needs
 */

// ===========================
// 1. ENVIRONMENT VARIABLES
// ===========================

// Create a .env.production file with:
/*
OPENAI_API_KEY=sk-... (your production key)
NODE_ENV=production
LOG_LEVEL=info
HEALING_TIMEOUT=60000
HEALING_MAX_RETRIES=3
HEALING_PARALLEL_LIMIT=5
OPENAI_MODEL_EXTRACT=gpt-4o-mini
OPENAI_MODEL_CLASSIFY=gpt-4o-mini
OPENAI_MODEL_PATCH=gpt-4
OPENAI_MODEL_VERIFY=gpt-4o-mini
OPENAI_TEMP_EXTRACT=0
OPENAI_TEMP_CLASSIFY=0
OPENAI_TEMP_PATCH=0
OPENAI_TEMP_VERIFY=0
OPENAI_TOKENS_EXTRACT=2000
OPENAI_TOKENS_CLASSIFY=1000
OPENAI_TOKENS_PATCH=3000
OPENAI_TOKENS_VERIFY=500
*/

// ===========================
// 2. CUSTOMIZE MODELS
// ===========================

const { ChatOpenAI } = require("@langchain/openai");

// Use environment variables for model configuration:

const extractorModel = new ChatOpenAI({
  model: process.env.OPENAI_MODEL_EXTRACT || "gpt-4o-mini",
  temperature: parseFloat(process.env.OPENAI_TEMP_EXTRACT || "0"),
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: parseInt(process.env.OPENAI_TOKENS_EXTRACT || "2000"),
});

// Or use environment-specific configs:

function getModelConfig(environment = process.env.NODE_ENV) {
  switch (environment) {
    case "production":
      return {
        // Use fast, cheap models in production
        extractor: "gpt-4o-mini",
        classifier: "gpt-4o-mini",
        patcher: "gpt-4", // Still need stronger model for patches
        verifier: "gpt-4o-mini",
      };
    case "staging":
      return {
        // Balance cost and quality
        extractor: "gpt-4o-mini",
        classifier: "gpt-4o-mini",
        patcher: "gpt-4", // Can afford stronger model
        verifier: "gpt-4o-mini",
      };
    case "development":
      return {
        // Use strongest models for best results
        extractor: "gpt-4o",
        classifier: "gpt-4o-mini",
        patcher: "gpt-4", // Best for complex fixes
        verifier: "gpt-4o-mini",
      };
    default:
      return {
        extractor: "gpt-4o-mini",
        classifier: "gpt-4o-mini",
        patcher: "gpt-4",
        verifier: "gpt-4o-mini",
      };
  }
}

// ===========================
// 3. CUSTOMIZE PROMPTS
// ===========================

const customPrompts = {
  // Override extraction prompt for your domain
  extract: `You are a Custom Error Extractor for Node.js applications.

Extract ONLY runtime/test errors from logs.

Ignore: warnings, deprecation notices, info logs

Return JSON:
[
  {
    "file": "path/to/file.js",
    "line": number,
    "error_message": "exact error message",
    "severity": "critical|high|medium|low"
  }
]`,

  // Override classification categories
  classify: `Classify this error:

Categories:
1. DATABASE - Database connection/query errors
2. API - HTTP/REST API errors
3. VALIDATION - Input validation errors
4. AUTH - Authentication/authorization errors
5. ASYNC - Promise/async/await errors
6. DEPENDENCY - Missing/broken dependencies
7. CONFIG - Configuration/environment errors
8. OTHER - Other errors

Error: {error}
Return: ONLY the category name`,

  // Override patch generation prompts
  patch: `You are an Expert Node.js Bug Fixer.

Generate fixes for Node.js/Express errors.
Be minimal and specific.

Error: {error}
File: {file}
Type: {type}

Return JSON:
{
  "patch_instructions": "exact fix",
  "code_change": "{old_code} → {new_code}",
  "explanation": "why this fixes it"
}`,

  // Override verification prompts
  verify: `Verify this fix is safe for {environment}.

Check:
- Doesn't introduce new bugs
- Fixes the stated issue
- Minimal change
- No breaking changes

Patch: {patch}

Return: APPROVED or REJECTED`,
};

// ===========================
// 4. CUSTOMIZE ERROR CATEGORIES
// ===========================

const errorCategories = {
  // Add your custom categories
  DATABASE: {
    keywords: ["connection", "query", "database"],
    priority: "high",
    template: "Database issue",
  },
  API: {
    keywords: ["http", "fetch", "request", "endpoint"],
    priority: "high",
    template: "API error",
  },
  VALIDATION: {
    keywords: ["validate", "invalid", "required field"],
    priority: "medium",
    template: "Validation error",
  },
  AUTH: {
    keywords: ["auth", "permission", "forbidden", "unauthorized"],
    priority: "critical",
    template: "Auth error",
  },
  ASYNC: {
    keywords: ["promise", "async", "await", "callback"],
    priority: "high",
    template: "Async error",
  },
  DEPENDENCY: {
    keywords: ["module", "require", "import", "not found"],
    priority: "high",
    template: "Dependency error",
  },
};

// ===========================
// 5. CUSTOM PRIORITY RULES
// ===========================

function calculateCustomPriority(error) {
  const { bug_type, file, error_message } = error;

  // Custom priority logic
  if (error_message.includes("CRITICAL")) return "CRITICAL";
  if (error_message.includes("SECURITY")) return "CRITICAL";
  if (bug_type === "AUTH") return "CRITICAL";
  if (file.includes("core")) return "HIGH";
  if (bug_type === "SYNTAX") return "MEDIUM";

  return "LOW";
}

// ===========================
// 6. RATE LIMITING & RETRY
// ===========================

class HealingServiceWithRetry {
  constructor(maxRetries = 3, delayMs = 1000) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
  }

  async retry(fn, context = "operation") {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === this.maxRetries - 1) throw error;

        console.log(`⚠️  ${context} failed, retry ${i + 1}/${this.maxRetries}`);
        await new Promise((r) => setTimeout(r, this.delayMs * (i + 1))); // Exponential backoff
      }
    }
  }

  async healWithRetry(testLogs) {
    return this.retry(
      () => require("./services/healingService").healTestErrors(testLogs),
      "Healing",
    );
  }
}

// Usage:
// const service = new HealingServiceWithRetry(3, 1000);
// const result = await service.healWithRetry(logs);

// ===========================
// 7. CACHING CONFIGURATION
// ===========================

// In-memory cache for common errors
class HealingCache {
  constructor(ttl = 3600000) {
    // 1 hour default
    this.cache = new Map();
    this.ttl = ttl;
  }

  hash(testLogs) {
    const crypto = require("crypto");
    return crypto.createHash("md5").update(testLogs).digest("hex");
  }

  get(testLogs) {
    const key = this.hash(testLogs);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(testLogs, result) {
    const key = this.hash(testLogs);
    this.cache.set(key, {
      value: result,
      expiry: Date.now() + this.ttl,
    });
  }
}

// Usage:
// const cache = new HealingCache();
// let result = cache.get(logs);
// if (!result) {
//   result = await healTestErrors(logs);
//   cache.set(logs, result);
// }

// ===========================
// 8. MONITORING & METRICS
// ===========================

class HealingMetrics {
  constructor() {
    this.metrics = {
      totalRuns: 0,
      totalErrors: 0,
      totalApproved: 0,
      totalTime: 0,
      errorsByType: {},
      agentTimes: {
        extract: [],
        classify: [],
        patch: [],
        verify: [],
      },
    };
  }

  recordRun(result, duration) {
    this.metrics.totalRuns++;
    this.metrics.totalErrors += result.failures.length;
    this.metrics.totalApproved += result.finalFixes.length;
    this.metrics.totalTime += duration;

    // Track errors by type
    result.classifiedFailures.forEach((f) => {
      this.metrics.errorsByType[f.bug_type] =
        (this.metrics.errorsByType[f.bug_type] || 0) + 1;
    });
  }

  recordAgentTime(agent, duration) {
    this.metrics.agentTimes[agent].push(duration);
  }

  getStatistics() {
    return {
      totalRuns: this.metrics.totalRuns,
      avgErrorsPerRun: (
        this.metrics.totalErrors / this.metrics.totalRuns || 0
      ).toFixed(2),
      approvalRate:
        (
          (this.metrics.totalApproved / this.metrics.totalErrors) * 100 || 0
        ).toFixed(2) + "%",
      avgTimePerRun:
        (this.metrics.totalTime / this.metrics.totalRuns || 0).toFixed(2) +
        "ms",
      errorsByType: this.metrics.errorsByType,
      agentPerformance: this.getAgentStats(),
    };
  }

  getAgentStats() {
    return Object.keys(this.metrics.agentTimes).reduce((acc, agent) => {
      const times = this.metrics.agentTimes[agent];
      if (times.length === 0) return acc;

      acc[agent] = {
        calls: times.length,
        avgTime:
          (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) + "ms",
        minTime: Math.min(...times).toFixed(2) + "ms",
        maxTime: Math.max(...times).toFixed(2) + "ms",
      };
      return acc;
    }, {});
  }
}

// ===========================
// 9. CUSTOM AGENT NODES
// ===========================

// Add a custom filter before healing
async function filterNode(state) {
  // Skip healing for certain errors
  const filtered = state.failures.filter(
    (f) => !f.error_message.includes("skip-healing"),
  );

  return { ...state, failures: filtered };
}

// Add notification after completion
async function notifyNode(state) {
  if (state.finalFixes.length > 0) {
    console.log("📧 Sending notification about approved fixes...");
    // Send email/Slack notification
  }
  return state;
}

// ===========================
// 10. DATABASE INTEGRATION
// ===========================

// Store healing history in database
class HealingRepository {
  constructor(db) {
    this.db = db;
  }

  async saveHealingRun(result) {
    const run = {
      timestamp: new Date(),
      totalErrors: result.failures.length,
      approved: result.finalFixes.length,
      approvalRate: (
        (result.finalFixes.length / result.failures.length) *
        100
      ).toFixed(2),
      errors: result.failures,
      approvedFixes: result.finalFixes,
    };

    return this.db.collection("healing_runs").insertOne(run);
  }

  async getHealingHistory(limit = 10) {
    return this.db
      .collection("healing_runs")
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async getErrorStats() {
    return this.db
      .collection("healing_runs")
      .aggregate([
        {
          $group: {
            _id: null,
            totalRuns: { $sum: 1 },
            totalErrors: { $sum: "$totalErrors" },
            totalApproved: { $sum: "$approved" },
            avgApprovalRate: { $avg: "$approvalRate" },
          },
        },
      ])
      .toArray();
  }
}

// ===========================
// 11. PERFORMANCE TUNING
// ===========================

const performanceConfig = {
  // Reduce API calls
  cacheSimilarErrors: true,
  cacheExpiry: 3600000, // 1 hour

  // Parallel limits
  maxParallelClassify: 5,
  maxParallelPatch: 3, // GPT-4 is slower
  maxParallelVerify: 5,

  // Timeout settings
  extractTimeout: 10000,
  classifyTimeout: 15000,
  patchTimeout: 30000,
  verifyTimeout: 10000,

  // Cost optimization
  skipVerificationForSimpleErrors: true,
  batchSimilarErrors: true,
  useFastModelForSimple: true,
};

// ===========================
// 12. EXPORT
// ===========================

module.exports = {
  getModelConfig,
  customPrompts,
  errorCategories,
  calculateCustomPriority,
  HealingServiceWithRetry,
  HealingCache,
  HealingMetrics,
  HealingRepository,
  performanceConfig,
};

/*
 * USAGE EXAMPLE:
 *
 * const config = require('./advancedConfig');
 * const metrics = new config.HealingMetrics();
 * const cache = new config.HealingCache();
 *
 * const start = Date.now();
 * let result = cache.get(logs);
 *
 * if (!result) {
 *   result = await healTestErrors(logs);
 *   cache.set(logs, result);
 * }
 *
 * metrics.recordRun(result, Date.now() - start);
 * console.log(metrics.getStatistics());
 */
