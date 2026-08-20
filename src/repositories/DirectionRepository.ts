import type { Table } from "dexie";
import type { Asset } from "../domain/asset/index.js";
import type { Direction, DirectionReference, DirectionScore } from "../domain/direction/index.js";
import { EntityNotFoundError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { Moodboard, VisualDNA } from "../domain/moodboard/index.js";
import type { CreativeSeed, ResearchOpportunity } from "../domain/research/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

export class DirectionRepository {
  readonly #assets: Table<Asset, EntityId>;
  readonly #moodboards: Table<Moodboard, EntityId>;
  readonly #visualDna: Table<VisualDNA, EntityId>;
  readonly #seeds: Table<CreativeSeed, EntityId>;
  readonly #opportunities: Table<ResearchOpportunity, EntityId>;
  readonly #directionsTable: Table<Direction, EntityId>;
  readonly #directions: BaseRepository<Direction>;
  readonly #references: BaseRepository<DirectionReference>;
  readonly #scores: BaseRepository<DirectionScore>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#assets = database.table("assets");
    this.#moodboards = database.table("moodboards");
    this.#visualDna = database.table("visualDna");
    this.#seeds = database.table("creativeSeeds");
    this.#opportunities = database.table("researchOpportunities");
    this.#directionsTable = database.table("directions");
    this.#directions = new BaseRepository(this.#directionsTable, "Direction", clock);
    this.#references = new BaseRepository(database.table("directionReferences"), "DirectionReference", clock);
    this.#scores = new BaseRepository(database.table("directionScores"), "DirectionScore", clock);
  }

  async #validateDirection(entity: Pick<Direction, "projectId" | "moodboardId" | "visualDNAId" | "creativeSeedIds" | "opportunityIds">): Promise<void> {
    await requireParent(this.#moodboards, entity.moodboardId, entity.projectId, "Moodboard");
    const dna = await requireParent(this.#visualDna, entity.visualDNAId, entity.projectId, "VisualDNA");
    if (dna.moodboardId !== entity.moodboardId) {
      throw new ParentEntityMismatchError("VisualDNA", entity.visualDNAId, entity.projectId);
    }
    await Promise.all(entity.creativeSeedIds.map((id) => requireParent(this.#seeds, id, entity.projectId, "CreativeSeed")));
    await Promise.all(entity.opportunityIds.map((id) => requireParent(this.#opportunities, id, entity.projectId, "ResearchOpportunity")));
  }

  async createDirection(input: CreateEntityInput<Direction>): Promise<Direction> {
    await this.#validateDirection(input);
    return this.#directions.create(input);
  }
  async updateDirection(id: EntityId, patch: UpdateEntityInput<Direction>): Promise<Direction> {
    const current = await this.#directions.require(id);
    await this.#validateDirection({ ...current, ...patch });
    return this.#directions.update(id, patch);
  }
  getDirection(id: EntityId) { return this.#directions.get(id); }
  deleteDirection(id: EntityId) { return this.#directions.delete(id); }
  listDirectionsByProject(projectId: ProjectId) { return this.#directions.query((item) => item.projectId === projectId); }

  async createReference(input: CreateEntityInput<DirectionReference>): Promise<DirectionReference> {
    await requireParent(this.#directionsTable, input.directionId, input.projectId, "Direction");
    if ((await this.#assets.get(input.assetId)) === undefined) throw new EntityNotFoundError("Asset", input.assetId);
    return this.#references.create(input);
  }
  async updateReference(id: EntityId, patch: UpdateEntityInput<DirectionReference>): Promise<DirectionReference> {
    const current = await this.#references.require(id);
    const candidate = { ...current, ...patch };
    await requireParent(this.#directionsTable, candidate.directionId, candidate.projectId, "Direction");
    if ((await this.#assets.get(candidate.assetId)) === undefined) throw new EntityNotFoundError("Asset", candidate.assetId);
    return this.#references.update(id, patch);
  }
  getReference(id: EntityId) { return this.#references.get(id); }
  deleteReference(id: EntityId) { return this.#references.delete(id); }

  async createScore(input: CreateEntityInput<DirectionScore>): Promise<DirectionScore> {
    await requireParent(this.#directionsTable, input.directionId, input.projectId, "Direction");
    return this.#scores.create(input);
  }
  async updateScore(id: EntityId, patch: UpdateEntityInput<DirectionScore>): Promise<DirectionScore> {
    const current = await this.#scores.require(id);
    const candidate = { ...current, ...patch };
    await requireParent(this.#directionsTable, candidate.directionId, candidate.projectId, "Direction");
    return this.#scores.update(id, patch);
  }
  getScore(id: EntityId) { return this.#scores.get(id); }
  deleteScore(id: EntityId) { return this.#scores.delete(id); }
}
