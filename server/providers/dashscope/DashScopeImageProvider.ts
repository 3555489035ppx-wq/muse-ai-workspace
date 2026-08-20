import { SafeApiError } from "../../api/envelope.js";
import type { MuseServerConfig } from "../../config.js";
import { dashscopeBaseUrl } from "../../config.js";
import { validateExternalHttpsUrl } from "../../security/policy.js";
import type { ImageProvider, ImageProviderResult, ProviderSourceImage } from "../types.js";
import { readProviderJson } from "../response.js";

interface DashScopeImageResponse {
  readonly request_id?: string;
  readonly output?: { readonly choices?: readonly { readonly message?: { readonly content?: readonly { readonly type?: string; readonly image?: string }[] } }[] };
  readonly usage?: { readonly image_count?: number; readonly size?: string };
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export class DashScopeImageProvider implements ImageProvider {
  readonly descriptor;
  readonly #config: MuseServerConfig;
  readonly #fetch: typeof fetch;
  constructor(config: MuseServerConfig, fetcher: typeof fetch = fetch) {
    this.#config = config; this.#fetch = fetcher;
    this.descriptor = { id: "dashscope-image", label: "阿里云百炼 · 万相", region: "cn-beijing" as const, model: config.imageModel, modelVersion: config.imageModel, capabilities: ["image_generate", "image_edit"] as const, configured: Boolean(config.dashscopeApiKey && config.dashscopeWorkspaceId) };
  }
  generate(input: { readonly prompt: string; readonly size: "1K" | "2K"; readonly signal?: AbortSignal }): Promise<ImageProviderResult> { return this.#run(input.prompt, [], input.size, input.signal); }
  edit(input: { readonly prompt: string; readonly sourceImages: readonly ProviderSourceImage[]; readonly size: "1K" | "2K"; readonly signal?: AbortSignal }): Promise<ImageProviderResult> {
    if (input.sourceImages.length) throw new SafeApiError("UNSUPPORTED_OPERATION", "旧版万相适配器不支持本地资产编辑。", 501);
    return this.#run(input.prompt, [], input.size, input.signal);
  }
  async #run(prompt: string, sourceUrls: readonly string[], size: "1K" | "2K", signal?: AbortSignal): Promise<ImageProviderResult> {
    if (!this.#config.dashscopeApiKey || !this.#config.dashscopeWorkspaceId) throw new SafeApiError("PROVIDER_NOT_CONFIGURED", "服务端未配置百炼工作空间。", 503);
    const images = sourceUrls.map((value) => ({ image: value }));
    const response = await this.#fetch(`${dashscopeBaseUrl(this.#config)}/api/v1/services/aigc/multimodal-generation/generation`, {
      method: "POST", signal,
      headers: { authorization: `Bearer ${this.#config.dashscopeApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.#config.imageModel, input: { messages: [{ role: "user", content: [...images, { text: prompt }] }] }, parameters: { size, n: 1, watermark: false, thinking_mode: true } }),
    });
    if (!response.ok) throw new SafeApiError("PROVIDER_FAILURE", "真实图像生成失败，请稍后重试。", 502, response.status >= 500 || response.status === 429);
    const payload = await readProviderJson<DashScopeImageResponse>(response, "阿里云万相");
    const imageUrl = payload.output?.choices?.flatMap((choice) => choice.message?.content ?? []).find((item) => item.type === "image")?.image;
    if (!imageUrl) throw new SafeApiError("INVALID_PROVIDER_OUTPUT", "图像服务未返回有效结果。", 502);
    const safeUrl = validateExternalHttpsUrl(imageUrl);
    const imageResponse = await this.#fetch(safeUrl, { signal, redirect: "error" });
    const contentLength = Number(imageResponse.headers.get("content-length") ?? 0);
    const contentType = imageResponse.headers.get("content-type")?.split(";")[0];
    if (!imageResponse.ok || !contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType) || contentLength > MAX_IMAGE_BYTES) throw new SafeApiError("INVALID_IMAGE", "生成图像未通过安全校验。", 502);
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new SafeApiError("INVALID_IMAGE", "生成图像大小不符合要求。", 502);
    const count = payload.usage?.image_count ?? 1;
    return { bytes, mimeType: contentType as ImageProviderResult["mimeType"], trace: { providerId: this.descriptor.id, model: this.descriptor.model, modelVersion: this.descriptor.modelVersion, providerRequestId: payload.request_id, usage: { imageCount: count, estimatedCostCny: count * 0.2 } } };
  }
}
