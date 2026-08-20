import type { Asset, AssetCollection } from "../../domain/asset/index.js";
import type { MoodboardItem, MoodboardItemRole } from "../../domain/moodboard/index.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { reorderItems } from "../../infrastructure/dnd/utilities.js";
import { AssetRepository } from "../../repositories/AssetRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { MoodboardRepository } from "../../repositories/MoodboardRepository.js";

export interface MoodboardAssetCommandOptions { readonly idFactory?: () => EntityId; readonly clock?: RepositoryClock; }
export class MoodboardAssetCommands {
  readonly #assets: AssetRepository; readonly #moodboards: MoodboardRepository; readonly #idFactory: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: MoodboardAssetCommandOptions = {}) {
    this.#assets = new AssetRepository(database, undefined, options.clock); this.#moodboards = new MoodboardRepository(database, options.clock); this.#idFactory = options.idFactory ?? (() => createEntityId());
  }
  async upload(projectId: ProjectId, input: { readonly name: string; readonly content: Blob }): Promise<Asset> {
    const assetId = this.#idFactory();
    const asset = await this.#assets.createWithBlob({ id: assetId, name: input.name.trim() || "未命名素材", type: input.content.type.startsWith("image/") ? "image" : "other", status: "ready", mimeType: input.content.type || "application/octet-stream", byteSize: input.content.size, storageKey: `indexeddb://${assetId}` }, input.content);
    await this.#assets.createSource({ id: this.#idFactory(), projectId, assetId, type: "upload", label: "用户上传" });
    return asset;
  }
  async add(projectId: ProjectId, moodboardId: EntityId, assetId: EntityId, role: MoodboardItemRole = "reference"): Promise<MoodboardItem> {
    const board = await this.#moodboards.getMoodboard(moodboardId); if (board === undefined || board.projectId !== projectId) throw new Error("情绪板不存在或不属于当前项目");
    const sources = await this.#assets.listSourcesByAsset(assetId); if (!sources.some((source) => source.projectId === projectId)) throw new Error("素材未授权给当前项目");
    const items = await this.#moodboards.listItemsByMoodboard(moodboardId);
    return this.#moodboards.createItem({ id: this.#idFactory(), projectId, moodboardId, assetId, role, position: items.length });
  }
  async remove(projectId: ProjectId, itemId: EntityId): Promise<void> {
    const item = await this.#moodboards.getItem(itemId); if (item === undefined || item.projectId !== projectId) throw new Error("情绪板素材不存在或不属于当前项目"); await this.#moodboards.deleteItem(itemId);
  }
  async reorder(projectId: ProjectId, moodboardId: EntityId, activeId: EntityId, overId: EntityId): Promise<readonly MoodboardItem[]> {
    const board = await this.#moodboards.getMoodboard(moodboardId); if (board === undefined || board.projectId !== projectId) throw new Error("情绪板不存在或不属于当前项目");
    const items = [...await this.#moodboards.listItemsByMoodboard(moodboardId)].sort((a, b) => a.position - b.position);
    const reordered = reorderItems(items, activeId, overId, (item) => item.id);
    return Promise.all(reordered.map((item, position) => this.#moodboards.updateItem(item.id, { position })));
  }
  async group(projectId: ProjectId, name: string, assetIds: readonly EntityId[]): Promise<AssetCollection> {
    return this.#assets.createCollection({ id: this.#idFactory(), projectId, name: name.trim() || "未命名分组", assetIds });
  }
  getBlob(assetId: EntityId): Promise<Blob | undefined> { return this.#assets.getBlob(assetId); }
}
