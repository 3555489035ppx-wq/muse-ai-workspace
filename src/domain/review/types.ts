import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const REVIEW_DIMENSION_KEYS = ["goal_alignment", "visual_coherence", "distinctiveness", "audience_fit", "feasibility", "craft"] as const;
export type ReviewDimensionKey = (typeof REVIEW_DIMENSION_KEYS)[number];

export interface ReviewDimension {
  readonly dimension: ReviewDimensionKey;
  readonly score: number;
  readonly evidenceIds: readonly EntityId[];
  readonly evidence: string;
  readonly problem: string;
  readonly reason: string;
  readonly impact: string;
  readonly recommendation: string;
}

export interface AIReview extends ProjectScopedEntity {
  readonly generatedAssetId: EntityId;
  readonly promptVersionId: EntityId;
  readonly directionId: EntityId;
  readonly dimensions: readonly ReviewDimension[];
  readonly summary: string;
}
