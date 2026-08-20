import type { Table } from "dexie";
import type { Direction } from "../domain/direction/index.js";
import { DomainError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { Exploration } from "../domain/exploration/index.js";
import type { GeneratedAsset } from "../domain/generation/index.js";
import type { PromptVersion } from "../domain/prompt/index.js";
import { isReviewDimension, type AIReview } from "../domain/review/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

type ReviewParents = Pick<AIReview, "projectId" | "generatedAssetId" | "promptVersionId" | "directionId" | "dimensions" | "summary">;

export class ReviewRepository {
  readonly #generatedAssets: Table<GeneratedAsset, EntityId>;
  readonly #promptVersions: Table<PromptVersion, EntityId>;
  readonly #directions: Table<Direction, EntityId>;
  readonly #explorations: Table<Exploration, EntityId>;
  readonly #reviews: BaseRepository<AIReview>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#generatedAssets = database.table("generatedAssets");
    this.#promptVersions = database.table("promptVersions");
    this.#directions = database.table("directions");
    this.#explorations = database.table("explorations");
    this.#reviews = new BaseRepository(database.table("aiReviews"), "AIReview", clock);
  }

  async #validate(entity: ReviewParents): Promise<void> {
    const generatedAsset = await requireParent(this.#generatedAssets, entity.generatedAssetId, entity.projectId, "GeneratedAsset");
    const promptVersion = await requireParent(this.#promptVersions, entity.promptVersionId, entity.projectId, "PromptVersion");
    await requireParent(this.#directions, entity.directionId, entity.projectId, "Direction");
    await requireParent(this.#explorations, promptVersion.explorationId, entity.projectId, "Exploration");

    if (generatedAsset.promptVersionId !== promptVersion.id || promptVersion.directionId !== entity.directionId) {
      throw new ParentEntityMismatchError("AIReview lineage", entity.generatedAssetId, entity.projectId);
    }
    if (typeof entity.summary !== "string" || entity.summary.trim().length === 0 || entity.dimensions.length === 0 || !entity.dimensions.every(isReviewDimension)) {
      throw new DomainError("INVALID_AI_REVIEW", "Review dimensions require evidence, problem, reason, impact and recommendation.", { reviewTargetId: entity.generatedAssetId });
    }
  }

  async create(input: CreateEntityInput<AIReview>): Promise<AIReview> {
    await this.#validate(input);
    return this.#reviews.create(input);
  }

  async update(id: EntityId, patch: UpdateEntityInput<AIReview>): Promise<AIReview> {
    const current = await this.#reviews.require(id);
    await this.#validate({ ...current, ...patch });
    return this.#reviews.update(id, patch);
  }

  get(id: EntityId) { return this.#reviews.get(id); }
  delete(id: EntityId) { return this.#reviews.delete(id); }
  listByProject(projectId: ProjectId) { return this.#reviews.query((item) => item.projectId === projectId); }
  listByGeneratedAsset(generatedAssetId: EntityId) { return this.#reviews.query((item) => item.generatedAssetId === generatedAssetId); }
}
