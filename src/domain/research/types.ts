import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const RESEARCH_SESSION_STATUSES = ["draft", "active", "completed"] as const;
export type ResearchSessionStatus = (typeof RESEARCH_SESSION_STATUSES)[number];

export const RESEARCH_SOURCE_TYPES = [
  "web",
  "book",
  "interview",
  "archive",
  "user_upload",
] as const;
export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];

export interface ResearchSession extends ProjectScopedEntity {
  readonly briefId: EntityId;
  readonly query: string;
  readonly status: ResearchSessionStatus;
}

export interface ResearchSource extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly type: ResearchSourceType;
  readonly title: string;
  readonly uri?: string;
}

export interface ResearchEvidence extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly sourceId: EntityId;
  readonly excerpt: string;
  readonly locator?: string;
}

export interface ResearchObservation extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly evidenceIds: readonly EntityId[];
  readonly statement: string;
}

export interface ResearchInsight extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly observationIds: readonly EntityId[];
  readonly statement: string;
}

export interface ResearchOpportunity extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly insightIds: readonly EntityId[];
  readonly statement: string;
}

export interface CreativeSeed extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly opportunityIds: readonly EntityId[];
  readonly title: string;
  readonly premise: string;
}
