import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { REVIEW_DIMENSION_KEYS, type AIReview, type ReviewDimension } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function hasBase(value: Record<string, unknown>): boolean {
  return isEntityId(value.id) && isEntityId(value.projectId) && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt);
}
export function isReviewDimension(value: unknown): value is ReviewDimension {
  return isRecord(value) && REVIEW_DIMENSION_KEYS.some((key) => key === value.dimension) && typeof value.score === "number" && Number.isFinite(value.score) && value.score >= 0 && value.score <= 100 && Array.isArray(value.evidenceIds) && value.evidenceIds.length > 0 && value.evidenceIds.every(isEntityId) && isText(value.evidence) && isText(value.problem) && isText(value.reason) && isText(value.impact) && isText(value.recommendation);
}
export function isAIReview(value: unknown): value is AIReview {
  return isRecord(value) && hasBase(value) && isEntityId(value.generatedAssetId) && isEntityId(value.promptVersionId) && isEntityId(value.directionId) && Array.isArray(value.dimensions) && value.dimensions.length > 0 && value.dimensions.every(isReviewDimension) && isText(value.summary);
}
