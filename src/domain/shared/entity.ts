import type { EntityId, ProjectId } from "./id.js";
import type { IsoTimestamp } from "./time.js";

export interface Entity {
  readonly id: EntityId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface ProjectScopedEntity extends Entity {
  readonly projectId: ProjectId;
}

export type NewEntity<T extends Entity> = Omit<
  T,
  "id" | "createdAt" | "updatedAt"
>;

export type EntityUpdate<T extends Entity> = Partial<
  Omit<T, "id" | "createdAt" | "updatedAt">
>;
