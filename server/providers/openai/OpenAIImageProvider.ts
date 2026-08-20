import { SafeApiError } from "../../api/envelope.js";
import type { MuseServerConfig } from "../../config.js";
import { validateExternalHttpsUrl } from "../../security/policy.js";
import { providerHttpError } from "../errors.js";
import { readProviderJson } from "../response.js";
import type { ImageProvider, ImageProviderResult, ProviderSourceImage } from "../types.js";

export interface ImageProviderOptions {
  readonly id?: string;
  readonly label?: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
}

interface OpenAIImageResponse {
  readonly id?: string;
  readonly data?: readonly { readonly b64_json?: string; readonly url?: string }[];
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export class OpenAIImageProvider implements ImageProvider {
  readonly descriptor;
  readonly #config: MuseServerConfig;
  readonly #options: ImageProviderOptions;
  readonly #fetch: typeof fetch;

  constructor(config: MuseServerConfig, fetcher: typeof fetch = fetch, options: ImageProviderOptions = {}) {
    this.#config = config;
    this.#options = options;
    this.#fetch = fetcher;
    this.descriptor = {
      id: options.id ?? "openai-image",
      label: options.label ?? "OpenAI Image AI",
      region: "global" as const,
      model: options.model ?? config.openaiImageModel,
      modelVersion: options.model ?? config.openaiImageModel,
      capabilities: ["image_generate", "image_edit"] as const,
      configured: Boolean(options.apiKey ?? config.openaiApiKey),
    };
  }

  generate(input: { readonly prompt: string; readonly size: "1K" | "2K"; readonly signal?: AbortSignal }): Promise<ImageProviderResult> {
    return this.#generate(input.prompt, input.size, input.signal);
  }

  async edit(input: { readonly prompt: string; readonly sourceImages: readonly ProviderSourceImage[]; readonly size: "1K" | "2K"; readonly signal?: AbortSignal }): Promise<ImageProviderResult> {
    const apiKey = this.#apiKey();
    if (!input.sourceImages.length) throw new SafeApiError("IMAGE_SOURCE_REQUIRED", "图像编辑至少需要一张已生成的源图。", 422);
    const body = new FormData();
    body.set("model", this.#model());
    body.set("prompt", input.prompt);
    body.set("size", this.#size(input.size));
    body.set("quality", input.size === "2K" ? "high" : "medium");
    body.set("output_format", "webp");
    for (const source of input.sourceImages.slice(0, 4)) {
      const copy = new Uint8Array(source.bytes.byteLength);
      copy.set(source.bytes);
      body.append("image[]", new Blob([copy.buffer], { type: source.mimeType }), source.name);
    }
    const response = await this.#fetch(`${this.#baseUrl()}/images/edits`, {
      method: "POST",
      signal: input.signal,
      headers: { authorization: `Bearer ${apiKey}` },
      body,
    });
    return this.#decode(response);
  }

  async #generate(prompt: string, size: "1K" | "2K", signal?: AbortSignal): Promise<ImageProviderResult> {
    const apiKey = this.#apiKey();
    const response = await this.#fetch(`${this.#baseUrl()}/images/generations`, {
      method: "POST",
      signal,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.#model(), prompt, n: 1, size: this.#size(size), quality: size === "2K" ? "high" : "medium", output_format: "webp" }),
    });
    return this.#decode(response);
  }

  #apiKey(): string {
    const apiKey = this.#options.apiKey ?? this.#config.openaiApiKey;
    if (!apiKey) throw new SafeApiError("IMAGE_PROVIDER_NOT_CONFIGURED", "OpenAI Image AI 尚未在服务端配置。", 503);
    return apiKey;
  }

  #baseUrl(): string { return this.#options.baseUrl ?? this.#config.openaiBaseUrl; }
  #model(): string { return this.#options.model ?? this.#config.openaiImageModel; }

  #size(size: "1K" | "2K"): "1024x1024" | "1536x1024" { return size === "2K" ? "1536x1024" : "1024x1024"; }

  async #decode(response: Response): Promise<ImageProviderResult> {
    if (!response.ok) throw providerHttpError("OpenAI Image AI", response);
    const payload = await readProviderJson<OpenAIImageResponse>(response, "OpenAI Image AI");
    const first = payload.data?.[0];
    let bytes: Uint8Array;
    let mimeType: ImageProviderResult["mimeType"] = "image/webp";
    if (first?.b64_json) {
      bytes = new Uint8Array(Buffer.from(first.b64_json, "base64"));
    } else if (first?.url) {
      const imageResponse = await this.#fetch(validateExternalHttpsUrl(first.url), { redirect: "error" });
      const contentType = imageResponse.headers.get("content-type")?.split(";")[0];
      if (!imageResponse.ok || !contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) throw new SafeApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "OpenAI Image AI 返回的图像未通过安全校验。", 502, true);
      mimeType = contentType as ImageProviderResult["mimeType"];
      bytes = new Uint8Array(await imageResponse.arrayBuffer());
    } else {
      throw new SafeApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "OpenAI Image AI 未返回图像数据。", 502, true);
    }
    if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new SafeApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "OpenAI Image AI 返回的图像大小不符合要求。", 502, true);
    return {
      bytes,
      mimeType,
      trace: { providerId: this.descriptor.id, model: this.descriptor.model, modelVersion: this.descriptor.modelVersion, providerRequestId: payload.id, usage: { imageCount: 1, estimatedCostCny: 0.3 } },
    };
  }
}
