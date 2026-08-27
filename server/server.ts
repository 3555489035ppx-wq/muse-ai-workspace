import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { z } from "zod";
import { failure, requestId, SafeApiError, success } from "./api/envelope.js";
import { AiOrchestrator } from "./application/AiOrchestrator.js";
import { AiRunRepository } from "./application/AiRunRepository.js";
import { AssetStore } from "./application/AssetStore.js";
import { BudgetService } from "./application/BudgetService.js";
import { ProviderConfigStore, type ProviderRuntimeConfig } from "./application/ProviderConfigStore.js";
import { loadServerConfig } from "./config.js";
import { imageAiRequestSchema, researchSearchRequestSchema, structuredAiRequestSchema } from "./contracts/ai.js";
import { providerCategorySchema, providerConfigInputSchema, providerCreateRequestSchema, providerPatchRequestSchema, providerTestRequestSchema, type ProviderCategory, type ProviderConfigInput, type ProviderName } from "./contracts/providers.js";
import { DeepSeekTextAdapter } from "./providers/deepseek/DeepSeekTextProvider.js";
import { DemoVisualProvider } from "./providers/demo/DemoVisualProvider.js";
import { OpenAICompatibleTextProvider } from "./providers/openai/OpenAICompatibleTextProvider.js";
import { OpenAIImageProvider } from "./providers/openai/OpenAIImageProvider.js";
import { TavilySearchProvider } from "./providers/search/TavilySearchProvider.js";
import { ProviderRegistry } from "./providers/registry.js";
import type { ImageProvider, StructuredProvider } from "./providers/types.js";

const MAX_JSON_BYTES = 256 * 1024;

async function readJson(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_JSON_BYTES) throw new SafeApiError("PAYLOAD_TOO_LARGE", "请求内容超过限制。", 413);
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new SafeApiError("INVALID_JSON", "请求格式无效。", 400); }
}

function headersOf(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
  return headers;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}

function categoryFromProviderId(value: string | undefined): ProviderCategory | undefined {
  if (value === "text" || value === "text-provider") return "text";
  if (value === "image" || value === "image-provider") return "image";
  return undefined;
}

function normalizedProviderName(value: ProviderName): ProviderName {
  return value === "custom" ? "custom-openai-compatible" : value;
}

