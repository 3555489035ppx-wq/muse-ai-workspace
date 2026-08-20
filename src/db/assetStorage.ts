import type { Table } from "dexie";

import { AssetStorageError } from "../domain/errors/storageErrors.js";
import type { AssetStorage } from "../domain/asset/AssetStorage.js";
import type { EntityId } from "../domain/shared/id.js";
import type { IsoTimestamp } from "../domain/shared/time.js";
import { toIsoTimestamp } from "../domain/shared/time.js";
import type { MuseDatabase } from "./database.js";

export interface AssetBlobRecord {
  readonly id: EntityId;
  readonly content: Blob;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly updatedAt: IsoTimestamp;
}

type AssetOperation = "save" | "get" | "delete" | "has";

export class IndexedDbAssetStorage implements AssetStorage {
  readonly #database: MuseDatabase;
  readonly #table: Table<AssetBlobRecord, EntityId>;

  constructor(database: MuseDatabase) {
    this.#database = database;
    this.#table = database.table<AssetBlobRecord, EntityId>("assetBlobs");
  }

  async #execute<T>(
    operation: AssetOperation,
    assetId: EntityId,
    mode: "r" | "rw",
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await this.#database.transaction(mode, this.#table, action);
    } catch (error) {
      throw new AssetStorageError(operation, assetId, error);
    }
  }

  async save(assetId: EntityId, content: Blob): Promise<void> {
    await this.#execute("save", assetId, "rw", async () => {
      await this.#table.put({
        id: assetId,
        content,
        mimeType: content.type,
        byteSize: content.size,
        updatedAt: toIsoTimestamp(new Date()),
      });
    });
  }

  async get(assetId: EntityId): Promise<Blob | undefined> {
    return this.#execute("get", assetId, "r", async () => {
      const record = await this.#table.get(assetId);
      return record?.content;
    });
  }

  async delete(assetId: EntityId): Promise<void> {
    await this.#execute("delete", assetId, "rw", async () => {
      await this.#table.delete(assetId);
    });
  }

  async has(assetId: EntityId): Promise<boolean> {
    return this.#execute("has", assetId, "r", async () =>
      (await this.#table.get(assetId)) !== undefined,
    );
  }
}
