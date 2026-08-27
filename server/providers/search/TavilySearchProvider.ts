import { createHash } from "node:crypto";
import { SafeApiError } from "../../api/envelope.js";
import { validateExternalHttpsUrl } from "../../security/policy.js";
import { providerHttpError } from "../errors.js";
import { readProviderJson } from "../response.js";
import type { ResearchSearchResult, SearchProvider, SearchProviderResult } from "../types.js";

interface TavilyResult {
  readonly title?: unknown;
  readonly url?: unknown;
  readonly content?: unknown;
  readonly raw_content?: unknown;
  readonly published_date?: unknown;
  readonly score?: unknown;
  readonly favicon?: unknown;
  readonly id?: unknown;
}

interface TavilyResponse {
  readonly results?: readonly TavilyResult[];
  readonly request_id?: unknown;
  readonly usage?: { readonly credits?: unknown };
}

const MAX_TITLE = 240;
const MAX_SNIPPET = 700;
const MAX_RAW_CONTENT = 8_000;

function clean(value: unknown): string { return (typeof value === "string" || typeof value === "number" ? String(value) : "").replace(/\s+/g, " ").trim(); }
function clip(value: unknown, max: number): string {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
function resultId(url: string, index: number): string {
  return `tavily-${createHash("sha256").update(url).digest("hex").slice(0, 16)}-${String(index + 1)}`;
}
function publisherFor(url: URL): string { return url.hostname.replace(/^www\./i, "") || "公开网页"; }

export class TavilySearchProvider implements SearchProvider {
  readonly descriptor;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(apiKey: string, baseUrl = "https://api.tavily.com", fetcher: typeof fetch = fetch) {
    this.#apiKey = apiKey.trim();
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = fetcher;
    this.descriptor = {
      id: "tavily-search",
      label: "Tavily Web Search",
      region: "global" as const,
      model: "tavily-search",
      modelVersion: "tavily-search",
      capabilities: ["search"] as const,
      configured: Boolean(this.#apiKey),
    };
  }

  async search(input: { readonly query: string; readonly maxResults: number; readonly signal?: AbortSignal }): Promise<SearchProviderResult> {
    if (!this.#apiKey) throw new SafeApiError("SEARCH_PROVIDER_NOT_CONFIGURED", "Web Search 尚未配置站点 API Key。", 503);
    const response = await this.#fetch(`${this.#baseUrl}/search`, {
      method: "POST",
      signal: input.signal,
      headers: { authorization: `Bearer ${this.#apiKey}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: input.query, search_depth: "basic", topic: "general", max_results: input.maxResults, include_answer: false, include_raw_content: "markdown", include_images: false, include_favicon: true, include_usage: true }),
    }).catch(() => { throw new SafeApiError("SEARCH_PROVIDER_UNREACHABLE", "Web Search 无法访问，请稍后重试。", 502, true); });
    if (!response.ok) throw providerHttpError("Tavily Web Search", response);
    const payload = await readProviderJson<TavilyResponse>(response, "Tavily Web Search");
    const seen = new Set<string>();
    const results: ResearchSearchResult[] = [];
    for (const [index, item] of (payload.results ?? []).entries()) {
      const title = clip(item.title, MAX_TITLE);
      const rawUrl = clean(item.url);
      if (!title || !rawUrl) continue;
      let url: URL;
      try { url = validateExternalHttpsUrl(rawUrl); } catch { continue; }
      const normalizedUrl = url.toString();
      if (seen.has(normalizedUrl)) continue;
      const rawContent = clip(item.raw_content, MAX_RAW_CONTENT);
      const snippet = clip(item.content ?? rawContent, MAX_SNIPPET);
      if (!snippet) continue;
      seen.add(normalizedUrl);
      results.push({ id: clean(item.id) || resultId(normalizedUrl, index), title, url: normalizedUrl, publisher: publisherFor(url), publishedAt: clean(item.published_date) || null, snippet, rawContent: rawContent || undefined, contentStatus: rawContent ? "full" : "snippet", score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : undefined, favicon: clean(item.favicon) || null });
      if (results.length >= input.maxResults) break;
    }
    const credits = Number(payload.usage?.credits ?? 1);
    return { query: input.query, results, trace: { providerId: this.descriptor.id, model: this.descriptor.model, modelVersion: this.descriptor.modelVersion, providerRequestId: clean(payload.request_id) || undefined, httpStatus: response.status, rawContentLength: results.reduce((total, item) => total + (item.rawContent?.length ?? 0), 0), parsed: true, usage: { estimatedCostCny: Number.isFinite(credits) && credits > 0 ? credits * 0.01 : 0.01 } } };
  }
}
