import type { Table } from "dexie";
import type { Asset } from "../domain/asset/index.js";
import { EntityNotFoundError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { GeneratedAsset, GenerationJob, ImageEdit } from "../domain/generation/index.js";
import type { PromptVersion } from "../domain/prompt/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

export class GenerationRepository {
  readonly #promptVersions: Table<PromptVersion, EntityId>;
  readonly #assets: Table<Asset, EntityId>;
  readonly #jobsTable: Table<GenerationJob, EntityId>;
  readonly #generatedTable: Table<GeneratedAsset, EntityId>;
  readonly #jobs: BaseRepository<GenerationJob>;
  readonly #generated: BaseRepository<GeneratedAsset>;
  readonly #edits: BaseRepository<ImageEdit>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#promptVersions = database.table("promptVersions");
    this.#assets = database.table("assets");
    this.#jobsTable = database.table("generationJobs");
    this.#generatedTable = database.table("generatedAssets");
    this.#jobs = new BaseRepository(this.#jobsTable, "GenerationJob", clock);
    this.#generated = new BaseRepository(this.#generatedTable, "GeneratedAsset", clock);
    this.#edits = new BaseRepository(database.table("imageEdits"), "ImageEdit", clock);
  }

  async #validateJob(entity: Pick<GenerationJob, "projectId" | "promptVersionId" | "adapterTarget">): Promise<void> {
    const prompt = await requireParent(this.#promptVersions, entity.promptVersionId, entity.projectId, "PromptVersion");
    if (prompt.adapterTarget !== entity.adapterTarget) {
      throw new ParentEntityMismatchError("PromptVersion", entity.promptVersionId, entity.projectId);
    }
  }

  async #validateGenerated(entity: Pick<GeneratedAsset, "projectId" | "generationJobId" | "promptVersionId" | "assetId">): Promise<void> {
    const job = await requireParent(this.#jobsTable, entity.generationJobId, entity.projectId, "GenerationJob");
    await requireParent(this.#promptVersions, entity.promptVersionId, entity.projectId, "PromptVersion");
    if (job.promptVersionId !== entity.promptVersionId) {
      throw new ParentEntityMismatchError("GenerationJob", entity.generationJobId, entity.projectId);
    }
    if ((await this.#assets.get(entity.assetId)) === undefined) throw new EntityNotFoundError("Asset", entity.assetId);
  }

  async #validateEdit(entity: Pick<ImageEdit, "projectId" | "generatedAssetId" | "sourceAssetId" | "promptVersionId">): Promise<void> {
    const generated = await requireParent(this.#generatedTable, entity.generatedAssetId, entity.projectId, "GeneratedAsset");
    await requireParent(this.#promptVersions, entity.promptVersionId, entity.projectId, "PromptVersion");
    if (generated.promptVersionId !== entity.promptVersionId) {
      throw new ParentEntityMismatchError("GeneratedAsset", entity.generatedAssetId, entity.projectId);
    }
    if ((await this.#assets.get(entity.sourceAssetId)) === undefined) throw new EntityNotFoundError("Asset", entity.sourceAssetId);
  }

  async createJob(input: CreateEntityInput<GenerationJob>): Promise<GenerationJob> { await this.#validateJob(input); return this.#jobs.create(input); }
  async updateJob(id: EntityId, patch: UpdateEntityInput<GenerationJob>): Promise<GenerationJob> { const current = await this.#jobs.require(id); await this.#validateJob({ ...current, ...patch }); return this.#jobs.update(id, patch); }
  getJob(id: EntityId) { return this.#jobs.get(id); }
  deleteJob(id: EntityId) { return this.#jobs.delete(id); }
  listJobsByProject(projectId: ProjectId) { return this.#jobs.query((item) => item.projectId === projectId); }

  async createGeneratedAsset(input: CreateEntityInput<GeneratedAsset>): Promise<GeneratedAsset> { await this.#validateGenerated(input); return this.#generated.create(input); }
  async updateGeneratedAsset(id: EntityId, patch: UpdateEntityInput<GeneratedAsset>): Promise<GeneratedAsset> { const current = await this.#generated.require(id); await this.#validateGenerated({ ...current, ...patch }); return this.#generated.update(id, patch); }
  getGeneratedAsset(id: EntityId) { return this.#generated.get(id); }
  deleteGeneratedAsset(id: EntityId) { return this.#generated.delete(id); }
  listGeneratedByJob(jobId: EntityId) { return this.#generated.query((item) => item.generationJobId === jobId); }

  async createImageEdit(input: CreateEntityInput<ImageEdit>): Promise<ImageEdit> { await this.#validateEdit(input); return this.#edits.create(input); }
  async updateImageEdit(id: EntityId, patch: UpdateEntityInput<ImageEdit>): Promise<ImageEdit> { const current = await this.#edits.require(id); await this.#validateEdit({ ...current, ...patch }); return this.#edits.update(id, patch); }
  getImageEdit(id: EntityId) { return this.#edits.get(id); }
  deleteImageEdit(id: EntityId) { return this.#edits.delete(id); }
}
