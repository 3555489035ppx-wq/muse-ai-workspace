import { z } from "zod";

export const productConceptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  conceptStatement: z.string().min(8),
  coreMechanism: z.string().min(8),
  userExperience: z.string().min(8),
  whyFitsDirection: z.string().min(8),
  brandExpression: z.string().min(2).optional(),
  spatialExpression: z.string().min(2).optional(),
  productExpression: z.string().min(2).optional(),
  digitalExpression: z.string().min(2).optional(),
  evidenceIds: z.array(z.string()).default([]),
  insightIds: z.array(z.string()).default([]),
  advantages: z.array(z.string().min(2)).min(1),
  risks: z.array(z.string().min(2)).min(1),
  validationQuestions: z.array(z.string().min(4)).min(1),
});

export const conceptCandidateSchema = productConceptSchema;

export const conceptsResponseSchema = z.object({ concepts: z.array(conceptCandidateSchema).length(3) });

export const visualBriefSchema = z.object({
  subject: z.string().min(8), scene: z.string().min(8), form: z.string().min(8), materials: z.string().min(4), interaction: z.string().min(4), camera: z.string().min(4), lighting: z.string().min(4), composition: z.string().min(4), constraints: z.array(z.string()).min(3), negativePrompt: z.string().min(8),
});

export const cmfResponseSchema = z.object({ cmfSchemes: z.array(z.object({ code: z.string(), name: z.string().min(2), summary: z.string().min(6), parts: z.array(z.object({ part: z.string().min(1), material: z.string().min(1), color: z.string().min(1), finish: z.string().min(1), rationale: z.string().min(4), risk: z.string().min(4), validation: z.string().min(4) })).min(2) })).length(3) });

export const reviewResponseSchema = z.object({
  summary: z.string().min(8),
  dimensions: z.array(z.object({ dimension: z.enum(["brief", "evidence", "direction", "concept", "visual", "interaction", "cmf", "feasibility", "risk"]), finding: z.string().min(6), evidence: z.string().min(4), action: z.string().min(4), severity: z.enum(["low", "medium", "high"]) })).min(9),
});

const nonEmptyStringList = z.array(z.string().min(1)).max(16);

export const overviewResponseSchema = z.object({
  projectName: z.string().min(1),
  projectType: z.array(z.string().min(1)).min(1).max(4),
  location: z.string().nullable().optional(),
  timeContext: z.string().nullable().optional(),
  projectSummary: z.string().min(20),
  designGoal: z.string().min(20),
  coreConflict: z.object({ title: z.string().min(3), explanation: z.string().min(12) }).passthrough(),
  targetUser: z.object({ primary: z.string().min(3), traits: nonEmptyStringList.max(6) }).passthrough(),
  keywords: nonEmptyStringList.min(1).max(8),
  mustKeep: nonEmptyStringList,
  mustAvoid: nonEmptyStringList,
  deliverables: nonEmptyStringList,
  successCriteria: nonEmptyStringList,
  openQuestions: nonEmptyStringList,
}).passthrough();

const researchEvidenceResponseSchema = z.object({
  id: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
  title: z.string().min(2),
  fact: z.string().min(4).optional(),
  originalExcerpt: z.string().min(4).optional(),
  interpretation: z.string().min(8).optional(),
  museInterpretation: z.string().min(8).optional(),
  designImplication: z.string().min(8),
  limitation: z.string().min(4).optional(),
  sourceTitle: z.string().min(2).optional(),
  sourceType: z.string().min(2).optional(),
  status: z.string().optional(),
}).passthrough();

export const researchResponseSchema = z.object({
  evidence: z.array(researchEvidenceResponseSchema).min(1),
  insights: z.array(z.object({ statement: z.string().min(8), rationale: z.string().min(8).optional(), opportunity: z.string().min(8).optional() }).passthrough()).optional(),
}).passthrough();

export const insightResponseSchema = z.object({
  insights: z.array(z.object({
    id: z.string().min(1).optional(),
    title: z.string().min(3),
    insightStatement: z.string().min(12),
    whyItMatters: z.string().min(12),
    designImplication: z.string().min(12),
    evidenceIds: z.array(z.string().min(1)).min(1),
    evidenceStrength: z.enum(["strong", "medium", "preliminary"]).optional(),
    relatedBriefFields: z.array(z.string().min(1)).optional(),
    status: z.string().optional(),
  }).passthrough()).min(2).max(4),
}).passthrough();

export const versionResponseSchema = z.object({
  changeSummary: z.string().min(8),
  whatChanged: z.string().min(8),
  why: z.string().min(8),
  retained: z.array(z.string().min(1)).optional(),
  reviewTrigger: z.string().min(4).optional(),
  evidenceIds: z.array(z.string().min(1)).optional(),
  insightIds: z.array(z.string().min(1)).optional(),
}).passthrough();

