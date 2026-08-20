import type { Direction } from "../../domain/direction/index.js";
import type { GeneratedAsset } from "../../domain/generation/index.js";
import type { ProjectBrief } from "../../domain/project/index.js";
import type { PromptVersion } from "../../domain/prompt/index.js";
import type { EntityId } from "../../domain/shared/id.js";

export const REVIEW_RUBRIC = ["brief_match", "direction", "audience", "identity", "composition", "originality", "cross_media"] as const;
export type ReviewRubricKey = (typeof REVIEW_RUBRIC)[number];
export interface ReviewProviderInput { readonly brief: ProjectBrief; readonly direction: Direction; readonly generatedAsset: GeneratedAsset; readonly promptVersion: PromptVersion; }
export interface ReviewFinding { readonly key: ReviewRubricKey; readonly score: number; readonly evidenceIds: readonly EntityId[]; readonly evidence: string; readonly problem: string; readonly reason: string; readonly impact: string; readonly recommendation: string; }
export interface ReviewProviderOutput { readonly dimensions: readonly ReviewFinding[]; readonly summary: string; }
export interface ReviewProvider { readonly id: string; readonly mock: boolean; review(input: ReviewProviderInput): Promise<ReviewProviderOutput>; }
export class ReviewProviderError extends Error { constructor(readonly code: "INVALID_INPUT" | "INVALID_OUTPUT", message: string) { super(message); this.name = "ReviewProviderError"; } }
export function validateReviewOutput(output: ReviewProviderOutput): ReviewProviderOutput { if (output.dimensions.length !== REVIEW_RUBRIC.length || REVIEW_RUBRIC.some(key => !output.dimensions.some(item => item.key === key))) throw new ReviewProviderError("INVALID_OUTPUT", "Review must cover all seven rubric dimensions."); for (const item of output.dimensions) if (item.score < 0 || item.score > 100 || item.evidenceIds.length === 0 || [item.evidence, item.problem, item.reason, item.impact, item.recommendation].some(value => !value.trim())) throw new ReviewProviderError("INVALID_OUTPUT", `Review dimension ${item.key} is incomplete.`); if (!output.summary.trim()) throw new ReviewProviderError("INVALID_OUTPUT", "Review summary is required."); return output; }
