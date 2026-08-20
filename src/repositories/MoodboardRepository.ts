import type { Table } from "dexie";
import type { Asset } from "../domain/asset/index.js";
import { DuplicateEntityError, EntityNotFoundError } from "../domain/errors/index.js";
import type { Moodboard, MoodboardItem, VisualDNA } from "../domain/moodboard/index.js";
import type { ResearchSession } from "../domain/research/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

export class MoodboardRepository {
  readonly #assets: Table<Asset, EntityId>;
  readonly #sessions: Table<ResearchSession, EntityId>;
  readonly #moodboardsTable: Table<Moodboard, EntityId>;
  readonly #itemsTable: Table<MoodboardItem, EntityId>;
  readonly #visualDnaTable: Table<VisualDNA, EntityId>;
  readonly #moodboards: BaseRepository<Moodboard>;
  readonly #items: BaseRepository<MoodboardItem>;
  readonly #visualDna: BaseRepository<VisualDNA>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#assets = database.table("assets");
    this.#sessions = database.table("researchSessions");
    this.#moodboardsTable = database.table("moodboards");
    this.#itemsTable = database.table("moodboardItems");
    this.#visualDnaTable = database.table("visualDna");
    this.#moodboards = new BaseRepository(this.#moodboardsTable, "Moodboard", clock);
    this.#items = new BaseRepository(this.#itemsTable, "MoodboardItem", clock);
    this.#visualDna = new BaseRepository(this.#visualDnaTable, "VisualDNA", clock);
  }

  async #validateMoodboard(entity: Pick<Moodboard, "projectId" | "researchSessionId">): Promise<void> {
    await requireParent(this.#sessions, entity.researchSessionId, entity.projectId, "ResearchSession");
  }

  async #validateItem(entity: Pick<MoodboardItem, "id" | "projectId" | "moodboardId" | "assetId">): Promise<void> {
    await requireParent(this.#moodboardsTable, entity.moodboardId, entity.projectId, "Moodboard");
    if ((await this.#assets.get(entity.assetId)) === undefined) {
      throw new EntityNotFoundError("Asset", entity.assetId);
    }
    const duplicate = await this.#itemsTable
      .where("moodboardId")
      .equals(entity.moodboardId)
      .and((item) => item.assetId === entity.assetId && item.id !== entity.id)
      .first();
    if (duplicate !== undefined) {
      throw new DuplicateEntityError("MoodboardAsset", entity.assetId);
    }
  }

  async #validateVisualDna(entity: Pick<VisualDNA, "id" | "projectId" | "moodboardId">): Promise<void> {
    await requireParent(this.#moodboardsTable, entity.moodboardId, entity.projectId, "Moodboard");
    const duplicate = await this.#visualDnaTable
      .where("moodboardId")
      .equals(entity.moodboardId)
      .and((item) => item.id !== entity.id)
      .first();
    if (duplicate !== undefined) {
      throw new DuplicateEntityError("VisualDNA", entity.moodboardId);
    }
  }

  async createMoodboard(input: CreateEntityInput<Moodboard>): Promise<Moodboard> {
    await this.#validateMoodboard(input);
    return this.#moodboards.create(input);
  }
  async updateMoodboard(id: EntityId, patch: UpdateEntityInput<Moodboard>): Promise<Moodboard> {
    const current = await this.#moodboards.require(id);
    await this.#validateMoodboard({ ...current, ...patch });
    return this.#moodboards.update(id, patch);
  }
  getMoodboard(id: EntityId) { return this.#moodboards.get(id); }
  deleteMoodboard(id: EntityId) { return this.#moodboards.delete(id); }
  listMoodboardsByProject(projectId: ProjectId) { return this.#moodboards.query((item) => item.projectId === projectId); }

  async createItem(input: CreateEntityInput<MoodboardItem>): Promise<MoodboardItem> {
    await this.#validateItem(input);
    return this.#items.create(input);
  }
  async updateItem(id: EntityId, patch: UpdateEntityInput<MoodboardItem>): Promise<MoodboardItem> {
    const current = await this.#items.require(id);
    await this.#validateItem({ ...current, ...patch });
    return this.#items.update(id, patch);
  }
  getItem(id: EntityId) { return this.#items.get(id); }
  deleteItem(id: EntityId) { return this.#items.delete(id); }
  listItemsByMoodboard(moodboardId: EntityId) { return this.#items.query((item) => item.moodboardId === moodboardId); }

  async createVisualDNA(input: CreateEntityInput<VisualDNA>): Promise<VisualDNA> {
    await this.#validateVisualDna(input);
    return this.#visualDna.create(input);
  }
  async updateVisualDNA(id: EntityId, patch: UpdateEntityInput<VisualDNA>): Promise<VisualDNA> {
    const current = await this.#visualDna.require(id);
    await this.#validateVisualDna({ ...current, ...patch });
    return this.#visualDna.update(id, patch);
  }
  getVisualDNA(id: EntityId) { return this.#visualDna.get(id); }
  deleteVisualDNA(id: EntityId) { return this.#visualDna.delete(id); }
}
