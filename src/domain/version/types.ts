import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";
export const VERSION_ENTITY_TYPES = ["project", "brief", "direction", "exploration", "generated_asset", "canvas"] as const;
export type VersionEntityType = (typeof VERSION_ENTITY_TYPES)[number];
export interface VersionSnapshot extends ProjectScopedEntity {
  readonly parentVersionId?: EntityId;
  readonly entityType: VersionEntityType;
  readonly entityId: EntityId;
  readonly schemaVersion: number;
  readonly label: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
}
