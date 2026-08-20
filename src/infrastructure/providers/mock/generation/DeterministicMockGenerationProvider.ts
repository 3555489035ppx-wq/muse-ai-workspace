import type { GenerationEvent, GenerationProvider, GenerationProviderMetadata, GenerationRequest } from "../../../../application/generation/contracts.js";

function fixtureKey(request: GenerationRequest): string {
  const text = `${request.projectId}:${request.promptVersion.id}:${request.operation}:${request.seed}:${request.instruction ?? ""}`;
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `muse-mock-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export class DeterministicMockGenerationProvider implements GenerationProvider {
  readonly metadata: GenerationProviderMetadata = { id: "muse-deterministic-mock", label: "Muse 确定性 Mock 生成", mock: true, capabilities: ["generate", "variation", "edit", "cancel", "retry"] };
  async *#events(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    await Promise.resolve();
    yield { type: "queued" };
    if (request.signal?.aborted) { yield { type: "cancelled" }; return; }
    yield { type: "progress", progress: 35, message: "构建确定性视觉夹具" };
    if (request.seed.includes("fail")) { yield { type: "error", code: "MOCK_GENERATION_FAILED", message: "已按测试种子触发生成失败。" }; return; }
    if (request.signal?.aborted) { yield { type: "cancelled" }; return; }
    yield { type: "progress", progress: 80, message: "写入生成结果元数据" };
    const key = fixtureKey(request);
    yield { type: "result", result: { fixtureKey: key, mimeType: "image/webp", width: 1280, height: 960, seed: request.seed, byteSize: key.length } };
  }
  generate(request: GenerationRequest) { return this.#events(request); }
  variation(request: GenerationRequest) { return this.#events({ ...request, operation: "variation" }); }
  edit(request: GenerationRequest) { return this.#events({ ...request, operation: "edit" }); }
  retry(request: GenerationRequest) { return this.#events(request); }
  async cancel(): Promise<void> { return Promise.resolve(); }
}
