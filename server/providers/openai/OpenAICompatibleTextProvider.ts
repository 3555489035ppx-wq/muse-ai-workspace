import { SafeApiError } from "../../api/envelope.js";
import type { MuseServerConfig } from "../../config.js";
import { providerHttpError } from "../errors.js";
import { readProviderJson } from "../response.js";
import type { StructuredProvider, StructuredProviderResult } from "../types.js";
import type { TextProviderOptions } from "../deepseek/DeepSeekTextProvider.js";

interface CompatibleResponse {
  readonly id?: string;
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

export class OpenAICompatibleTextProvider implements StructuredProvider {
  readonly descriptor;
  readonly #options: Required<Pick<TextProviderOptions, "id" | "label" | "apiKey" | "baseUrl" | "model">>;
  readonly #fetch: typeof fetch;

  constructor(config: MuseServerConfig, fetcher: typeof fetch, options: TextProviderOptions) {
    this.#fetch = fetcher;
    this.#options = {
      id: options.id ?? "openai-compatible-text",
      label: options.label ?? "OpenAI Compatible Text AI",
      apiKey: options.apiKey ?? "",
      baseUrl: options.baseUrl ?? config.openaiBaseUrl,
      model: options.model ?? "gpt-5.2",
    };
    this.descriptor = {
      id: this.#options.id,
      label: this.#options.label,
      region: "global" as const,
      model: this.#options.model,
      modelVersion: this.#options.model,
      capabilities: ["structured", "review"] as const,
      configured: Boolean(this.#options.apiKey),
    };
  }

  async complete(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult> {
    if (!this.#options.apiKey) throw new SafeApiError("TEXT_PROVIDER_NOT_CONFIGURED", "Text AI 尚未配置 API Key。", 503);
    if (input.enableSearch) throw new SafeApiError("TEXT_SEARCH_UNAVAILABLE", "当前 Text Provider 未启用联网检索；请先提供可追溯的研究来源。", 422);
    const response = await this.#fetch(`${this.#options.baseUrl}/chat/completions`, {
      method: "POST",
      signal: input.signal,
      headers: { authorization: `Bearer ${this.#options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.#options.model,
        messages: [
          { role: "system", content: `你是 Muse 的${input.purpose}结构化设计推理引擎。只输出合法 JSON，不要输出 Markdown。不得捏造研究来源。${input.schemaHint ? `输出必须符合：${JSON.stringify(input.schemaHint)}` : ""}` },
          { role: "user", content: input.instruction },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!response.ok) throw providerHttpError(this.#options.label, response);
    const payload = await readProviderJson<CompatibleResponse>(response, this.#options.label);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", `${this.#options.label} 未返回可用的结构化结果。`, 502, true);
    let value: unknown;
    try { value = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")); } catch { throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", `${this.#options.label} 返回的 JSON 无法解析。`, 502, true); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", `${this.#options.label} 返回了错误的数据类型。`, 502, true);
    const inputTokens = payload.usage?.prompt_tokens ?? 0;
    const outputTokens = payload.usage?.completion_tokens ?? 0;
    return {
      value: value as Readonly<Record<string, unknown>>,
      trace: {
        providerId: this.descriptor.id,
        model: this.descriptor.model,
        modelVersion: this.descriptor.modelVersion,
        providerRequestId: payload.id,
        usage: { inputTokens, outputTokens, estimatedCostCny: (inputTokens * 2 + outputTokens * 8) / 1_000_000 },
      },
    };
  }
}