const conceptSemanticFields = ["coreMechanism", "userExperience", "whyFitsDirection", "brandExpression", "spatialExpression", "productExpression", "digitalExpression"] as const;

function conceptTokens(value: string): Set<string> {
  const normalized = value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const tokens = new Set<string>();
  for (const word of value.toLowerCase().match(/[a-z0-9]+/g) ?? []) tokens.add(word);
  for (let index = 0; index < normalized.length - 1; index += 1) tokens.add(normalized.slice(index, index + 2));
  return tokens;
}

function conceptFieldSimilarity(left: string, right: string): number {
  if (left.trim() === right.trim()) return 1;
  const a = conceptTokens(left);
  const b = conceptTokens(right);
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap / new Set([...a, ...b]).size;
}

/** Rejects copy-pasted ProductConcept fields before they reach ProjectBrain. */
export function crossFieldSimilarityError(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as { concepts?: unknown }).concepts)) return undefined;
  for (const [conceptIndex, raw] of (value as { concepts: unknown[] }).concepts.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const fields = conceptSemanticFields
      .map((field) => [field, typeof row[field] === "string" ? row[field].trim() : ""] as const)
      .filter(([, text]) => text.length >= 8);
    for (let leftIndex = 0; leftIndex < fields.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < fields.length; rightIndex += 1) {
        const left = fields[leftIndex];
        const right = fields[rightIndex];
        if (!left || !right) continue;
        const [leftField, leftText] = left;
        const [rightField, rightText] = right;
        if (conceptFieldSimilarity(leftText, rightText) >= 0.82) {
          return `concepts[${conceptIndex}].${leftField} and ${rightField} are too similar`;
        }
      }
    }
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter((item): item is string => Boolean(item)) : [];
}

/**
 * Normalizes the legacy concept field names at the provider boundary only.
 * Everything after validation uses ProductConcept and conceptCandidates.
 */
export function normalizeConceptResponse(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as { concepts?: unknown };
  if (!Array.isArray(raw.concepts)) return value;
  return {
    ...value,
    concepts: raw.concepts.map((item, index) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const name = text(row.name ?? row.title);
      const conceptStatement = text(row.conceptStatement ?? row.productDefinition ?? row.intent);
      const userExperience = text(row.userExperience ?? row.formAndInteraction)
        ?? (list(row.userFlow).join(" → ") || undefined);
      const whyFitsDirection = text(row.whyFitsDirection ?? row.intent ?? row.productDefinition);
      const coreMechanism = text(row.coreMechanism);
      const advantages = list(row.advantages);
      const risks = list(row.risks);
      const validationQuestions = list(row.validationQuestions ?? row.validation);
      return {
        id: text(row.id) ?? `concept-${index + 1}`,
        name,
        conceptStatement,
        coreMechanism,
        userExperience,
        whyFitsDirection,
        brandExpression: text(row.brandExpression),
        spatialExpression: text(row.spatialExpression),
        productExpression: text(row.productExpression ?? row.formAndInteraction),
        digitalExpression: text(row.digitalExpression),
        evidenceIds: list(row.evidenceIds),
        insightIds: list(row.insightIds),
        advantages: advantages.length ? advantages : (text(row.strength) ? [text(row.strength)] : []),
        risks: risks.length ? risks : (text(row.risk) ? [text(row.risk)] : []),
        validationQuestions: validationQuestions.length
          ? validationQuestions
          : (coreMechanism ? [`如何在真实使用中验证：${coreMechanism}`] : []),
      };
    }),
  };
}

const schemasByPurpose: Readonly<Record<string, z.ZodType>> = {
  overview: overviewResponseSchema,
  research: researchResponseSchema,
  insight: insightResponseSchema,
  exploration: conceptsResponseSchema,
  concept: conceptsResponseSchema,
  visual_brief: visualBriefSchema,
  moodboard: cmfResponseSchema,
  cmf: cmfResponseSchema,
  review: reviewResponseSchema,
  version: versionResponseSchema,
};

export function validateAiResult(purpose: string, value: unknown): { readonly success: true; readonly data: unknown } | { readonly success: false; readonly error: string } {
  const schema = schemasByPurpose[purpose];
  if (!schema) return { success: true, data: value };
  const parsed = schema.safeParse(purpose === "concept" || purpose === "exploration" ? normalizeConceptResponse(value) : value);
  if (parsed.success) {
    const similarityError = purpose === "concept" || purpose === "exploration"
      ? crossFieldSimilarityError(parsed.data)
      : undefined;
    if (similarityError) return { success: false, error: similarityError };
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ") };
}
