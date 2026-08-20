import type { EntityId } from "../shared/id.js";

export interface AssetStorage {
  save(assetId: EntityId, content: Blob): Promise<void>;
  get(assetId: EntityId): Promise<Blob | undefined>;
  delete(assetId: EntityId): Promise<void>;
  has(assetId: EntityId): Promise<boolean>;
}
