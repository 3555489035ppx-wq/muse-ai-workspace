import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { DeterministicMockGenerationProvider } from "../../infrastructure/providers/mock/generation/index.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import { GenerationRepository } from "../../repositories/GenerationRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import type { GenerationProvider, GenerationResult } from "./contracts.js";
import { GenerationProviderError, validateGenerationEvent } from "./contracts.js";

interface AttemptRecord extends ProjectScopedEntity { readonly kind: string; readonly state: "pending" | "success" | "error"; readonly targetEntityId: EntityId; readonly errorCode?: string; }
export interface QueueGenerationInput { readonly projectId: ProjectId; readonly promptVersionId: EntityId; readonly seed: string; readonly operation?: "generate" | "variation" | "edit"; readonly sourceAssetId?: EntityId; readonly instruction?: string; }
export interface RunGenerationResult { readonly jobId: EntityId; readonly status: "succeeded" | "failed" | "cancelled"; readonly attempt: number; readonly result?: GenerationResult; }
const TRANSITIONS = { queued: ["running", "cancelled"], running: ["succeeded", "failed", "cancelled"], succeeded: [], failed: [], cancelled: [] } as const;

export class GenerationJobService {
  readonly #database: MuseDatabase; readonly #repository: GenerationRepository; readonly #provider: GenerationProvider; readonly #ids: () => EntityId;
  readonly #operations: BaseRepository<AttemptRecord>; readonly #requests = new Map<EntityId, QueueGenerationInput>(); readonly #controllers = new Map<EntityId, AbortController>();
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly provider?: GenerationProvider; readonly entityIdFactory?: () => EntityId } = {}) {
    this.#database = database; this.#repository = new GenerationRepository(database); this.#provider = options.provider ?? new DeterministicMockGenerationProvider(); this.#ids = options.entityIdFactory ?? createEntityId;
    this.#operations = new BaseRepository(database.table("operations"), "GenerationAttempt");
  }
  async queue(input: QueueGenerationInput) {
    const promptVersion = await this.#database.table("promptVersions").get(input.promptVersionId);
    if (!promptVersion || promptVersion.projectId !== input.projectId) throw new GenerationProviderError("PROVIDER_FAILURE", "PromptVersion is missing or outside the project.");
    const jobId = this.#ids(); const siblings = await this.#repository.listJobsByProject(input.projectId); const attempt = siblings.filter(item => item.promptVersionId === input.promptVersionId).length + 1;
    await runWriteTransaction(this.#database, [this.#database.table("promptVersions"), this.#database.table("generationJobs"), this.#database.table("operations")], async () => {
      await this.#repository.createJob({ id: jobId, projectId: input.projectId, promptVersionId: input.promptVersionId, adapterTarget: promptVersion.adapterTarget, status: "queued" });
      await this.#operations.create({ id: this.#ids(), projectId: input.projectId, kind: `generation-attempt:${String(attempt)}`, state: "pending", targetEntityId: jobId });
    });
    this.#requests.set(jobId, { ...input, operation: input.operation ?? "generate" }); return { jobId, attempt };
  }
  async #transition(jobId: EntityId, to: "running" | "succeeded" | "failed" | "cancelled", errorCode?: string) {
    const job = await this.#repository.getJob(jobId); if (!job) throw new GenerationProviderError("PROVIDER_FAILURE", "Generation job is missing.");
    if (!(TRANSITIONS[job.status] as readonly string[]).includes(to)) throw new GenerationProviderError("PROVIDER_FAILURE", `Illegal job transition ${job.status} -> ${to}.`);
    return this.#repository.updateJob(jobId, { status: to, errorCode });
  }
  async run(jobId: EntityId): Promise<RunGenerationResult> {
    const request = this.#requests.get(jobId); const job = await this.#repository.getJob(jobId);
    if (!request || !job) throw new GenerationProviderError("PROVIDER_FAILURE", "Queued request is unavailable.");
    const attempt = (await this.#repository.listJobsByProject(job.projectId)).filter(item => item.promptVersionId === job.promptVersionId && item.createdAt <= job.createdAt).length;
    await this.#transition(jobId, "running"); const controller = new AbortController(); this.#controllers.set(jobId, controller);
    const promptVersion = await this.#database.table("promptVersions").get(job.promptVersionId); if (!promptVersion) throw new GenerationProviderError("PROVIDER_FAILURE", "PromptVersion disappeared.");
    const providerRequest = { ...request, promptVersion, operation: request.operation ?? "generate", signal: controller.signal };
    const events = request.operation === "variation" ? this.#provider.variation(providerRequest) : request.operation === "edit" ? this.#provider.edit(providerRequest) : this.#provider.generate(providerRequest);
    for await (const raw of events) { const event = validateGenerationEvent(raw); if (event.type === "result") { await this.#transition(jobId, "succeeded"); await this.#completeAttempt(jobId, "success"); return { jobId, status: "succeeded", attempt, result: event.result }; } if (event.type === "error") { await this.#transition(jobId, "failed", event.code); await this.#completeAttempt(jobId, "error", event.code); return { jobId, status: "failed", attempt }; } if (event.type === "cancelled") { await this.#transition(jobId, "cancelled"); await this.#completeAttempt(jobId, "error", "CANCELLED"); return { jobId, status: "cancelled", attempt }; } }
    await this.#transition(jobId, "failed", "NO_RESULT"); await this.#completeAttempt(jobId, "error", "NO_RESULT"); return { jobId, status: "failed", attempt };
  }
  async #completeAttempt(jobId: EntityId, state: "success" | "error", errorCode?: string) { const records = await this.#database.table<AttemptRecord, EntityId>("operations").where("targetEntityId").equals(jobId).toArray(); const record = records[0]; if (record) await this.#operations.update(record.id, { state, errorCode }); }
  async cancel(jobId: EntityId) { const job = await this.#repository.getJob(jobId); if (!job) throw new GenerationProviderError("PROVIDER_FAILURE", "Generation job is missing."); if (job.status === "queued") { await this.#transition(jobId, "cancelled"); await this.#completeAttempt(jobId, "error", "CANCELLED"); return; } if (job.status !== "running") throw new GenerationProviderError("PROVIDER_FAILURE", `Cannot cancel ${job.status} job.`); this.#controllers.get(jobId)?.abort(); await this.#provider.cancel(jobId); }
  async retry(jobId: EntityId) { const job = await this.#repository.getJob(jobId); if (!job || job.status !== "failed") throw new GenerationProviderError("PROVIDER_FAILURE", "Only a failed generation job can be retried."); const previous = this.#requests.get(jobId); if (!previous) throw new GenerationProviderError("PROVIDER_FAILURE", "Retry input is unavailable."); return this.queue({ ...previous, seed: previous.seed.replace("fail", "retry") }); }
  get(jobId: EntityId) { return this.#repository.getJob(jobId); }
}
