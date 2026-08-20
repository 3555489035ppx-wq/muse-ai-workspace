import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import {
  EXPLORATION_STATUSES,
  EXPLORATION_VARIANT_STATUSES,
  type Exploration,
  type ExplorationVariant,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasBase(value: Record<string, unknown>): boolean {
  return (
    isEntityId(value.id) &&
    isEntityId(value.projectId) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIdList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isEntityId);
}

export function isExploration(value: unknown): value is Exploration {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.directionId) &&
    isEntityId(value.visualDNAId) &&
    isText(value.title) &&
    EXPLORATION_STATUSES.some((status) => status === value.status)
  );
}

export function isExplorationVariant(value: unknown): value is ExplorationVariant {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.explorationId) &&
    isEntityId(value.directionId) &&
    isEntityId(value.visualDNAId) &&
    isIdList(value.referenceIds) &&
    isIdList(value.sourceAssetIds) &&
    isText(value.label) &&
    EXPLORATION_VARIANT_STATUSES.some((status) => status === value.status)
  );
}
