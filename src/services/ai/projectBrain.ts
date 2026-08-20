import type { DemoVisualRecord, GeneratedVisualProvenance, ProjectBrain } from "../../domain/project/types.js";
import { migrateIndustrialConceptCandidates } from "../../data/industrialDraft.js";
import { ensureDemoVisuals, isDemoPortfolioProject } from "../../data/demoVisuals.js";

type AnyRecord = Record<string, any>;

function asRecords(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter((item): item is Readonly<Record<string, unknown>> => Boolean(item && typeof item === "object")) : [];
}

function projectDomain(project: AnyRecord): ProjectBrain["domain"] {
  const value = `${project.projectType ?? ""} ${project.category ?? ""} ${project.name ?? ""}`.toLowerCase();
  if (/(brand|space|spatial|品牌|空间|快闪|展陈)/.test(value)) return "brand-spatial";
  if (/(digital|app|web|service|数字|软件|界面)/.test(value)) return "digital";
  return "industrial";
}

function normalizeEvidence(item: AnyRecord, projectId: string, index: number) {
  const sourceId = item.sourceId ?? `${projectId}-evidence-source-${index + 1}`;
  return {
    ...item,
    projectId,
    sourceId,
    sourceTitle: item.sourceTitle ?? item.source ?? item.sourceName ?? "项目研究记录",
    sourceType: item.sourceType ?? "user_paste",
    fact: item.fact ?? item.excerpt ?? item.title,
    originalExcerpt: item.originalExcerpt ?? item.excerpt ?? item.fact ?? item.title,
    interpretation: item.interpretation ?? item.museInterpretation ?? item.meaning ?? "待 Muse 解释",
    museInterpretation: item.museInterpretation ?? item.interpretation ?? item.meaning,
    designImplication: item.designImplication ?? item.meaning ?? "待进入设计判断",
    limitation: item.limitation ?? item.limitations ?? "仍需真实研究补充",
    status: item.status ?? (item.accepted === true ? "accepted" : undefined),
  };
}

function normalizeInsight(item: AnyRecord, projectId: string) {
  const evidenceIds = item.evidenceIds ?? item.sourceEvidenceIds ?? [];
  return {
    ...item,
    projectId,
    evidenceIds,
    sourceEvidenceIds: item.sourceEvidenceIds ?? evidenceIds,
    status: item.status ?? (item.confirmed === true ? "confirmed" : undefined),
  };
}

function acceptedEvidenceFor(project: AnyRecord, industrial: AnyRecord) {
  const source = asRecords(project.researchWorkspace?.evidence ?? industrial.evidence);
  return source.map((item, index) => normalizeEvidence(item, String(project.id), index)).filter((item: AnyRecord) => {
    if (item.status === "accepted" || item.accepted === true || item.userStatus === "accepted" || industrial.selectedEvidenceIds?.includes(item.id)) return true;
    return isDemoPortfolioProject(project) && item.type !== "rejected";
  });
}

function confirmedInsightsFor(project: AnyRecord, industrial: AnyRecord) {
  const source = asRecords(project.designInsights?.insights ?? project.designInsights ?? industrial.insights);
  return source.map((item) => normalizeInsight(item, String(project.id))).filter((item: AnyRecord) => {
    if (item.status === "confirmed" || item.confirmed === true || industrial.selectedInsightIds?.includes(item.id)) return true;
    return isDemoPortfolioProject(project) && item.status !== "rejected";
  });
}

export function buildProjectBrain(project: AnyRecord): ProjectBrain {
  const industrial = project.industrial ?? {};
  const acceptedEvidence = Array.isArray(project.projectBrain?.acceptedEvidence)
    ? asRecords(project.projectBrain.acceptedEvidence).map((item, index) => normalizeEvidence(item as AnyRecord, String(project.id), index))
    : acceptedEvidenceFor(project, industrial);
  const confirmedInsights = Array.isArray(project.projectBrain?.confirmedInsights)
    ? asRecords(project.projectBrain.confirmedInsights).map((item) => normalizeInsight(item as AnyRecord, String(project.id)))
    : confirmedInsightsFor(project, industrial);
  const directions = asRecords(project.designDirections?.directions ?? project.designDirections ?? industrial.directions);
  // ProjectBrain is the persisted canonical source. Legacy industrial fields
  // remain only as a migration fallback for pre-V4.2 projects.
  const concepts = Array.isArray(project.projectBrain?.conceptCandidates)
    ? asRecords(project.projectBrain.conceptCandidates)
    : asRecords(migrateIndustrialConceptCandidates(industrial));
  const liveVisuals = asRecords(industrial.generatedVisuals);
  const demoVisuals = (isDemoPortfolioProject(project) || industrial.visualMode === "demo-asset")
    ? ensureDemoVisuals(project, industrial) as unknown as DemoVisualRecord[]
    : asRecords(industrial.demoVisuals) as unknown as DemoVisualRecord[];
  const visuals = [...liveVisuals, ...demoVisuals].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index) as unknown as readonly GeneratedVisualProvenance[];
  const originValues = [
    ...concepts,
    ...directions,
    ...acceptedEvidence,
    ...confirmedInsights,
    ...visuals,
    ...asRecords(industrial.cmfSchemes),
    ...asRecords(industrial.reviews),
  ].map((item: AnyRecord) => item.contentOrigin).filter(Boolean);
  const contentOrigin = originValues.includes("real_ai")
    ? "real_ai"
    : originValues.includes("cached_ai")
      ? "cached_ai"
      : originValues.includes("user")
        ? "user"
        : isDemoPortfolioProject(project) ? "demo_seed" : "user";
  const selectedVisualId = industrial.selectedVisualId;
  const selectedDirection = directions.find((item: AnyRecord) => item.id === industrial.selectedDirectionId);
  const selectedConcept = concepts.find((item: AnyRecord) => item.id === industrial.selectedConceptId);
  return {
    projectId: String(project.id),
    projectName: String(project.name ?? "未命名项目"),
    domain: projectDomain(project),
    originalBrief: project.originalBrief ?? project.sourceBrief ?? {},
    projectOverview: project.projectOverview ?? project.overview ?? {},
    designBrief: project.designBrief ?? industrial.brief ?? {},
    acceptedEvidence,
    confirmedInsights,
    directionCandidates: directions,
    lockedDirection: project.lockedDirection ?? selectedDirection,
    conceptCandidates: concepts.filter((item: AnyRecord) => !industrial.selectedDirectionId || item.directionId === industrial.selectedDirectionId),
    selectedConcept,
    conceptGeneration: project.projectBrain?.conceptGeneration,
    generatedVisuals: visuals,
    demoVisuals,
    selectedVisual: visuals.find((item) => item.id === selectedVisualId),
    cmfDecision: asRecords(industrial.cmfSchemes).find((item: AnyRecord) => item.id === industrial.selectedCMFId),
    reviewResults: asRecords(industrial.reviews),
    versionEvents: asRecords(industrial.versionStory),
    decisions: asRecords(industrial.decisions),
    userLockedFields: Array.isArray(project.userLockedFields) ? project.userLockedFields.map(String) : [],
    contentOrigin,
  };
}
