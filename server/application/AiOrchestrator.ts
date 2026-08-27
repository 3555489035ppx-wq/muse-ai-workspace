import { createHash, randomUUID } from "node:crypto";
import { SafeApiError } from "../api/envelope.js";
import type { MuseServerConfig } from "../config.js";
import type { ImageAiRequest, ResearchSearchRequest, StructuredAiRequest } from "../contracts/ai.js";
import { assertLiveDispatchAllowed, authorizeProject, validateInstruction } from "../security/policy.js";
import type { ImageProvider, ProviderSourceImage, SearchProvider, StructuredProvider } from "../providers/types.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type { AiRunRepository} from "./AiRunRepository.js";
import { type AiRunRecord } from "./AiRunRepository.js";
import type { AssetStore } from "./AssetStore.js";
import type { BudgetService } from "./BudgetService.js";

function hashInput(input: unknown): string { return createHash("sha256").update(JSON.stringify(input)).digest("hex"); }
export class AiOrchestrator {
  constructor(
    readonly config: MuseServerConfig,
    readonly registry: ProviderRegistry,
    readonly runs: AiRunRepository,
    readonly budgets: BudgetService,
    readonly assets: AssetStore,
  ) {}
  async #start(headers: Headers, projectId: string, idempotencyKey: string, operation: string, stage: string, input: unknown, estimate: number): Promise<{ readonly replay?: AiRunRecord; readonly run: AiRunRecord }> {
    authorizeProject(headers, projectId, this.config); assertLiveDispatchAllowed(this.config); await this.budgets.ready(); this.budgets.estimateOrThrow(projectId, estimate);
    const inputHash = hashInput(input); const existing = await this.runs.findByIdempotency(this.config.actorId, projectId, idempotencyKey);
    if (existing) {
      if (existing.inputHash !== inputHash || existing.operation !== operation) throw new SafeApiError("IDEMPOTENCY_CONFLICT", "重复请求的内容不一致。", 409);
      return { replay: existing, run: existing };
    }
    const now = new Date().toISOString(); const run: AiRunRecord = { id: randomUUID(), actorId: this.config.actorId, projectId, operation, stage, idempotencyKey, inputHash, status: "running", createdAt: now, updatedAt: now };
    await this.runs.create(run); return { run };
  }
  async structured(headers: Headers, input: StructuredAiRequest): Promise<unknown> {
    if (input.enableSearch) throw new SafeApiError("TEXT_SEARCH_UNAVAILABLE", "联网检索已拆分为独立研究搜索，请使用研究搜索流程。", 422);
    const startedAt = Date.now();
    const start = await this.#start(headers, input.projectId, input.idempotencyKey, "structured", input.purpose, input, 0.15);
    if (start.replay?.status === "succeeded") return start.replay.safeResult;
    const provider = this.registry.require("structured") as StructuredProvider;
    try {
      const result = await provider.complete({ instruction: validateInstruction(input.instruction), purpose: input.purpose, enableSearch: input.enableSearch, schemaHint: input.schemaHint });
      await this.budgets.record({ projectId: input.projectId, runId: start.run.id, amountCny: result.trace.usage.estimatedCostCny, recordedAt: new Date().toISOString() });
      const safeResult = { runId: start.run.id, result: result.value, trace: result.trace };
      await this.runs.update(start.run.id, { status: "succeeded", providerId: result.trace.providerId, model: result.trace.model, providerRequestId: result.trace.providerRequestId, costCny: result.trace.usage.estimatedCostCny, latencyMs: Date.now() - startedAt, safeResult });
      return safeResult;
    } catch (error) { await this.runs.update(start.run.id, { status: "failed", latencyMs: Date.now() - startedAt, safeErrorCode: error instanceof SafeApiError ? error.code : "PROVIDER_FAILURE" }); throw error; }
  }

  async search(headers: Headers, input: ResearchSearchRequest): Promise<unknown> {
    const startedAt = Date.now();
    const start = await this.#start(headers, input.projectId, input.idempotencyKey, "search", "research", input, 0.02);
    if (start.replay?.status === "succeeded") return start.replay.safeResult;
    const provider = this.registry.require("search") as SearchProvider;
    try {
      const result = await provider.search({ query: validateInstruction(input.query).slice(0, 300), maxResults: input.maxResults });
      await this.budgets.record({ projectId: input.projectId, runId: start.run.id, amountCny: result.trace.usage.estimatedCostCny, recordedAt: new Date().toISOString() });
      const safeResult = { runId: start.run.id, query: result.query, results: result.results, trace: result.trace };
      await this.runs.update(start.run.id, { status: "succeeded", providerId: result.trace.providerId, model: result.trace.model, providerRequestId: result.trace.providerRequestId, costCny: result.trace.usage.estimatedCostCny, latencyMs: Date.now() - startedAt, safeResult });
      return safeResult;
    } catch (error) {
      await this.runs.update(start.run.id, { status: "failed", latencyMs: Date.now() - startedAt, safeErrorCode: error instanceof SafeApiError ? error.code : "PROVIDER_FAILURE" });
      throw error;
    }
  }
  async image(headers: Headers, input: ImageAiRequest, operation: "image_generate" | "image_edit"): Promise<unknown> {
    const startedAt = Date.now();
    const start = await this.#start(headers, input.projectId, input.idempotencyKey, operation, input.stage, input, 0.2);
    if (start.replay?.status === "succeeded") return start.replay.safeResult;
    const provider = this.registry.require(operation) as ImageProvider;
    try {
      const prompt = validateInstruction([input.prompt, input.negativePrompt ? `避免：${input.negativePrompt}` : ""].filter(Boolean).join("\n"));
      const sourceImages = operation === "image_edit" ? await this.#resolveSourceImages(input.sourceAssetUrls) : [];
      const result = operation === "image_edit" ? await provider.edit({ prompt, sourceImages, size: input.size }) : await provider.generate({ prompt, size: input.size });
      const assetName = await this.assets.put(start.run.id, result.bytes, result.mimeType);
      await this.budgets.record({ projectId: input.projectId, runId: start.run.id, amountCny: result.trace.usage.estimatedCostCny, recordedAt: new Date().toISOString() });
      const safeResult = { runId: start.run.id, assetUrl: `/api/ai/assets/${assetName}`, mimeType: result.mimeType, promptVersionId: input.promptVersionId, trace: result.trace };
      await this.runs.update(start.run.id, { status: "succeeded", providerId: result.trace.providerId, model: result.trace.model, providerRequestId: result.trace.providerRequestId, costCny: result.trace.usage.estimatedCostCny, latencyMs: Date.now() - startedAt, safeResult });
      return safeResult;
    } catch (error) { await this.runs.update(start.run.id, { status: "failed", latencyMs: Date.now() - startedAt, safeErrorCode: error instanceof SafeApiError ? error.code : "PROVIDER_FAILURE" }); throw error; }
  }

  async probeText(): Promise<unknown> {
    assertLiveDispatchAllowed(this.config);
    const provider = this.registry.require("structured") as StructuredProvider;
    const startedAt = Date.now();
    const result = await provider.complete({ instruction: "返回 {\"status\":\"ok\"}，不要添加其他字段。", purpose: "project_brain", enableSearch: false, schemaHint: { status: "ok" } });
    return { provider: provider.descriptor.label, model: result.trace.model, latencyMs: Date.now() - startedAt, status: result.value.status === "ok" ? "connected" : "invalid-output" };
  }

  async probeImage(): Promise<unknown> {
    assertLiveDispatchAllowed(this.config);
    const provider = this.registry.require("image_generate") as ImageProvider;
    const startedAt = Date.now();
    const result = await provider.generate({ prompt: "Minimal industrial design calibration object on a neutral studio background, one object, no text, no logo.", size: "1K" });
    return { provider: provider.descriptor.label, model: result.trace.model, latencyMs: Date.now() - startedAt, status: result.bytes.byteLength > 0 ? "connected" : "invalid-output" };
  }

  async #resolveSourceImages(urls: readonly string[]): Promise<readonly ProviderSourceImage[]> {
    const images: ProviderSourceImage[] = [];
    for (const url of urls) {
      const pathname = (() => { try { return new URL(url, "http://muse.local").pathname; } catch { return ""; } })();
      if (!pathname.startsWith("/api/ai/assets/")) throw new SafeApiError("IMAGE_SOURCE_NOT_MANAGED", "图像编辑只接受 Muse 已保存的生成资产。", 422);
      const name = pathname.split("/").at(-1) ?? "";
      const asset = await this.assets.get(name);
      images.push({ bytes: new Uint8Array(asset.bytes), mimeType: asset.mimeType, name });
    }
    return images;
  }
}
