import type { Asset } from "../../domain/asset/index.js";
import type { DirectionReferenceRole, DirectionStatus } from "../../domain/direction/index.js";
import type { Moodboard, VisualDNA } from "../../domain/moodboard/index.js";
import type { ProjectBrief } from "../../domain/project/index.js";
import type { CreativeSeed, ResearchOpportunity, ResearchSession } from "../../domain/research/index.js";
import type { EntityId } from "../../domain/shared/id.js";

export const DIRECTION_AXES = ["composition", "typography", "color", "image", "material"] as const;
export type DirectionAxis = (typeof DIRECTION_AXES)[number];

export interface DirectionReferenceCandidate {
  readonly assetId: EntityId;
  readonly role: DirectionReferenceRole;
}

export interface DirectionCandidate {
  readonly key: string;
  readonly title: string;
  readonly concept: string;
  readonly narrative: string;
  readonly keywords: readonly string[];
  readonly axisValues: Readonly<Record<DirectionAxis, string>>;
  readonly heroAssetId: EntityId;
  readonly references: readonly DirectionReferenceCandidate[];
  readonly advantages: readonly string[];
  readonly risks: readonly string[];
  readonly status: Extract<DirectionStatus, "candidate">;
  readonly researchSessionId: EntityId;
  readonly moodboardId: EntityId;
  readonly visualDNAId: EntityId;
  readonly creativeSeedIds: readonly EntityId[];
  readonly opportunityIds: readonly EntityId[];
}

export interface DirectionProviderInput {
  readonly brief: ProjectBrief;
  readonly research: ResearchSession;
  readonly opportunities: readonly ResearchOpportunity[];
  readonly seeds: readonly CreativeSeed[];
  readonly moodboard: Moodboard;
  readonly visualDNA: VisualDNA;
  readonly assets: readonly Asset[];
  readonly constraints: readonly string[];
  readonly seed: string;
  readonly signal?: AbortSignal;
}

export interface DirectionProviderOutput { readonly directions: readonly DirectionCandidate[]; }
export interface DirectionProvider { generate(input: DirectionProviderInput): Promise<DirectionProviderOutput>; }

export class DirectionProviderError extends Error {
  constructor(readonly code: "CANCELLED" | "INVALID_OUTPUT" | "PROVIDER_FAILURE", message: string) {
    super(message);
    this.name = "DirectionProviderError";
  }
}

export function validateDirectionProviderOutput(output: DirectionProviderOutput, input: DirectionProviderInput): DirectionProviderOutput {
  const assetIds = new Set(input.assets.map((asset) => asset.id));
  const seedIds = new Set(input.seeds.map((seed) => seed.id));
  const opportunityIds = new Set(input.opportunities.map((opportunity) => opportunity.id));
  const directions = output.directions;
  const valid = directions.length === 3
    && new Set(directions.map((direction) => direction.key)).size === 3
    && directions.every((direction) => direction.status === "candidate"
      && direction.title.trim() !== "" && direction.concept.trim() !== "" && direction.narrative.trim() !== ""
      && direction.researchSessionId === input.research.id
      && direction.moodboardId === input.moodboard.id
      && direction.visualDNAId === input.visualDNA.id
      && direction.creativeSeedIds.length > 0 && direction.creativeSeedIds.every((id) => seedIds.has(id))
      && direction.opportunityIds.length > 0 && direction.opportunityIds.every((id) => opportunityIds.has(id))
      && assetIds.has(direction.heroAssetId)
      && direction.references.length > 0 && direction.references.every((reference) => assetIds.has(reference.assetId))
      && DIRECTION_AXES.every((axis) => direction.axisValues[axis].trim() !== ""));
  if (!valid) throw new DirectionProviderError("INVALID_OUTPUT", "Direction provider output is incomplete or has invalid provenance.");
  return output;
}
