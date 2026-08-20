import { SafeApiError } from "../../api/envelope.js";
import type { MuseServerConfig } from "../../config.js";
import { providerHttpError } from "../errors.js";
import { readProviderJson } from "../response.js";
import type { StructuredProvider, StructuredProviderResult } from "../types.js";

interface DeepSeekResponse {
  readonly id?: string;
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const fenced = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(fenced);
  } catch {
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(fenced.slice(start, end + 1));
      } catch {
        throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", "DeepSeek Text AI 返回的 JSON 无法解析。", 502, true);
      }
    }
    throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", "DeepSeek Text AI 返回的 JSON 无法解析。", 502, true);
  }
}

function logConceptGeneration(input: { purpose: string; httpStatus: number; provider: string; model: string; rawContentLength: number; parsedConceptCount: number; validationResult: string }): void {
  if (input.purpose !== "concept" && input.purpose !== "exploration") return;
  console.info("[ConceptGeneration]", JSON.stringify({
    stage: "provider",
    "HTTP status": input.httpStatus,
    provider: input.provider,
    model: input.model,
    rawContentLength: input.rawContentLength,
    parsedConceptCount: input.parsedConceptCount,
    validationResult: input.validationResult,
    persistedConceptCount: 0,
    renderedConceptCount: 0,
  }));
}

export interface TextProviderOptions {
  readonly id?: string;
  readonly label?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly thinkingEnabled?: boolean;
  readonly reasoningEffort?: "high" | "max";
}

export class DeepSeekTextAdapter implements StructuredProvider {
  readonly descriptor;
  readonly #config: MuseServerConfig;
  readonly #options: TextProviderOptions;
  readonly #fetch: typeof fetch;

  constructor(config: MuseServerConfig, fetcher: typeof fetch = fetch, options: TextProviderOptions = {}) {
    this.#config = config;
    this.#options = options;
    this.#fetch = fetcher;
    this.descriptor = {
      id: options.id ?? "deepseek-text",
      label: options.label ?? "DeepSeek Text AI",
      region: "global" as const,
      model: options.model ?? config.deepseekTextModel,
      modelVersion: options.model ?? config.deepseekTextModel,
      capabilities: ["structured", "review"] as const,
      configured: Boolean(options.apiKey ?? config.deepseekApiKey),
    };
  }

  async complete(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult> {
    const apiKey = this.#options.apiKey ?? this.#config.deepseekApiKey;
    if (!apiKey) throw new SafeApiError("TEXT_PROVIDER_NOT_CONFIGURED", "Text AI 尚未配置 API Key。", 503);
    if (input.enableSearch) throw new SafeApiError("TEXT_SEARCH_UNAVAILABLE", "当前 DeepSeek 连接未启用联网检索；请先提供可追溯的研究来源。", 422);
    const baseUrl = this.#options.baseUrl ?? this.#config.deepseekBaseUrl;
    const model = this.#options.model ?? this.#config.deepseekTextModel;
    const thinkingEnabled = this.#options.thinkingEnabled ?? true;
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: `你是 Muse 的${input.purpose}结构化设计推理引擎。只输出合法 JSON，不要输出 Markdown。不得捏造研究来源。${input.schemaHint ? `输出必须符合：${JSON.stringify(input.schemaHint)}` : ""}` },
        { role: "user", content: input.instruction },
      ],
      response_format: { type: "json_object" },
      thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
    };
    if (thinkingEnabled) body.reasoning_effort = this.#options.reasoningEffort ?? this.#config.deepseekReasoningEffort;
    let response: Response;
    try {
      response = await this.#fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: input.signal,
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new SafeApiError("TEXT_PROVIDER_UNREACHABLE", "DeepSeek Text AI 无法访问，请检查 Base URL 或网络连接。", 502, true);
    }
    if (!response.ok) {
      logConceptGeneration({ purpose: input.purpose, httpStatus: response.status, provider: this.descriptor.id, model, rawContentLength: 0, parsedConceptCount: 0, validationResult: `http-${String(response.status)}` });
      throw providerHttpError("DeepSeek Text AI", response);
    }
    const payload = await readProviderJson<DeepSeekResponse>(response, "DeepSeek Text AI");
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", "DeepSeek Text AI 未返回可用的结构化结果。", 502, true);
    let value: unknown;
    try { value = parseJsonContent(content); } catch (error) {
      logConceptGeneration({ purpose: input.purpose, httpStatus: response.status, provider: this.descriptor.id, model, rawContentLength: content.length, parsedConceptCount: 0, validationResult: "parse-failed" });
      throw error;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", "DeepSeek Text AI 返回了错误的数据类型。", 502, true);
    const parsedConceptCount = Array.isArray((value as { concepts?: unknown }).concepts) ? (value as { concepts: unknown[] }).concepts.length : 0;
    logConceptGeneration({ purpose: input.purpose, httpStatus: response.status, provider: this.descriptor.id, model, rawContentLength: content.length, parsedConceptCount, validationResult: "pending" });
    const inputTokens = payload.usage?.prompt_tokens ?? 0;
    const outputTokens = payload.usage?.completion_tokens ?? 0;
    return {
      value: value as Readonly<Record<string, unknown>>,
      trace: {
        providerId: this.descriptor.id,
        model: this.descriptor.model,
        modelVersion: this.descriptor.modelVersion,
        providerRequestId: payload.id,
        httpStatus: response.status,
        rawContentLength: content.length,
        parsed: true,
        usage: { inputTokens, outputTokens, estimatedCostCny: (inputTokens * 2 + outputTokens * 8) / 1_000_000 },
      },
    };
  }

  async testConnection(signal?: AbortSignal): Promise<{ readonly provider: string; readonly model: string; readonly latencyMs: number; readonly status: "connected" }> {
    const startedAt = Date.now();
    const result = await this.complete({ instruction: "返回 {\"status\":\"ok\"}，不要添加其他字段。", purpose: "provider_connection_test", enableSearch: false, schemaHint: { status: "ok" }, signal });
    if (result.value.status !== "ok") throw new SafeApiError("TEXT_INVALID_PROVIDER_OUTPUT", "DeepSeek Text AI 返回了无法验证的连接结果。", 502, true);
    return { provider: this.descriptor.label, model: result.trace.model, latencyMs: Date.now() - startedAt, status: "connected" };
  }

  async structuredGenerate(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult> {
    return this.complete(input);
  }

  async generate(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch?: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult> {
    return this.complete({ ...input, enableSearch: input.enableSearch ?? false });
  }
}

export { DeepSeekTextAdapter as DeepSeekTextProvider };
