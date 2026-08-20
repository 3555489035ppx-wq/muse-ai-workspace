import type { ResearchInsight, ResearchOpportunity, ResearchSession, CreativeSeed } from "../../domain/research/index.js";
import type { EntityId } from "../../domain/shared/id.js";
import type { TemplateMoodboardStrategy } from "../template/index.js";

export interface MoodboardProviderInput {
  readonly research: ResearchSession;
  readonly insights: readonly ResearchInsight[];
  readonly opportunities: readonly ResearchOpportunity[];
  readonly seeds: readonly CreativeSeed[];
  readonly templateStrategy?: TemplateMoodboardStrategy;
  readonly availableAssetIds: readonly EntityId[];
  readonly seed: string;
  readonly signal?: AbortSignal;
}

export interface VisualDNACandidate {
  readonly keywords: readonly string[];
  readonly colorPalette: readonly { readonly hex: string; readonly role: string }[];
  readonly composition: readonly string[];
  readonly imagery: readonly string[];
  readonly typography: readonly string[];
  readonly materials: readonly string[];
}

export interface VisualTerritoryCandidate {
  readonly key: string;
  readonly name: string;
  readonly rationale: string;
  readonly keywords: readonly string[];
  readonly visualDNA: VisualDNACandidate;
  readonly assetRefs: readonly EntityId[];
}

export interface MoodboardProviderOutput { readonly territories: readonly VisualTerritoryCandidate[]; }
export interface MoodboardProvider { generate(input: MoodboardProviderInput): Promise<MoodboardProviderOutput>; }

export class MoodboardProviderError extends Error {
  constructor(readonly code: "CANCELLED" | "INVALID_OUTPUT" | "PROVIDER_FAILURE", message: string) { super(message); this.name = "MoodboardProviderError"; }
}

const HEX = /^#[0-9a-f]{6}$/i;
export function validateMoodboardProviderOutput(output: MoodboardProviderOutput, availableAssetIds: readonly EntityId[]): MoodboardProviderOutput {
  const territories = output.territories;
  const valid = territories.length >= 2 && territories.length <= 4
    && new Set(territories.map((item) => item.key)).size === territories.length
    && territories.every((item) => item.name.trim() && item.rationale.trim() && item.keywords.length >= 3 && item.assetRefs.length > 0
      && new Set(item.assetRefs).size === item.assetRefs.length && item.assetRefs.every((id) => availableAssetIds.includes(id))
      && item.visualDNA.keywords.length >= 3 && item.visualDNA.colorPalette.length >= 3 && item.visualDNA.colorPalette.every((color) => HEX.test(color.hex) && color.role.trim())
      && item.visualDNA.composition.length > 0 && item.visualDNA.imagery.length > 0 && item.visualDNA.typography.length > 0 && item.visualDNA.materials.length > 0);
  if (!valid) throw new MoodboardProviderError("INVALID_OUTPUT", "Moodboard provider output is incomplete or references unavailable assets.");
  return output;
}
