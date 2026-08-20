import type { Entity, ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const ASSET_TYPES = ["image", "document", "font", "other"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
export const ASSET_STATUSES = ["ready", "missing", "quarantined"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_SOURCE_TYPES = ["upload", "import", "generated", "reference"] as const;
export type AssetSourceType = (typeof ASSET_SOURCE_TYPES)[number];

export interface Asset extends Entity {
  readonly name: string;
  readonly type: AssetType;
  readonly status: AssetStatus;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly storageKey: string;
}
export interface AssetSource extends ProjectScopedEntity {
  readonly assetId: EntityId;
  readonly type: AssetSourceType;
  readonly sourceId?: EntityId;
  readonly label: string;
}
export interface AssetAnalysis extends ProjectScopedEntity {
  readonly assetId: EntityId;
  readonly kind: "metadata" | "visual";
  readonly values: Readonly<Record<string, string | number | boolean>>;
}
export interface AssetCollection extends ProjectScopedEntity {
  readonly name: string;
  readonly assetIds: readonly EntityId[];
}
