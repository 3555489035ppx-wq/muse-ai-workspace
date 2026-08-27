import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4176),
  DASHSCOPE_API_KEY: z.string().trim().optional(),
  DASHSCOPE_WORKSPACE_ID: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  DEEPSEEK_API_KEY: z.string().trim().optional(),
  DEEPSEEK_BASE_URL: z.url().default("https://api.deepseek.com"),
  DEEPSEEK_TEXT_MODEL: z.string().trim().default("deepseek-v4-pro"),
  DEEPSEEK_REASONING_EFFORT: z.enum(["high", "max"]).default("max"),
  TAVILY_API_KEY: z.string().trim().optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  OPENAI_IMAGE_MODEL: z.string().trim().default("gpt-image-2"),
  MUSE_AI_LIVE_ENABLED: z.enum(["true", "false"]).default("false"),
  MUSE_AI_KILL_SWITCH: z.enum(["true", "false"]).default("true"),
  MUSE_AI_ACTOR_ID: z.string().trim().min(3).default("muse-local-experiment"),
  MUSE_AI_ALLOWED_PROJECT_IDS: z.string().default(""),
  MUSE_AI_REQUEST_BUDGET_CNY: z.coerce.number().positive().max(20).default(1),
  MUSE_AI_PROJECT_DAILY_BUDGET_CNY: z.coerce.number().positive().max(100).default(10),
  MUSE_AI_LLM_MODEL: z.string().trim().default("qwen-plus"),
  MUSE_AI_IMAGE_MODEL: z.string().trim().default("wan2.7-image-pro"),
  MUSE_RUNTIME_DIRECTORY: z.string().trim().min(1).default(".muse-runtime"),
  MUSE_SECRET_STORE_KEY: z.string().trim().optional(),
  MUSE_SITE_SEARCH_PROVIDER: z.enum(["tavily"]).default("tavily"),
  MUSE_SITE_SEARCH_API_KEY: z.string().trim().optional(),
  MUSE_SITE_SEARCH_BASE_URL: z.url().default("https://api.tavily.com"),
  MUSE_SITE_SEARCH_MAX_RESULTS: z.coerce.number().int().min(1).max(8).default(5),
});

export interface MuseServerConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly dashscopeApiKey?: string;
  readonly dashscopeWorkspaceId?: string;
  readonly deepseekApiKey?: string;
  readonly deepseekBaseUrl: string;
  readonly deepseekTextModel: string;
  readonly deepseekReasoningEffort: "high" | "max";
  readonly searchProvider: "tavily";
  readonly searchApiKey?: string;
  readonly searchBaseUrl: string;
  readonly searchMaxResults: number;
  readonly openaiApiKey?: string;
  readonly openaiBaseUrl: string;
  readonly openaiImageModel: string;
  readonly liveEnabled: boolean;
  readonly killSwitchActive: boolean;
  readonly actorId: string;
  readonly allowedProjectIds: ReadonlySet<string>;
  readonly requestBudgetCny: number;
  readonly projectDailyBudgetCny: number;
  readonly llmModel: string;
  readonly imageModel: string;
  readonly runtimeDirectory: string;
  readonly secretStoreKey?: string;
}

function loadDotEnvForRuntime(): void {
  if (typeof process.loadEnvFile !== "function") return;
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): MuseServerConfig {
  // Tests and callers can still pass an explicit environment object. The runtime
  // entry point automatically reads the local, gitignored .env file so enabling
  // the BFF does not depend on shell-specific export syntax.
  if (env === process.env) loadDotEnvForRuntime();
  const value = envSchema.parse(env);
  const allowedProjectIds = new Set(value.MUSE_AI_ALLOWED_PROJECT_IDS.split(",").map((item) => item.trim()).filter(Boolean));
  if (value.NODE_ENV === "production" && allowedProjectIds.size === 0) {
    throw new Error("MUSE_AI_ALLOWED_PROJECT_IDS is required in production.");
  }
  const localDevelopmentDefaults = env === process.env && value.NODE_ENV === "development";
  const liveEnabled = value.MUSE_AI_LIVE_ENABLED === "true" || (localDevelopmentDefaults && env.MUSE_AI_LIVE_ENABLED === undefined);
  const killSwitchActive = value.MUSE_AI_KILL_SWITCH === "true" && !(localDevelopmentDefaults && env.MUSE_AI_KILL_SWITCH === undefined);
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    dashscopeApiKey: value.DASHSCOPE_API_KEY === "" ? undefined : value.DASHSCOPE_API_KEY,
    dashscopeWorkspaceId: value.DASHSCOPE_WORKSPACE_ID === "" ? undefined : value.DASHSCOPE_WORKSPACE_ID,
    deepseekApiKey: value.DEEPSEEK_API_KEY === "" ? undefined : value.DEEPSEEK_API_KEY,
    deepseekBaseUrl: value.DEEPSEEK_BASE_URL.replace(/\/$/, ""),
    deepseekTextModel: value.DEEPSEEK_TEXT_MODEL,
    deepseekReasoningEffort: value.DEEPSEEK_REASONING_EFFORT,
    searchProvider: value.MUSE_SITE_SEARCH_PROVIDER,
    searchApiKey: value.MUSE_SITE_SEARCH_API_KEY?.trim() ? value.MUSE_SITE_SEARCH_API_KEY : value.TAVILY_API_KEY?.trim() ? value.TAVILY_API_KEY : undefined,
    searchBaseUrl: value.MUSE_SITE_SEARCH_BASE_URL.replace(/\/$/, ""),
    searchMaxResults: value.MUSE_SITE_SEARCH_MAX_RESULTS,
    openaiApiKey: value.OPENAI_API_KEY === "" ? undefined : value.OPENAI_API_KEY,
    openaiBaseUrl: value.OPENAI_BASE_URL.replace(/\/$/, ""),
    openaiImageModel: value.OPENAI_IMAGE_MODEL,
    liveEnabled,
    killSwitchActive,
    actorId: value.MUSE_AI_ACTOR_ID,
    allowedProjectIds,
    requestBudgetCny: value.MUSE_AI_REQUEST_BUDGET_CNY,
    projectDailyBudgetCny: value.MUSE_AI_PROJECT_DAILY_BUDGET_CNY,
    llmModel: value.MUSE_AI_LLM_MODEL,
    imageModel: value.MUSE_AI_IMAGE_MODEL,
    runtimeDirectory: value.MUSE_RUNTIME_DIRECTORY,
    secretStoreKey: value.MUSE_SECRET_STORE_KEY === "" ? undefined : value.MUSE_SECRET_STORE_KEY,
  };
}

export function dashscopeBaseUrl(config: MuseServerConfig): string {
  return config.dashscopeWorkspaceId
    ? `https://${config.dashscopeWorkspaceId}.cn-beijing.maas.aliyuncs.com`
    : "https://dashscope.aliyuncs.com";
}
