import type { Table } from "dexie";
import type { Asset } from "../domain/asset/index.js";
import type { Direction, DirectionReference } from "../domain/direction/index.js";
import { EntityNotFoundError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { Exploration, ExplorationVariant } from "../domain/exploration/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

export class ExplorationRepository {
  readonly #directions: Table<Direction, EntityId>;
  readonly #references: Table<DirectionReference, EntityId>;
  readonly #assets: Table<Asset, EntityId>;
  readonly #explorationsTable: Table<Exploration, EntityId>;
  readonly #explorations: BaseRepository<Exploration>;
  readonly #variants: BaseRepository<ExplorationVariant>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#directions = database.table("directions");
    this.#references = database.table("directionReferences");
    this.#assets = database.table("assets");
    this.#explorationsTable = database.table("explorations");
    this.#explorations = new BaseRepository(this.#explorationsTable, "Exploration", clock);
    this.#variants = new BaseRepository(database.table("explorationVariants"), "ExplorationVariant", clock);
  }

  async #validateExploration(entity: Pick<Exploration, "projectId" | "directionId" | "visualDNAId">): Promise<void> {
    const direction = await requireParent(this.#directions, entity.directionId, entity.projectId, "Direction");
    if (direction.visualDNAId !== entity.visualDNAId) {
      throw new ParentEntityMismatchError("VisualDNA", entity.visualDNAId, entity.projectId);
    }
  }

  async #validateVariant(entity: Pick<ExplorationVariant, "projectId" | "explorationId" | "directionId" | "visualDNAId" | "referenceIds" | "sourceAssetIds">): Promise<void> {
    const exploration = await requireParent(this.#explorationsTable, entity.explorationId, entity.projectId, "Exploration");
    if (exploration.directionId !== entity.directionId || exploration.visualDNAId !== entity.visualDNAId) {
      throw new ParentEntityMismatchError("Exploration", entity.explorationId, entity.projectId);
    }
    const references = await Promise.all(entity.referenceIds.map((id) => requireParent(this.#references, id, entity.projectId, "DirectionReference")));
    if (references.some((item) => item.directionId !== entity.directionId)) {
      throw new ParentEntityMismatchError("DirectionReference", entity.referenceIds[0] ?? entity.directionId, entity.projectId);
    }
    for (const assetId of entity.sourceAssetIds) {
      if ((await this.#assets.get(assetId)) === undefined) throw new EntityNotFoundError("Asset", assetId);
    }
  }

  async createExploration(input: CreateEntityInput<Exploration>): Promise<Exploration> {
    await this.#validateExploration(input);
    return this.#explorations.create(input);
  }
  async updateExploration(id: EntityId, patch: UpdateEntityInput<Exploration>): Promise<Exploration> {
    const current = await this.#explorations.require(id);
    await this.#validateExploration({ ...current, ...patch });
    return this.#explorations.update(id, patch);
  }
  getExploration(id: EntityId) { return this.#explorations.get(id); }
  deleteExploration(id: EntityId) { return this.#explorations.delete(id); }
  listExplorationsByProject(projectId: ProjectId) { return this.#explorations.query((item) => item.projectId === projectId); }

  async createVariant(input: CreateEntityInput<ExplorationVariant>): Promise<ExplorationVariant> {
    await this.#validateVariant(input);
    return this.#variants.create(input);
  }
  async updateVariant(id: EntityId, patch: UpdateEntityInput<ExplorationVariant>): Promise<ExplorationVariant> {
    const current = await this.#variants.require(id);
    await this.#validateVariant({ ...current, ...patch });
    return this.#variants.update(id, patch);
  }
  getVariant(id: EntityId) { return this.#variants.get(id); }
  deleteVariant(id: EntityId) { return this.#variants.delete(id); }
  listVariantsByExploration(explorationId: EntityId) { return this.#variants.query((item) => item.explorationId === explorationId); }
}
