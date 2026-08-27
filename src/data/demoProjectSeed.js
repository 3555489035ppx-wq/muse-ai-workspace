import { createOriginalBriefSnapshot, createProjectOverview } from "../lib/ai/projectOverviewProvider.js";
import { createDesignBrief } from "../lib/ai/designBriefProvider.js";
import { createHypotheses, createResearchWorkspace, getResearchLenses, getResearchQuestions, recomputeResearchWorkspace } from "../lib/ai/researchEvidenceProvider.js";

const timestamp = "2026-08-02T08:00:00.000Z";

function sourceId(projectId, evidenceId) {
  return `${projectId}-${evidenceId}-source`;
}

function createDemoDesignInsights(industrial = {}, projectId = industrial.projectId ?? null) {
  const selectedIds = new Set((industrial.selectedInsightIds ?? []).map(String));
  return (industrial.insights ?? []).map((item, index) => {
    const evidenceIds = item.evidenceIds ?? item.sourceEvidenceIds ?? [];
    const title = item.title ?? item.statement ?? `项目洞察 ${index + 1}`;
    const insightStatement = item.insightStatement ?? item.statement ?? item.opportunity ?? title;
    const designImplication = item.designImplication ?? item.opportunity ?? item.rationale ?? "把这条判断转成下一阶段可验证的设计约束。";
    return {
      id: item.id,
      projectId,
      title,
      insightStatement,
      patternSummary: item.patternSummary ?? `由 ${evidenceIds.length} 条项目研究证据共同指向：${insightStatement}`,
      inferenceType: evidenceIds.length > 1 ? "cross_evidence_pattern" : "single_evidence_hypothesis",
      whyItMatters: item.whyItMatters ?? item.rationale ?? "这条判断会改变后续方案的取舍。",
      designImplication,
      evidenceIds,
      sourceEvidenceIds: evidenceIds,
      evidenceStrength: evidenceIds.length > 1 ? "strong" : "preliminary",
      relatedBriefFields: [],
      // The seed includes candidate insights beyond the three that the demo
      // decision map says a human retained. Keep those candidates visible but
      // do not mark them as confirmed, otherwise the max-four confirmation
      // gate becomes impossible to complete.
      status: item.status === "rejected" ? "rejected" : selectedIds.size ? (selectedIds.has(String(item.id)) ? "confirmed" : "candidate") : (index < 3 ? "confirmed" : "candidate"),
      confirmed: item.status !== "rejected" && (selectedIds.size ? selectedIds.has(String(item.id)) : index < 3),
      userEdited: false,
      evidenceSourceCount: evidenceIds.length,
      image: null,
      imageSource: "not-generated",
    };
  });
}

/**
 * Repair the deterministic selection state of a portfolio demo after it has
 * been opened by an older local database.  The demo is meant to be reviewable
 * end-to-end, so a missing legacy selection must not turn a populated concept,
 * CMF, or review record into an empty gate page.
 */
export function repairDemoIndustrialSelection(industrial = {}) {
  const directions = Array.isArray(industrial.directions) ? industrial.directions : [];
  const concepts = Array.isArray(industrial.conceptCandidates) ? industrial.conceptCandidates : [];
  const cmfSchemes = Array.isArray(industrial.cmfSchemes) ? industrial.cmfSchemes : [];
  const reviews = Array.isArray(industrial.reviews) ? industrial.reviews : [];
  const versions = Array.isArray(industrial.versionStory) ? industrial.versionStory : [];
  const visuals = [
    ...(Array.isArray(industrial.demoVisuals) ? industrial.demoVisuals : []),
    ...(Array.isArray(industrial.generatedVisuals) ? industrial.generatedVisuals : []),
  ];

  const direction = directions.find((item) => item.id === industrial.selectedDirectionId) ?? directions[0] ?? null;
  const directionId = direction?.id ?? null;
  const directionConcepts = concepts.filter((item) => !directionId || item.directionId === directionId);
  const concept = concepts.find((item) => item.id === industrial.selectedConceptId && (!directionId || item.directionId === directionId))
    ?? directionConcepts[0]
    ?? concepts[0]
    ?? null;
  const conceptId = concept?.id ?? null;
  const cmf = cmfSchemes.find((item) => item.id === industrial.selectedCMFId && (!item.conceptId || !conceptId || item.conceptId === conceptId))
    ?? cmfSchemes.find((item) => !item.conceptId || !conceptId || item.conceptId === conceptId)
    ?? cmfSchemes[0]
    ?? null;
  const review = reviews.find((item) => item.id === industrial.currentReviewId) ?? reviews[0] ?? null;
  const version = versions.find((item) => item.id === industrial.currentVersionId) ?? versions.at(-1) ?? null;
  const conceptVisuals = visuals.filter((item) => item.stage === "concept" && (!conceptId || item.conceptId === conceptId));
  const selectedVisual = visuals.find((item) => item.id === industrial.selectedVisualId)
    ?? conceptVisuals[0]
    ?? visuals.find((item) => item.stage === "concept")
    ?? visuals[0]
    ?? null;

  return {
    ...industrial,
    selectedDirectionId: directionId,
    directionLocked: Boolean(directionId),
    selectedConceptId: conceptId,
    selectedCMFId: cmf?.id ?? null,
    currentReviewId: review?.id ?? null,
    currentVersionId: version?.id ?? null,
    selectedVisualId: selectedVisual?.id ?? null,
  };
}

