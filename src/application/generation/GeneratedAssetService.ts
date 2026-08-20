import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { ProjectWorkflowService } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { IndexedDbAssetStorage } from "../../db/assetStorage.js";
import { AssetRepository } from "../../repositories/AssetRepository.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import { GenerationRepository } from "../../repositories/GenerationRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { VersionRepository } from "../../repositories/VersionRepository.js";
import { GenerationProviderError, type GenerationResult } from "./contracts.js";

interface WorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
export interface PersistGeneratedAssetInput { readonly projectId: ProjectId; readonly jobId: EntityId; readonly result: GenerationResult; }

export class GeneratedAssetService {
  readonly #database: MuseDatabase; readonly #assets: AssetRepository; readonly #generated: GenerationRepository; readonly #versions: VersionRepository;
  readonly #workflows: BaseRepository<WorkflowRecord>; readonly #workflow = new ProjectWorkflowService(); readonly #ids: () => EntityId; readonly #fault?: () => void | Promise<void>; readonly #fetch: typeof fetch;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly entityIdFactory?: () => EntityId; readonly faultInjector?: () => void | Promise<void>; readonly fetcher?: typeof fetch } = {}) {
    this.#database = database; this.#assets = new AssetRepository(database); this.#generated = new GenerationRepository(database); this.#versions = new VersionRepository(database); this.#workflows = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow"); this.#ids = options.entityIdFactory ?? createEntityId; this.#fault = options.faultInjector; this.#fetch = options.fetcher ?? fetch;
  }
  async persist(input: PersistGeneratedAssetInput) {
    const job = await this.#generated.getJob(input.jobId);
    if (!job || job.projectId !== input.projectId || job.status !== "succeeded") throw new GenerationProviderError("PROVIDER_FAILURE", "Only a succeeded same-project job can create an asset.");
    const existing = await this.#generated.listGeneratedByJob(job.id); if (existing[0]) return existing[0];
    const assetId = this.#ids(); const generatedAssetId = this.#ids(); const sourceId = this.#ids(); const versionId = this.#ids();
    let blob = new Blob([`Muse deterministic fixture:${input.result.fixtureKey}`], { type: input.result.mimeType });
    if (input.result.assetUrl !== undefined) {
      if (!input.result.assetUrl.startsWith("/api/ai/assets/")) throw new GenerationProviderError("PROVIDER_FAILURE", "Remote asset URL must use the Muse BFF asset gateway.");
      const response = await this.#fetch(input.result.assetUrl, { headers: { accept: "image/png,image/jpeg,image/webp" } });
      if (!response.ok) throw new GenerationProviderError("PROVIDER_FAILURE", "Generated asset download failed.");
      blob = await response.blob();
      if (blob.size <= 0 || blob.size > 25 * 1024 * 1024 || blob.type !== input.result.mimeType) throw new GenerationProviderError("PROVIDER_FAILURE", "Generated asset failed byte validation.");
    }
    const workflowRecord = await this.#database.table<WorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(input.projectId).first();
    const tables = ["projects", "promptVersions", "generationJobs", "assets", "assetBlobs", "assetSources", "generatedAssets", "versionSnapshots", "workflowRuns"].map(name => this.#database.table(name));
    await runWriteTransaction(this.#database, tables, async () => {
      await this.#assets.createWithBlob({ id: assetId, name: `${input.result.fixtureKey}.webp`, type: "image", status: "ready", mimeType: input.result.mimeType, byteSize: blob.size, storageKey: `generated/${assetId}` }, blob);
      const generated = await this.#generated.createGeneratedAsset({ id: generatedAssetId, projectId: input.projectId, generationJobId: job.id, promptVersionId: job.promptVersionId, assetId, mimeType: input.result.mimeType, width: input.result.width, height: input.result.height, seed: input.result.seed, remoteAssetUrl: input.result.assetUrl, providerId: input.result.providerId, model: input.result.model, modelVersion: input.result.modelVersion, providerRunId: input.result.providerRunId, estimatedCostCny: input.result.estimatedCostCny });
      await this.#assets.createSource({ id: sourceId, projectId: input.projectId, assetId, type: "generated", sourceId: generated.id, label: "Muse 确定性 Mock 生成" });
      await this.#fault?.();
      await this.#versions.create({ id: versionId, projectId: input.projectId, entityType: "generated_asset", entityId: generated.id, schemaVersion: 1, label: "generated:initial", snapshot: { fixtureKey: input.result.fixtureKey, jobId: job.id, promptVersionId: job.promptVersionId, assetId, seed: input.result.seed } });
      if (workflowRecord) { let state = workflowRecord.state; for (const next of ["PROMPTING", "PROMPT_READY", "GENERATING", "GENERATED"] as const) if (this.#workflow.canTransition(state, next)) state = this.#workflow.transition(state, next); await this.#workflows.update(workflowRecord.id, { state }); }
    });
    const saved = await this.#generated.getGeneratedAsset(generatedAssetId); if (!saved) throw new GenerationProviderError("PROVIDER_FAILURE", "Generated asset transaction did not persist."); return saved;
  }
  getBlob(assetId: EntityId) { return new IndexedDbAssetStorage(this.#database).get(assetId); }
}
