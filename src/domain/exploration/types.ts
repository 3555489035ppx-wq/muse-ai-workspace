import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const EXPLORATION_STATUSES = ["draft", "selected", "archived"] as const;
export type ExplorationStatus = (typeof EXPLORATION_STATUSES)[number];

export const EXPLORATION_VARIANT_STATUSES = ["draft", "kept", "discarded"] as const;
export type ExplorationVariantStatus = (typeof EXPLORATION_VARIANT_STATUSES)[number];

export interface Exploration extends ProjectScopedEntity {
  readonly directionId: EntityId;
  readonly visualDNAId: EntityId;
  readonly title: string;
  readonly status: ExplorationStatus;
}

export interface ExplorationVariant extends ProjectScopedEntity {
  readonly explorationId: EntityId;
  readonly directionId: EntityId;
  readonly visualDNAId: EntityId;
  readonly referenceIds: readonly EntityId[];
  readonly sourceAssetIds: readonly EntityId[];
  readonly label: string;
  readonly status: ExplorationVariantStatus;
}