/**
 * Turn the curated portfolio evidence into the same traceable shape used by
 * the research workspace.  These are labelled project seed records, not
 * invented external research; the user can replace or reject them later.
 */
export function createDemoResearchWorkspace({ project = {}, brief = {}, industrial = {} } = {}) {
  const base = createResearchWorkspace({ project, brief });
  const questions = base.questions?.length ? base.questions : getResearchQuestions(brief, project);
  const lenses = base.lenses?.length ? base.lenses : getResearchLenses(brief, project);
  const evidence = (industrial.evidence ?? []).map((item, index) => {
    const source = sourceId(project.id, item.id);
    const excerpt = item.excerpt || item.fact || item.meaning || item.title;
    return {
      id: item.id,
      sourceId: source,
      title: item.title || `${project.name} · 研究证据 ${index + 1}`,
      type: "verified",
      userStatus: "accepted",
      verificationStatus: "verified",
      sourceType: "user_paste",
      sourceTypeLabel: "项目研究种子",
      sourceName: item.source || `${project.name} · 项目研究种子`,
      sourceTitle: item.source || `${project.name} · 项目研究种子`,
      sourcePublisher: "Muse portfolio seed",
      sourceUrl: item.sourceUrl || null,
      originalExcerpt: excerpt,
      fact: item.fact || excerpt,
      interpretation: item.meaning || item.museInterpretation || "由项目研究种子提供的可追溯判断。",
      designImplication: item.designImplication || item.meaning || "该证据需要进入设计判断并在后续样机中验证。",
      limitations: item.limitations || item.limitation || "项目种子记录，需用真实用户研究或工程验证补充。",
      confidence: item.credibility === "设计师已确认" ? "high" : "medium",
      questionIds: [questions[index % Math.max(questions.length, 1)]?.id].filter(Boolean),
      lensIds: [lenses[index % Math.max(lenses.length, 1)]?.id].filter(Boolean),
      traceableSource: true,
      userProvidedSource: true,
      capturedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      accepted: true,
    };
  });
  const sources = evidence.map((item) => ({
    id: item.sourceId,
    type: "user_paste",
    name: item.sourceTitle,
    sourceTitle: item.sourceTitle,
    sourcePublisher: item.sourcePublisher,
    sourceUrl: item.sourceUrl,
    originalExcerpt: item.originalExcerpt,
    userProvidedSource: true,
    capturedAt: timestamp,
    limitations: item.limitations,
  }));
  return recomputeResearchWorkspace({
    ...base,
    schemaVersion: 3,
    projectId: project.id,
    mode: "demo_portfolio_seed",
    providerStatus: "seed_ready",
    status: "reviewing",
    questions,
    lenses,
    sources,
    evidence,
    hypotheses: createHypotheses({ project, brief, questions }),
    evidenceLimited: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Enrich an existing demo seed with the canonical top-level workflow records.
 * Existing user edits are preserved by the database seeders; this helper only
 * creates the missing V4.2 structures for a fresh/legacy demo project.
 */
export function enrichDemoProjectSeed(project, sourceBrief = project?.industrial?.brief ?? {}) {
  const originalBrief = project.originalBrief ?? createOriginalBriefSnapshot({ project, sourceBrief });
  const projectWithOriginal = { ...project, originalBrief };
  const projectOverview = project.projectOverview ?? createProjectOverview({ project: projectWithOriginal, sourceBrief, industrial: project.industrial });
  const generatedBrief = project.designBrief ?? createDesignBrief({ project: projectWithOriginal, sourceBrief, industrial: project.industrial, projectOverview });
  const designBrief = {
    ...generatedBrief,
    status: "confirmed",
    confirmedAt: project.briefConfirmedAt ?? timestamp,
  };
  const researchWorkspace = project.researchWorkspace ?? createDemoResearchWorkspace({ project: projectWithOriginal, brief: designBrief, industrial: project.industrial });
  const designInsights = project.designInsights?.length ? project.designInsights : createDemoDesignInsights(project.industrial, project.id);
  const confirmedInsightIds = project.confirmedInsightIds?.length
    ? project.confirmedInsightIds
    : (project.industrial?.selectedInsightIds ?? designInsights.filter((item) => item.status === "confirmed").slice(0, 3).map((item) => item.id));
  return {
    ...projectWithOriginal,
    projectOverview,
    overviewVersion: project.overviewVersion ?? 2,
    lastOverviewGeneratedAt: project.lastOverviewGeneratedAt ?? timestamp,
    designBrief,
    briefStatus: "confirmed",
    briefConfirmedAt: designBrief.confirmedAt,
    briefVersion: project.briefVersion ?? 2,
    researchWorkspace,
    designInsights,
    confirmedInsightIds,
    insightGenerationMeta: project.insightGenerationMeta ?? { source: "demo-seed", mode: "demo-asset", status: "ready", generatedAt: timestamp },
    demoPortfolioReady: true,
  };
}
