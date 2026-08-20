import { SafeApiError } from "../../api/envelope.js";
import type { MuseServerConfig } from "../../config.js";
import { dashscopeBaseUrl } from "../../config.js";
import type { StructuredProvider, StructuredProviderResult } from "../types.js";
import { readProviderJson } from "../response.js";

interface DashScopeChatResponse {
  readonly id?: string;
  readonly choices?: readonly { readonly message?: { readonly content?: string } }[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

export class DashScopeStructuredProvider implements StructuredProvider {
  readonly descriptor;
  readonly #config: MuseServerConfig;
  readonly #fetch: typeof fetch;
  constructor(config: MuseServerConfig, fetcher: typeof fetch = fetch) {
    this.#config = config; this.#fetch = fetcher;
    this.descriptor = { id: "dashscope-structured", label: "阿里云百炼 · 通义千问", region: "cn-beijing" as const, model: config.llmModel, modelVersion: config.llmModel, capabilities: ["structured", "search", "vision", "review"] as const, configured: Boolean(config.dashscopeApiKey && config.dashscopeWorkspaceId) };
  }
  async complete(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult> {
    if (!this.#config.dashscopeApiKey) throw new SafeApiError("PROVIDER_NOT_CONFIGURED", "服务端未配置百炼 API Key。", 503);
    const response = await this.#fetch(`${dashscopeBaseUrl(this.#config)}/compatible-mode/v1/chat/completions`, {
      method: "POST", signal: input.signal,
      headers: { authorization: `Bearer ${this.#config.dashscopeApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.#config.llmModel, messages: [{ role: "system", content: `你是 Muse 的${input.purpose}结构化助手。只输出合法 JSON，不输出 Markdown。${input.schemaHint ? `输出结构必须遵守：${JSON.stringify(input.schemaHint)}` : ""}` }, { role: "user", content: input.instruction }], response_format: { type: "json_object" }, enable_search: input.enableSearch, temperature: 0.2 }),
    });
    if (!response.ok) throw new SafeApiError("PROVIDER_FAILURE", "真实 AI 请求失败，请稍后重试。", 502, response.status >= 500 || response.status === 429);
    const payload = await readProviderJson<DashScopeChatResponse>(response, "阿里云百炼");
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new SafeApiError("INVALID_PROVIDER_OUTPUT", "真实 AI 未返回有效结构化结果。", 502);
    let value: unknown;
    try { value = JSON.parse(content); } catch { throw new SafeApiError("INVALID_PROVIDER_OUTPUT", "真实 AI 返回结果无法验证。", 502); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SafeApiError("INVALID_PROVIDER_OUTPUT", "真实 AI 返回结果类型错误。", 502);
    const inputTokens = payload.usage?.prompt_tokens ?? 0; const outputTokens = payload.usage?.completion_tokens ?? 0;
    const estimatedCostCny = (inputTokens * 2.4 + outputTokens * 9.6) / 1_000_000;
    return { value: value as Readonly<Record<string, unknown>>, trace: { providerId: this.descriptor.id, model: this.descriptor.model, modelVersion: this.descriptor.modelVersion, providerRequestId: payload.id, usage: { inputTokens, outputTokens, estimatedCostCny } } };
  }
}
