import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const DIRECTION_STATUSES = ["draft", "candidate", "locked", "rejected"] as const;
export type DirectionStatus = (typeof DIRECTION_STATUSES)[number];

export const DIRECTION_REFERENCE_ROLES = ["inspiration", "material", "layout", "type"] as const;
export type DirectionReferenceRole = (typeof DIRECTION_REFERENCE_ROLES)[number];

export const DIRECTION_SCORE_DIMENSIONS = [
  "goal_alignment",
  "audience_fit",
  "distinctiveness",
  "coherence",
  "feasibility",
] as const;
export type DirectionScoreDimension = (typeof DIRECTION_SCORE_DIMENSIONS)[number];

export interface DirectionVisualDNA {
  readonly keywords: readonly string[];
  readonly principles: readonly string[];
}

export interface Direction extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly moodboardId: EntityId;
  readonly visualDNAId: EntityId;
  readonly creativeSeedIds: readonly EntityId[];
  readonly opportunityIds: readonly EntityId[];
  readonly title: string;
  readonly concept: string;
  readonly narrative: string;
  readonly visualDNA: DirectionVisualDNA;
  readonly advantages: readonly string[];
  readonly risks: readonly string[];
  readonly status: DirectionStatus;
}

export interface DirectionReference extends ProjectScopedEntity {
  readonly directionId: EntityId;
  readonly assetId: EntityId;
  readonly role: DirectionReferenceRole;
}

export interface DirectionScore extends ProjectScopedEntity {
  readonly directionId: EntityId;
  readonly dimension: DirectionScoreDimension;
  readonly value: number;
  readonly rationale: string;
}
