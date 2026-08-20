import type { GenerationEvent, GenerationProvider, GenerationProviderMetadata, GenerationRequest } from "../../../../application/generation/contracts.js";
import { MuseAiClient, MuseAiClientError } from "../../../../lib/api/museAiClient.js";

export class MuseBffGenerationProvider implements GenerationProvider {
  readonly metadata: GenerationProviderMetadata = { id: "muse-bff-dashscope", label: "Muse 真实 AI", mock: false, capabilities: ["generate", "cancel", "retry"] };
  readonly #client: MuseAiClient;
  constructor(client = new MuseAiClient()) { this.#client = client; }
  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const controller = new AbortController(); request.signal?.addEventListener("abort", () => { controller.abort(); }, { once: true });
    yield { type: "queued" }; yield { type: "progress", progress: 15, message: "已通过安全与预算预检" };
    try {
      const result = await this.#client.generateImage({ projectId: request.projectId, promptVersionId: request.promptVersion.id, prompt: request.promptVersion.promptText, negativePrompt: request.promptVersion.negativePrompt, idempotencyKey: `${request.projectId}:${request.promptVersion.id}:${request.seed}` }, controller.signal);
      yield { type: "result", result: { fixtureKey: `live:${result.runId}`, assetUrl: result.assetUrl, mimeType: result.mimeType as "image/png" | "image/jpeg" | "image/webp", width: 2048, height: 2048, seed: request.seed, byteSize: 1, providerId: result.trace.providerId, model: result.trace.model, modelVersion: result.trace.modelVersion, providerRunId: result.runId, estimatedCostCny: result.trace.usage.estimatedCostCny } };
    } catch (error) {
      if (controller.signal.aborted) { yield { type: "cancelled" }; return; }
      yield { type: "error", code: error instanceof MuseAiClientError ? error.code : "PROVIDER_FAILURE", message: error instanceof Error ? error.message : "真实 AI 生成失败" };
    }
  }
  variation(): AsyncIterable<GenerationEvent> { return this.#unsupported("当前真实 Provider 暂未开放变体操作。"); }
  edit(): AsyncIterable<GenerationEvent> { return this.#unsupported("请通过受控编辑工作流执行图像编辑。"); }
  async *#unsupported(message: string): AsyncIterable<GenerationEvent> { await Promise.resolve(); yield { type: "error", code: "UNSUPPORTED_CAPABILITY", message }; }
  cancel(): Promise<void> { return Promise.resolve(); }
  retry(request: GenerationRequest): AsyncIterable<GenerationEvent> { return this.generate(request); }
}
