import type { Table } from "dexie";
import type { Asset, AssetAnalysis, AssetCollection, AssetSource } from "../domain/asset/index.js";
import type { AssetStorage } from "../domain/asset/AssetStorage.js";
import { EntityNotFoundError, ReferentialIntegrityError } from "../domain/errors/index.js";
import type { Project } from "../domain/project/index.js";
import type { EntityId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { IndexedDbAssetStorage } from "../db/assetStorage.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";

export class AssetRepository {
  readonly #projects: Table<Project, EntityId>;
  readonly #assetsTable: Table<Asset, EntityId>;
  readonly #assets: BaseRepository<Asset>;
  readonly #sources: BaseRepository<AssetSource>;
  readonly #analyses: BaseRepository<AssetAnalysis>;
  readonly #collections: BaseRepository<AssetCollection>;
  readonly #storage: AssetStorage;

  constructor(database: MuseDatabase, storage: AssetStorage = new IndexedDbAssetStorage(database), clock?: RepositoryClock) {
    this.#projects = database.table("projects");
    this.#assetsTable = database.table("assets");
    this.#assets = new BaseRepository(this.#assetsTable, "Asset", clock);
    this.#sources = new BaseRepository(database.table("assetSources"), "AssetSource", clock);
    this.#analyses = new BaseRepository(database.table("assetAnalyses"), "AssetAnalysis", clock);
    this.#collections = new BaseRepository(database.table("assetCollections"), "AssetCollection", clock);
    this.#storage = storage;
  }

  create(input: CreateEntityInput<Asset>) { return this.#assets.create(input); }
  update(id: EntityId, patch: UpdateEntityInput<Asset>) { return this.#assets.update(id, patch); }
  get(id: EntityId) { return this.#assets.get(id); }
  list() { return this.#assets.list(); }

  async createWithBlob(input: CreateEntityInput<Asset>, content: Blob): Promise<Asset> {
    await this.#storage.save(input.id, content);
    try {
      return await this.#assets.create(input);
    } catch (error) {
      await this.#storage.delete(input.id);
      throw error;
    }
  }

  async deleteMetadata(id: EntityId): Promise<void> {
    const references = await this.listSourcesByAsset(id);
    if (references.length > 0) throw new ReferentialIntegrityError(id, references.map((item) => item.id));
    await this.#assets.delete(id);
  }

  getBlob(id: EntityId) { return this.#storage.get(id); }

  async createSource(input: CreateEntityInput<AssetSource>): Promise<AssetSource> {
    if ((await this.#projects.get(input.projectId)) === undefined) throw new EntityNotFoundError("Project", input.projectId);
    if ((await this.#assetsTable.get(input.assetId)) === undefined) throw new EntityNotFoundError("Asset", input.assetId);
    return this.#sources.create(input);
  }
  deleteSource(id: EntityId) { return this.#sources.delete(id); }
  listSourcesByAsset(assetId: EntityId) { return this.#sources.query((item) => item.assetId === assetId); }
  async countReferences(assetId: EntityId): Promise<number> { return (await this.listSourcesByAsset(assetId)).length; }

  async createAnalysis(input: CreateEntityInput<AssetAnalysis>): Promise<AssetAnalysis> {
    if ((await this.#projects.get(input.projectId)) === undefined) throw new EntityNotFoundError("Project", input.projectId);
    if ((await this.#assetsTable.get(input.assetId)) === undefined) throw new ReferentialIntegrityError(input.assetId, []);
    return this.#analyses.create(input);
  }

  async createCollection(input: CreateEntityInput<AssetCollection>): Promise<AssetCollection> {
    if ((await this.#projects.get(input.projectId)) === undefined) throw new EntityNotFoundError("Project", input.projectId);
    const found = await this.#assetsTable.bulkGet([...input.assetIds]);
    const missing = input.assetIds.filter((_, index) => found[index] === undefined);
    if (missing.length > 0) throw new ReferentialIntegrityError(input.id, missing);
    return this.#collections.create(input);
  }
}
