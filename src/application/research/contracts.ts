import type { ProjectBrief } from "../../domain/project/index.js";
import type { TemplateResearchStrategy } from "../template/index.js";

export interface ProjectResearchContext {
  readonly projectName: string;
  readonly projectType: "brand" | "editorial" | "ui" | "campaign";
  readonly locale: "zh-CN";
}

export interface ResearchProviderInput {
  readonly brief: ProjectBrief;
  readonly templateStrategy?: TemplateResearchStrategy;
  readonly context: ProjectResearchContext;
  readonly seed: string;
  readonly signal?: AbortSignal;
}

export interface ResearchSourceCandidate { readonly key: string; readonly type: "book" | "archive" | "interview" | "user_upload"; readonly title: string; readonly provenance: "mock_hypothesis"; }
export interface ResearchEvidenceCandidate { readonly key: string; readonly sourceKey: string; readonly excerpt: string; readonly evidenceStatus: "待核验" | "用户提供"; }
export interface ResearchObservationCandidate { readonly key: string; readonly evidenceKeys: readonly string[]; readonly statement: string; readonly category: "受众" | "语境" | "竞品" | "视觉" | "文化" | "趋势" | "限制"; }
export interface ResearchInsightCandidate { readonly key: string; readonly observationKeys: readonly string[]; readonly statement: string; }
export interface ResearchOpportunityCandidate { readonly key: string; readonly insightKeys: readonly string[]; readonly statement: string; }
export interface CreativeSeedCandidate { readonly key: string; readonly opportunityKeys: readonly string[]; readonly title: string; readonly premise: string; }

export interface ResearchProviderOutput {
  readonly understanding: string;
  readonly sources: readonly ResearchSourceCandidate[];
  readonly evidence: readonly ResearchEvidenceCandidate[];
  readonly observations: readonly ResearchObservationCandidate[];
  readonly insights: readonly ResearchInsightCandidate[];
  readonly opportunities: readonly ResearchOpportunityCandidate[];
  readonly seeds: readonly CreativeSeedCandidate[];
}

export type ResearchProviderErrorCode = "CANCELLED" | "INVALID_OUTPUT" | "PROVIDER_FAILURE";

export class ResearchProviderError extends Error {
  constructor(readonly code: ResearchProviderErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchProviderError";
  }
}

export function validateResearchProviderOutput(output: ResearchProviderOutput): ResearchProviderOutput {
  const unique = (keys: readonly string[]) => keys.length > 0 && new Set(keys).size === keys.length && keys.every(Boolean);
  const sourceKeys = output.sources.map((item) => item.key);
  const evidenceKeys = output.evidence.map((item) => item.key);
  const observationKeys = output.observations.map((item) => item.key);
  const insightKeys = output.insights.map((item) => item.key);
  const opportunityKeys = output.opportunities.map((item) => item.key);
  const valid = output.understanding.trim().length > 0
    && [sourceKeys, evidenceKeys, observationKeys, insightKeys, opportunityKeys, output.seeds.map((item) => item.key)].every(unique)
    && output.sources.every((item) => item.provenance === "mock_hypothesis")
    && output.evidence.every((item) => sourceKeys.includes(item.sourceKey))
    && output.observations.every((item) => item.evidenceKeys.length > 0 && item.evidenceKeys.every((key) => evidenceKeys.includes(key)))
    && output.insights.every((item) => item.observationKeys.length > 0 && item.observationKeys.every((key) => observationKeys.includes(key)))
    && output.opportunities.every((item) => item.insightKeys.length > 0 && item.insightKeys.every((key) => insightKeys.includes(key)))
    && output.seeds.every((item) => item.opportunityKeys.length > 0 && item.opportunityKeys.every((key) => opportunityKeys.includes(key)));
  if (!valid) throw new ResearchProviderError("INVALID_OUTPUT", "Research provider output lineage is incomplete.");
  return output;
}
