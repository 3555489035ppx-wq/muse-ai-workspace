import type { AiCapabilityView, ApiEnvelope } from "../../../server/contracts/ai.js";
import type { ProviderCategory, ProviderConfigInput, ProviderConfigView } from "../../../server/contracts/providers.js";

const ACTOR_ID = "muse-local-experiment";
type StructuredData = {
  readonly runId: string;
  readonly result: Record<string, unknown>;
  readonly trace: {
    readonly providerId: string;
    readonly model: string;
    readonly modelVersion: string;
    readonly httpStatus?: number;
    readonly rawContentLength?: number;
    readonly parsed?: boolean;
    readonly usage: { readonly estimatedCostCny: number };
  };
};

export interface ResearchSearchResult {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly publishedAt?: string | null;
  readonly snippet: string;
  readonly rawContent?: string;
  readonly contentStatus: "full" | "snippet";
  readonly score?: number;
  readonly favicon?: string | null;
}

export interface ResearchSearchResponse {
  readonly runId: string;
  readonly query: string;
  readonly results: readonly ResearchSearchResult[];
  readonly trace: {
    readonly providerId: string;
    readonly model: string;
    readonly modelVersion: string;
    readonly providerRequestId?: string;
    readonly httpStatus?: number;
    readonly rawContentLength?: number;
    readonly parsed?: boolean;
    readonly usage: { readonly estimatedCostCny: number };
  };
}
export class MuseAiClientError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean, readonly status = 0) { super(message); this.name = "MuseAiClientError"; }
}
async function parseEnvelope<T>(response: Response): Promise<T> {
  const raw = await response.text().catch(() => "");
  if (!raw.trim()) throw new MuseAiClientError("EMPTY_SERVER_RESPONSE", "Muse AI 服务返回空数据，请稍后重试。", true, response.status);
  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    throw new MuseAiClientError("INVALID_RESPONSE_FORMAT", "服务端返回格式无法识别，请稍后重试。", true, response.status);
  }
  if (!envelope || typeof envelope !== "object" || typeof (envelope as { ok?: unknown }).ok !== "boolean") {
    throw new MuseAiClientError("INVALID_RESPONSE_FORMAT", "服务端返回格式不完整，请稍后重试。", true, response.status);
  }
  if (!envelope.ok) {
    const error = (envelope as { error?: unknown }).error;
    if (!error || typeof error !== "object"
      || typeof (error as { code?: unknown }).code !== "string"
      || typeof (error as { message?: unknown }).message !== "string") {
      throw new MuseAiClientError("INVALID_RESPONSE_FORMAT", "服务端错误响应格式不完整，请稍后重试。", true, response.status);
    }
    const typedError = error as { code: string; message: string; retryable?: boolean };
    throw new MuseAiClientError(typedError.code, typedError.message, typedError.retryable === true, response.status);
  }
  return envelope.data;
}
export class MuseAiClient {
  readonly #fetch: typeof fetch;
  constructor(fetcher?: typeof fetch) {
    this.#fetch = fetcher ?? globalThis.fetch.bind(globalThis);
  }
  async #request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      return await this.#fetch(input, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new MuseAiClientError("BFF_UNREACHABLE", "Muse 服务暂时无法连接，请确认服务正在运行。", true);
    }
  }
  async capabilities(signal?: AbortSignal): Promise<AiCapabilityView> { return parseEnvelope(await this.#request("/api/ai/capabilities", { signal, headers: { accept: "application/json" } })); }
  async health(signal?: AbortSignal): Promise<{ readonly services: { readonly bff: string; readonly secretStore: string; readonly providerRegistry: string } }> { return parseEnvelope(await this.#request("/api/health", { signal, headers: { accept: "application/json" } })); }
  async providerConfigs(signal?: AbortSignal): Promise<{ readonly providers: { readonly text: ProviderConfigView; readonly image: ProviderConfigView }; readonly storage: string }> {
    const data = await parseEnvelope<{ readonly providers?: readonly ProviderConfigView[]; readonly storage?: string }>(await this.#request("/api/ai/providers", { signal, headers: { accept: "application/json", "x-muse-actor-id": ACTOR_ID } }));
    const byCategory = new Map((data.providers ?? []).map((provider) => [provider.category, provider]));
    const fallback = (category: "text" | "image"): ProviderConfigView => category === "text" ? {
      id: "text-provider", category, provider: "deepseek", displayName: "DeepSeek Text AI", baseUrl: "https://api.deepseek.com", modelId: "deepseek-v4-pro", model: "deepseek-v4-pro", enabled: false, connectionStatus: "unconfigured", secretConfigured: false, capabilities: ["textGeneration", "structuredOutput", "reasoning"],
    } : {
      id: "image-provider", category, provider: "demo-visual", displayName: "Demo Visual", baseUrl: "", modelId: "demo-visual", model: "demo-visual", enabled: true, connectionStatus: "connected", secretConfigured: false, capabilities: ["demoImageSelection", "demoVariationLookup"],
    };
    return { providers: { text: byCategory.get("text") ?? fallback("text"), image: byCategory.get("image") ?? fallback("image") }, storage: data.storage ?? "local-secret-store" };
  }
  async saveProviderConfig(category: ProviderCategory, input: ProviderConfigInput, signal?: AbortSignal): Promise<ProviderConfigView> {
    const result = await parseEnvelope<{ readonly provider: ProviderConfigView }>(await this.#request(`/api/ai/providers/${category}-provider`, { method: "PATCH", signal, headers: { accept: "application/json", "content-type": "application/json", "x-muse-actor-id": ACTOR_ID }, body: JSON.stringify(input) }));
    return result.provider;
  }
  async testProviderConfig(category: ProviderCategory, input: Partial<ProviderConfigInput> = {}, persist = false, signal?: AbortSignal): Promise<{ readonly category: ProviderCategory; readonly provider: string; readonly model: string; readonly latencyMs: number; readonly status: string }> {
    return parseEnvelope(await this.#request(`/api/ai/providers/${category}-provider/test`, { method: "POST", signal, headers: { accept: "application/json", "content-type": "application/json", "x-muse-actor-id": ACTOR_ID }, body: JSON.stringify({ config: input, persist }) }));
  }
  async deleteProviderConfig(category: ProviderCategory, signal?: AbortSignal): Promise<ProviderConfigView> {
    const result = await parseEnvelope<{ readonly provider: ProviderConfigView }>(await this.#request(`/api/ai/providers/${category}-provider`, { method: "DELETE", signal, headers: { accept: "application/json", "x-muse-actor-id": ACTOR_ID } }));
    return result.provider;
  }
  async structured(input: { readonly projectId: string; readonly purpose: "overview" | "research" | "research_plan" | "insight" | "moodboard" | "direction" | "exploration" | "prompt" | "review" | "version" | "project_brain" | "concept" | "visual_brief" | "cmf" | "decision_map"; readonly instruction: string; readonly schemaHint?: Record<string, unknown>; readonly enableSearch?: boolean; readonly idempotencyKey: string }, signal?: AbortSignal): Promise<{ readonly ok: true; readonly runId: string; readonly result: Record<string, unknown>; readonly trace: { readonly providerId: string; readonly model: string; readonly modelVersion: string; readonly httpStatus?: number; readonly rawContentLength?: number; readonly parsed?: boolean; readonly usage: { readonly estimatedCostCny: number } } }> {
    const data = await parseEnvelope<StructuredData>(await this.#request("/api/ai/structured", { method: "POST", signal, headers: { accept: "application/json", "content-type": "application/json", "x-muse-actor-id": ACTOR_ID, "x-muse-project-id": input.projectId }, body: JSON.stringify(input) }));
    return { ...data, ok: true };
  }
  async researchSearch(input: { readonly projectId: string; readonly query: string; readonly questionId?: string; readonly maxResults?: number; readonly idempotencyKey: string }, signal?: AbortSignal): Promise<ResearchSearchResponse> {
    return parseEnvelope(await this.#request("/api/research/search", { method: "POST", signal, headers: { accept: "application/json", "content-type": "application/json", "x-muse-actor-id": ACTOR_ID, "x-muse-project-id": input.projectId }, body: JSON.stringify(input) }));
  }
  async generateImage(input: { readonly projectId: string; readonly stage?: "concept"; readonly promptVersionId: string; readonly prompt: string; readonly negativePrompt?: string; readonly idempotencyKey: string }, signal?: AbortSignal): Promise<{ readonly runId: string; readonly assetUrl: string; readonly mimeType: string; readonly promptVersionId: string; readonly trace: { readonly providerId: string; readonly model: string; readonly modelVersion: string; readonly usage: { readonly estimatedCostCny: number } } }> {
    return parseEnvelope(await this.#request("/api/ai/images/generate", { method: "POST", signal, headers: { accept: "application/json", "content-type": "application/json", "x-muse-actor-id": ACTOR_ID, "x-muse-project-id": input.projectId }, body: JSON.stringify({ ...input, sourceAssetUrls: [], size: "2K" }) }));
  }
  async editImage(input: { readonly projectId: string; readonly stage: "cmf" | "review"; readonly promptVersionId: string; readonly prompt: string; readonly negativePrompt?: string; readonly sourceAssetUrls: readonly string[]; readonly idempotencyKey: string }, signal?: AbortSignal): Promise<{ readonly runId: string; readonly assetUrl: string; readonly mimeType: string; readonly promptVersionId: string; readonly trace: { readonly providerId: string; readonly model: string; readonly modelVersion: string; readonly usage: { readonly estimatedCostCny: number } } }> {
    return parseEnvelope(await this.#request("/api/ai/images/edit", { method: "POST", signal, headers: { accept: "application/json", "content-type": "application/json", "x-muse-actor-id": ACTOR_ID, "x-muse-project-id": input.projectId, }, body: JSON.stringify({ ...input, size: "2K" }) }));
  }
  async testProvider(kind: "text" | "image", signal?: AbortSignal): Promise<{ readonly provider: string; readonly model: string; readonly latencyMs: number; readonly status: string }> {
    return parseEnvelope(await this.#request(`/api/ai/test/${kind}`, { method: "POST", signal, headers: { accept: "application/json", "x-muse-actor-id": ACTOR_ID } }));
  }
  async recentRuns(limit = 30, signal?: AbortSignal): Promise<readonly Record<string, unknown>[]> {
    return parseEnvelope(await this.#request(`/api/ai/runs?limit=${encodeURIComponent(String(limit))}`, { signal, headers: { accept: "application/json", "x-muse-actor-id": ACTOR_ID } }));
  }
}
