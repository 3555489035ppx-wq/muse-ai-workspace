import assert from "node:assert/strict";
import { loadServerConfig } from "../server/config.js";
import { DashScopeStructuredProvider } from "../server/providers/dashscope/DashScopeStructuredProvider.js";

if (process.env.MUSE_AI_LIVE_APPROVED !== "true") throw new Error("Set MUSE_AI_LIVE_APPROVED=true only for an explicitly approved paid smoke test.");
const config = loadServerConfig(process.env);
if (!config.liveEnabled || config.killSwitchActive || !config.dashscopeApiKey || !config.dashscopeWorkspaceId) throw new Error("Live smoke requires the server-side provider, live switch, and disabled kill switch.");
if (config.requestBudgetCny > 0.5) throw new Error("Live smoke request budget must be at most CNY 0.50.");
const result = await new DashScopeStructuredProvider(config).complete({ purpose: "research", enableSearch: false, instruction: "只返回 JSON：{\"status\":\"ok\"}" });
assert.equal(result.value.status, "ok");
process.stdout.write(`LIVE_SMOKE_PASS provider=${result.trace.providerId} model=${result.trace.model} costCny=${result.trace.usage.estimatedCostCny.toFixed(4)}\n`);
