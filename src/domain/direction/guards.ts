import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import {
  DIRECTION_REFERENCE_ROLES,
  DIRECTION_SCORE_DIMENSIONS,
  DIRECTION_STATUSES,
  type Direction,
  type DirectionReference,
  type DirectionScore,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTextList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isText);
}

function isIdList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isEntityId);
}

function hasBase(value: Record<string, unknown>): boolean {
  return (
    isEntityId(value.id) &&
    isEntityId(value.projectId) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

export function isDirection(value: unknown): value is Direction {
  if (!isRecord(value) || !isRecord(value.visualDNA)) {
    return false;
  }
  return (
    hasBase(value) &&
    isEntityId(value.researchSessionId) &&
    isEntityId(value.moodboardId) &&
    isEntityId(value.visualDNAId) &&
    isIdList(value.creativeSeedIds) &&
    isIdList(value.opportunityIds) &&
    isText(value.title) &&
    isText(value.concept) &&
    isText(value.narrative) &&
    isTextList(value.visualDNA.keywords) &&
    isTextList(value.visualDNA.principles) &&
    isTextList(value.advantages) &&
    isTextList(value.risks) &&
    DIRECTION_STATUSES.some((status) => status === value.status)
  );
}

export function isDirectionReference(value: unknown): value is DirectionReference {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.directionId) &&
    isEntityId(value.assetId) &&
    DIRECTION_REFERENCE_ROLES.some((role) => role === value.role)
  );
}

export function isDirectionScore(value: unknown): value is DirectionScore {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.directionId) &&
    DIRECTION_SCORE_DIMENSIONS.some((dimension) => dimension === value.dimension) &&
    typeof value.value === "number" &&
    Number.isFinite(value.value) &&
    value.value >= 0 &&
    value.value <= 100 &&
    isText(value.rationale)
  );
}
