import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import {
  RESEARCH_SESSION_STATUSES,
  RESEARCH_SOURCE_TYPES,
  type CreativeSeed,
  type ResearchEvidence,
  type ResearchInsight,
  type ResearchObservation,
  type ResearchOpportunity,
  type ResearchSession,
  type ResearchSource,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasBase(value: Record<string, unknown>): boolean {
  return (
    isEntityId(value.id) &&
    isEntityId(value.projectId) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

function hasParent(value: Record<string, unknown>, key: string): boolean {
  return isEntityId(value[key]);
}

function isNonEmptyIdArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isEntityId);
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || isText(value);
}

export function isResearchSession(value: unknown): value is ResearchSession {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "briefId") &&
    isText(value.query) &&
    RESEARCH_SESSION_STATUSES.some((status) => status === value.status)
  );
}

export function isResearchSource(value: unknown): value is ResearchSource {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "researchSessionId") &&
    RESEARCH_SOURCE_TYPES.some((type) => type === value.type) &&
    isText(value.title) &&
    isOptionalText(value.uri)
  );
}

export function isResearchEvidence(value: unknown): value is ResearchEvidence {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "researchSessionId") &&
    hasParent(value, "sourceId") &&
    isText(value.excerpt) &&
    isOptionalText(value.locator)
  );
}

export function isResearchObservation(value: unknown): value is ResearchObservation {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "researchSessionId") &&
    isNonEmptyIdArray(value.evidenceIds) &&
    isText(value.statement)
  );
}

export function isResearchInsight(value: unknown): value is ResearchInsight {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "researchSessionId") &&
    isNonEmptyIdArray(value.observationIds) &&
    isText(value.statement)
  );
}

export function isResearchOpportunity(value: unknown): value is ResearchOpportunity {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "researchSessionId") &&
    isNonEmptyIdArray(value.insightIds) &&
    isText(value.statement)
  );
}

export function isCreativeSeed(value: unknown): value is CreativeSeed {
  return (
    isRecord(value) &&
    hasBase(value) &&
    hasParent(value, "researchSessionId") &&
    isNonEmptyIdArray(value.opportunityIds) &&
    isText(value.title) &&
    isText(value.premise)
  );
}