export function createMuseAiHandler(environment: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const config = loadServerConfig(environment);
  const registry = new ProviderRegistry();
  const providerStore = new ProviderConfigStore(config);
  const demoVisual = new DemoVisualProvider();
  registry.register(demoVisual);

  const providerFor = (category: ProviderCategory, runtimeOverride?: ProviderRuntimeConfig): StructuredProvider | ImageProvider | undefined => {
    const runtime = runtimeOverride ?? providerStore.get(category);
    const provider = normalizedProviderName(runtime.provider);
    const demo = category === "image" && provider === "demo-visual";
    if (demo || !runtime.apiKey || !runtime.enabled || runtime.connectionStatus === "error") return undefined;
    if (category === "text") {
      if (provider === "deepseek") return new DeepSeekTextAdapter(config, fetcher, { id: "deepseek-text", label: runtime.displayName, apiKey: runtime.apiKey, baseUrl: runtime.baseUrl, model: runtime.modelId, thinkingEnabled: runtime.reasoningMode !== "standard" && runtime.reasoningMode !== "off", reasoningEffort: runtime.reasoningMode === "high" || runtime.reasoningMode === "max" ? runtime.reasoningMode : undefined });
      if (provider === "openai" || provider === "custom-openai-compatible") return new OpenAICompatibleTextProvider(config, fetcher, { id: `${provider}-text`, label: runtime.displayName, apiKey: runtime.apiKey, baseUrl: runtime.baseUrl, model: runtime.modelId });
      return undefined;
    }
    if (provider === "openai" || provider === "custom-openai-compatible") return new OpenAIImageProvider(config, fetcher, { id: `${provider}-image`, label: runtime.displayName, apiKey: runtime.apiKey, baseUrl: runtime.baseUrl, model: runtime.modelId });
    return undefined;
  };

  const syncRegistry = () => {
    registry.replaceByCapability("structured", providerFor("text"));
    registry.replaceByCapability("image_generate", providerFor("image"));
    registry.replaceByCapability("search", config.searchApiKey ? new TavilySearchProvider(config.searchApiKey, config.searchBaseUrl, fetcher) : undefined);
  };
  syncRegistry();

  const assets = new AssetStore(config.runtimeDirectory);
  const runs = new AiRunRepository(join(config.runtimeDirectory, "ai-runs.json"));
  const budgets = new BudgetService(config.requestBudgetCny, config.projectDailyBudgetCny, join(config.runtimeDirectory, "budget.json"));
  const orchestrator = new AiOrchestrator(config, registry, runs, budgets, assets);

  const requireActor = (request: IncomingMessage) => {
    if (request.headers["x-muse-actor-id"] !== config.actorId) throw new SafeApiError("UNAUTHORIZED", "当前身份无权修改 AI Provider 配置。", 401);
  };

  const isSupported = (category: ProviderCategory, provider: ProviderName) => {
    const canonical = normalizedProviderName(provider);
    return category === "text"
      ? ["deepseek", "openai", "custom-openai-compatible"].includes(canonical)
      : ["openai", "custom-openai-compatible", "demo-visual"].includes(canonical);
  };

  const runtimeCandidate = (category: ProviderCategory, input: Record<string, unknown>): ProviderConfigInput => {
    const current = providerStore.get(category);
    const customModelId = (input.customModelId as string | undefined)?.trim();
    const requestedModel = ((input.modelId ?? input.model) as string | undefined)?.trim();
    return {
      provider: normalizedProviderName((input.provider as ProviderName | undefined) ?? current.provider),
      displayName: (input.displayName as string | undefined) ?? current.displayName,
      baseUrl: (input.baseUrl as string | undefined) ?? current.baseUrl,
      modelId: customModelId ?? requestedModel ?? current.modelId,
      customModelId: (input.customModelId as string | undefined) ?? current.customModelId,
      enabled: (input.enabled as boolean | undefined) ?? current.enabled,
      reasoningMode: (input.reasoningMode as "off" | "standard" | "high" | "max" | undefined) ?? current.reasoningMode,
      quality: (input.quality as "standard" | "high" | undefined) ?? current.quality,
      aspectRatio: (input.aspectRatio as "square" | "landscape" | "portrait" | undefined) ?? current.aspectRatio,
      apiKey: (input.apiKey as string | undefined) ?? undefined,
    };
  };

  const testProviderConfig = async (category: ProviderCategory, input: Record<string, unknown>, persist: boolean) => {
    const candidate = runtimeCandidate(category, input);
    const normalized = providerConfigInputSchema.parse(candidate);
    const providerName = normalizedProviderName(normalized.provider);
    if (!isSupported(category, providerName)) throw new SafeApiError("PROVIDER_NOT_IMPLEMENTED", "当前 Provider 已登记，但该类型的真实适配器还未启用。", 422);
    const isDemo = category === "image" && providerName === "demo-visual";
    if (!isDemo && !normalized.apiKey && !providerStore.get(category).apiKey) throw new SafeApiError("PROVIDER_KEY_REQUIRED", "请先输入 API Key，再测试连接。", 400);
    if (persist) await providerStore.save(category, { ...normalized, provider: providerName }, "testing");
    if (isDemo) {
      if (persist) await providerStore.setStatus(category, "connected", undefined, true);
      return { category, provider: "Demo Visual", model: "demo-visual", latencyMs: 0, status: "connected", mode: "demo" as const };
    }
    const current = providerStore.get(category);
    const runtime = { ...(persist ? current : { ...current, ...candidate, provider: providerName, modelId: normalized.modelId ?? current.modelId, apiKey: normalized.apiKey ?? current.apiKey }), enabled: true };
    const provider = providerFor(category, runtime);
    if (!provider) throw new SafeApiError("PROVIDER_NOT_IMPLEMENTED", "当前 Provider 尚未提供可执行的真实适配器。", 422);
    const startedAt = Date.now();
    try {
      if (category === "text") {
        const adapter = provider as DeepSeekTextAdapter | StructuredProvider;
        const result = "testConnection" in adapter && typeof adapter.testConnection === "function"
          ? await adapter.testConnection()
          : await adapter.complete({ instruction: "返回 {\"status\":\"ok\"}，不要添加其他字段。", purpose: "provider_connection_test", enableSearch: false, schemaHint: { status: "ok" } });
        const status = "status" in result ? result.status : (result.value.status === "ok" ? "connected" : "invalid-output");
        if (persist) await providerStore.setStatus(category, status === "connected" ? "connected" : "error", status === "connected" ? undefined : "Provider 返回了无法验证的结果。", status === "connected");
        return { category, provider: provider.descriptor.label, model: provider.descriptor.model, latencyMs: "latencyMs" in result ? result.latencyMs : Date.now() - startedAt, status };
      }
      const result = await (provider as ImageProvider).generate({ prompt: "Minimal industrial design calibration object on a neutral studio background, one object, no text, no logo.", size: "1K" });
      if (persist) await providerStore.setStatus(category, result.bytes.byteLength > 0 ? "connected" : "error", result.bytes.byteLength > 0 ? undefined : "Provider 未返回图像。", result.bytes.byteLength > 0);
      return { category, provider: provider.descriptor.label, model: provider.descriptor.model, latencyMs: Date.now() - startedAt, status: result.bytes.byteLength > 0 ? "connected" : "invalid-output" };
    } catch (error) {
      if (persist) await providerStore.setStatus(category, "error", error instanceof SafeApiError ? error.message : "Provider 暂时不可用。", true, error instanceof SafeApiError ? error.code : "PROVIDER_FAILURE");
      throw error;
    } finally {
      syncRegistry();
    }
  };

  const saveProvider = async (category: ProviderCategory, input: ProviderConfigInput) => {
    const saved = await providerStore.save(category, { ...input, provider: normalizedProviderName(input.provider) });
    syncRegistry();
    return saved;
  };

  const providerViews = () => ({ providers: providerStore.configuredViews(), storage: "local-secret-store" as const });

  const providerCapabilities = () => {
    const textConfig = providerStore.get("text");
    const imageConfig = providerStore.get("image");
    const serviceEnabled = config.liveEnabled && !config.killSwitchActive;
    const textProvider = normalizedProviderName(textConfig.provider);
    const imageProvider = normalizedProviderName(imageConfig.provider);
    const textSupported = ["deepseek", "openai", "custom-openai-compatible"].includes(textProvider);
    const imageSupported = ["openai", "custom-openai-compatible", "demo-visual"].includes(imageProvider);
    const view = (item: ProviderRuntimeConfig, supported: boolean, category: ProviderCategory) => {
      const demo = category === "image" && normalizedProviderName(item.provider) === "demo-visual";
      const configured = demo || Boolean(item.apiKey);
      const enabled = item.enabled && (demo || serviceEnabled);
      const ready = configured && enabled && supported && item.connectionStatus !== "error";
      return { id: item.id, label: item.displayName, model: item.modelId, configured, enabled, ready, mode: demo ? "demo" as const : "real" as const, capabilities: item.capabilities, configurationHint: configured ? undefined : category === "text" ? "在设置中输入 Text AI API Key" : "选择 Demo Visual 或配置 Image AI API Key" };
    };
    const textView = view(textConfig, textSupported, "text");
    const imageView = view(imageConfig, imageSupported, "image");
    const searchConfigured = Boolean(config.searchApiKey);
    const searchView = {
      id: "search-provider",
      label: "Tavily Web Search",
      model: "tavily-search",
      configured: searchConfigured,
      enabled: searchConfigured && serviceEnabled,
      ready: searchConfigured && serviceEnabled,
      mode: "real" as const,
      managedBySite: searchConfigured,
      capabilities: ["search"] as const,
      configurationHint: searchConfigured ? undefined : "在部署环境变量中配置 MUSE_SITE_SEARCH_API_KEY",
    };
    const readyCount = Number(textView.ready) + Number(imageView.ready);
    return { liveEnabled: config.liveEnabled, providerConfigured: textView.configured || imageView.configured || searchConfigured, killSwitchActive: config.killSwitchActive, providerLabel: readyCount === 2 ? `${textConfig.displayName} + ${imageConfig.displayName}` : readyCount === 1 ? "部分真实 AI" : searchConfigured ? "真实 Web Search 已配置" : "真实 AI 未配置", models: { llm: textConfig.modelId, image: imageConfig.modelId }, capabilities: registry.descriptors().filter((item) => item.configured).flatMap((item) => item.capabilities), limits: { requestCny: config.requestBudgetCny, projectDailyCny: config.projectDailyBudgetCny }, providers: { text: textView, image: imageView, search: searchView }, mode: readyCount === 2 ? "real" as const : readyCount === 1 || searchConfigured ? "partial" as const : "unavailable" as const };
  };

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const id = requestId();
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        json(response, 200, success(id, { status: "ready", services: { bff: "ready", secretStore: "ready", providerRegistry: "ready" }, liveProviderRequired: false }));
        return;
      }

      if (url.pathname === "/api/ai/providers" || url.pathname.startsWith("/api/ai/providers/")) {
        requireActor(request);
        const parts = url.pathname.split("/").filter(Boolean);
        const providerId = parts[3];
        if (request.method === "GET" && !providerId) { json(response, 200, success(id, providerViews())); return; }
        if (request.method === "POST" && !providerId) {
          const payload = providerCreateRequestSchema.parse(await readJson(request));
          const { category, ...input } = payload;
          json(response, 200, success(id, { provider: await saveProvider(category, input) }));
          return;
        }
        const category = categoryFromProviderId(providerId);
        if (!category) throw new SafeApiError("INVALID_PROVIDER_ID", "Provider 配置标识无效。", 400);
        if (parts[4] === "test") {
          if (request.method !== "POST") throw new SafeApiError("METHOD_NOT_ALLOWED", "请求方法不受支持。", 405);
          const payload = providerTestRequestSchema.parse(await readJson(request));
          json(response, 200, success(id, await testProviderConfig(category, payload.config ?? {}, payload.persist)));
          return;
        }
        if (request.method === "PATCH") {
          const patch = providerPatchRequestSchema.parse(await readJson(request));
          const current = providerStore.get(category);
          const merged: ProviderConfigInput = {
            provider: patch.provider ?? current.provider,
            displayName: patch.displayName ?? current.displayName,
            baseUrl: patch.baseUrl ?? current.baseUrl,
            // Legacy clients may still send `model`; keep the migration alias readable.
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            modelId: patch.modelId ?? patch.model ?? current.modelId,
            customModelId: patch.customModelId ?? current.customModelId,
            // A first-time PATCH commonly carries the API key but no explicit
            // enabled flag. The editor starts from the unconfigured shell,
            // whose enabled value is false, so infer activation from the new
            // secret while preserving an explicit user choice to disable it.
            enabled: patch.enabled ?? (current.enabled || Boolean(patch.apiKey)),
            reasoningMode: patch.reasoningMode ?? current.reasoningMode,
            quality: patch.quality ?? current.quality,
            aspectRatio: patch.aspectRatio ?? current.aspectRatio,
            apiKey: patch.apiKey,
          };
          json(response, 200, success(id, { provider: await saveProvider(category, merged) }));
          return;
        }
        if (request.method === "DELETE") { json(response, 200, success(id, { provider: await providerStore.remove(category) })); syncRegistry(); return; }
      }

      // Compatibility routes for older local clients. New code uses /api/ai/providers.
      if (url.pathname === "/api/providers" || url.pathname.startsWith("/api/providers/")) {
        requireActor(request);
        if (request.method === "GET" && url.pathname === "/api/providers") { json(response, 200, success(id, { providers: providerStore.allViews(), storage: "local-secret-store" })); return; }
        const parts = url.pathname.split("/").filter(Boolean);
        const categoryValue = parts[2];
        if (!categoryValue || !providerCategorySchema.safeParse(categoryValue).success) throw new SafeApiError("INVALID_PROVIDER_CATEGORY", "Provider 类型无效。", 400);
        const category = providerCategorySchema.parse(categoryValue);
        if (parts[3] === "test") {
          if (request.method !== "POST") throw new SafeApiError("METHOD_NOT_ALLOWED", "请求方法不受支持。", 405);
          const payload = providerTestRequestSchema.parse(await readJson(request));
          json(response, 200, success(id, await testProviderConfig(category, payload.config ?? {}, payload.persist)));
          return;
        }
        if (request.method === "PUT") { json(response, 200, success(id, { provider: await saveProvider(category, providerConfigInputSchema.parse(await readJson(request))) })); return; }
        if (request.method === "DELETE") { json(response, 200, success(id, { provider: await providerStore.remove(category) })); syncRegistry(); return; }
      }

      if (request.method === "GET" && url.pathname === "/api/ai/capabilities") { json(response, 200, success(id, providerCapabilities())); return; }
      if (request.method === "POST" && ["/api/ai/test/text", "/api/ai/test/image"].includes(url.pathname)) {
        if (request.headers["x-muse-actor-id"] !== config.actorId) throw new SafeApiError("UNAUTHORIZED", "当前身份无权测试 AI 服务。", 401);
        const result = url.pathname.endsWith("/text") ? await orchestrator.probeText() : await orchestrator.probeImage();
        json(response, 200, success(id, result)); return;
      }
      if (request.method === "GET" && url.pathname === "/api/ai/runs") {
        if (request.headers["x-muse-actor-id"] !== config.actorId) throw new SafeApiError("UNAUTHORIZED", "当前身份无权查看 AI 运行记录。", 401);
        json(response, 200, success(id, await runs.recent(Number(url.searchParams.get("limit") ?? 50)))); return;
      }
      if (request.method === "POST" && url.pathname === "/api/research/search") { json(response, 200, success(id, await orchestrator.search(headersOf(request), researchSearchRequestSchema.parse(await readJson(request))))); return; }
      if (request.method === "POST" && url.pathname === "/api/ai/structured") { json(response, 200, success(id, await orchestrator.structured(headersOf(request), structuredAiRequestSchema.parse(await readJson(request))))); return; }
      if (request.method === "POST" && ["/api/ai/images/generate", "/api/ai/images/edit"].includes(url.pathname)) {
        const input = imageAiRequestSchema.parse(await readJson(request));
        const operation = url.pathname.endsWith("/edit") ? "image_edit" as const : "image_generate" as const;
        json(response, 200, success(id, await orchestrator.image(headersOf(request), input, operation))); return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/ai/assets/")) { const asset = await assets.get(url.pathname.split("/").at(-1) ?? ""); response.writeHead(200, { "content-type": asset.mimeType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" }); response.end(asset.bytes); return; }
      throw new SafeApiError("NOT_FOUND", "接口不存在。", 404);
    } catch (error) {
      const normalized = error instanceof z.ZodError ? new SafeApiError("INVALID_INPUT", "请求字段不完整或格式错误。", 400) : error;
      const result = failure(id, normalized);
      json(response, result.status, result.body);
    }
  };
}

export function createMuseAiServer(environment: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const handle = createMuseAiHandler(environment, fetcher);
  return createServer((request, response) => { void handle(request, response); });
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
if (entryPath) {
  const config = loadServerConfig();
  const server = createMuseAiServer();
  server.listen(config.port, "127.0.0.1", () => { process.stdout.write(`Muse AI BFF ready on http://127.0.0.1:${String(config.port)}\n`); });
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
