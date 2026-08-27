import { create } from 'zustand';
export { museV3Store, useMuseV3Store } from './useMuseV3Store';
import { db } from '../lib/database';
import { createId, now } from '../lib/ids';
import { cleanupLegacySeedOnce } from '../lib/migrations/legacySeedCleanup';
import { organizeProjectBrief } from '../lib/ai/localBriefProvider';
import { ComfyUIProvider } from '../lib/ai/ComfyUIProvider';
import { evaluateExploration } from '../lib/critique/museCritique';
import { comfyMessageToWorkflowEvent, createWorkflowRun, reduceWorkflowRun } from '../lib/workflow/generationWorkflow';
import { seedJinganbaoDemo } from '../db/seedJinganbao';
import { seedIndustrialPortfolio } from '../db/seedIndustrialPortfolio';
import { INDUSTRIAL_PROJECT_ORDER } from '../data/industrialPortfolio';
import { isDemoPortfolioProject, ensureDemoVisuals } from '../data/demoVisuals';
import { DemoVisualProvider } from '../services/visuals/demoVisualProvider';
import { buildDeterministicReview, transitionIndustrialState } from '../domain/industrial/verticalSlice';
import { createIndustrialDraftState, mergeIndustrialBrief, mergeIndustrialCmf, mergeIndustrialConcepts, mergeIndustrialDirections, normalizeIndustrialReview } from '../data/industrialDraft';
import { briefInstruction, cmfInstruction, conceptInstruction, directionInstruction, industrialSchemaHints, insightInstruction, overviewInstruction, requestIndustrialImage, requestIndustrialImageEdit, requestIndustrialResearchSearch, requestIndustrialStructured, researchInstruction, researchPlanInstruction, reviewInstruction, validateIndustrialImage, versionInstruction, visualBriefInstruction } from '../lib/ai/industrialAi';
import { hydrateIndustrialVisuals } from '../lib/ai/industrialVisuals';
import { createOriginalBriefSnapshot, createProjectOverview, validateProjectOverview } from '../lib/ai/projectOverviewProvider';
import { completeCoreTension, createDesignBrief, designBriefInstruction, validateDesignBrief } from '../lib/ai/designBriefProvider';
import { acceptResearchEvidence as acceptResearchEvidenceModel, createCandidateEvidence, createResearchAssistant, createResearchSearchState, createResearchSource as createResearchSourceRecord, createResearchWorkspace, evidenceAction, migrateResearchWorkspace, normalizeResearchAssistantResult, normalizeResearchSearchResults, recomputeResearchWorkspace, updateResearchEvidence } from '../lib/ai/researchEvidenceProvider';
import { generateDesignInsights, getAcceptedResearchEvidence, getDesignInsightContextSignature, qualityReviewDesignInsights } from '../lib/ai/designInsightProvider';
import { generateDesignDirections, getDirectionRecommendation, normalizeDirectionResponse } from '../lib/ai/designDirectionProvider';
import { ensureLocalAccount, LOCAL_ACCOUNT_PREFERENCE, updateLocalAccount } from '../lib/account/localAccount';
import { buildProjectBrain } from '../services/ai/projectBrain';
import { localizeAiFailure, localizeThrownAiFailure } from '../lib/ai/errorMessages';

const emptyJob = { status: 'idle', message: '' };
const cancelledGenerationProjects = new Set();
const activeGenerationControllers = new Map();
const industrialProjectRank = new Map(INDUSTRIAL_PROJECT_ORDER.map((id, index) => [id, index]));
const overviewEditableFields = new Set([
  'projectName', 'projectType', 'location', 'timeContext', 'projectSummary', 'designGoal',
  'coreConflict', 'targetUser', 'keywords', 'mustKeep', 'mustAvoid', 'deliverables',
  'successCriteria', 'openQuestions', 'designConstants', 'designExclusions', 'expectedOutcomes', 'outcomeDefinition',
]);

const briefEditableFields = new Set([
  'coreDesignQuestion', 'designObjective', 'coreTension', 'targetUser', 'coreScenario',
  'designRequirements', 'designConstants', 'designExclusions', 'expectedOutcomes', 'assumptions',
  'unknowns', 'initialSuccessCriteria', 'researchQuestions', 'workflowRequirements',
]);

function directionRowsForIndustrial(current, generatedDirections = []) {
  const legacy = current.industrial?.directions ?? [];
  return generatedDirections.map((direction, index) => {
    const previous = legacy[index] ?? {};
    return {
      ...previous,
      ...direction,
      id: previous.id ?? direction.id,
      code: direction.code ?? previous.code ?? String.fromCharCode(65 + index),
      // Keep the legacy concept linkage readable while the new Direction page
      // works with strategy fields instead of the old industrial template.
      formLanguage: direction.strategicIdea,
      opportunity: direction.thesis,
      hypothesis: direction.strategicIdea,
      tradeoff: direction.tradeoffs?.join('；') ?? previous.tradeoff ?? '',
      validationMetric: direction.validationQuestions?.join('；') ?? previous.validationMetric ?? '',
      keywords: direction.keywords ?? previous.keywords ?? [],
      image: null,
      imageSource: 'not-generated',
    };
  });
}

function applyGeneratedDirections(current, generated, source = 'local') {
  const directions = directionRowsForIndustrial(current, generated.directions);
  const recommendation = getDirectionRecommendation(directions, generated.context);
  const selectedDirectionId = current.industrial?.selectedDirectionId && directions.some((item) => item.id === current.industrial.selectedDirectionId)
    ? current.industrial.selectedDirectionId
    : null;
  const industrial = {
    ...current.industrial,
    directions,
    selectedDirectionId,
    directionLocked: Boolean(selectedDirectionId && current.industrial?.directionLocked),
    ai: { ...current.industrial?.ai, mode: source === 'live' ? 'live' : 'local', lastOperation: 'direction', updatedAt: now() },
  };
  return {
    ...current,
    industrial,
    designDirections: directions,
    directionContext: generated.context,
    directionContextSignature: generated.contextSignature,
    directionGenerationMeta: { ...generated.generationMeta, source, quality: generated.quality },
    directionRecommendation: recommendation,
    directionPairwiseDifferences: generated.pairwiseDifferences ?? { AB: '', AC: '', BC: '' },
    directionGate: generated.gate ?? { acceptedEvidenceCount: generated.context?.acceptedEvidence?.length ?? 0, confirmedInsightCount: generated.context?.confirmedInsights?.length ?? 0, ready: directions.length === 3 },
  };
}

function researchWorkspaceIsCurrent(workspace, project, brief) {
  if (!workspace || workspace.schemaVersion !== 3 || workspace.projectId !== project?.id) return false;
  const expected = createResearchWorkspace({ project, brief });
  return JSON.stringify((workspace.questions ?? []).map((item) => [item.id, item.label])) === JSON.stringify(expected.questions.map((item) => [item.id, item.label]))
    && JSON.stringify((workspace.lenses ?? []).map((item) => [item.id, item.label])) === JSON.stringify(expected.lenses.map((item) => [item.id, item.label]));
}

function syncIndustrialBriefFromDesignBrief(industrial, designBrief) {
  if (!industrial || !designBrief) return industrial;
  const labels = (items) => (items ?? []).map((item) => item.label ?? item).filter(Boolean);
  return {
    ...industrial,
    briefConfirmed: designBrief.status === 'confirmed',
    brief: {
      ...industrial.brief,
      goal: designBrief.designObjective,
      targetUser: designBrief.targetUser.primary,
      scenario: designBrief.coreScenario,
      keyNeeds: labels(designBrief.designRequirements).slice(0, 6),
      constraints: labels(designBrief.designConstants).slice(0, 8),
      avoid: labels(designBrief.designExclusions).slice(0, 8),
      deliverables: labels(designBrief.expectedOutcomes.explicit).slice(0, 8),
      unknowns: labels(designBrief.unknowns).slice(0, 6),
      keywords: [...designBrief.targetUser.relevantTraits, ...designBrief.referenceContext].slice(0, 8),
      interpretation: designBrief.coreTension.explanation,
    },
  };
}

/**
 * Keep cross-stage counts and candidates in the single ProjectBrain record.
 * Legacy fields remain readable for migration, but new writes always refresh
 * the canonical snapshot so downstream pages do not count different stores.
 */
function persistProjectBrain(project, overrides = {}) {
  const projected = {
    ...project,
    projectBrain: { ...project.projectBrain, ...overrides },
  };
  const brain = buildProjectBrain(projected);
  return {
    ...project,
    projectBrain: {
      ...projected.projectBrain,
      acceptedEvidence: overrides.acceptedEvidence ?? brain.acceptedEvidence,
      confirmedInsights: overrides.confirmedInsights ?? brain.confirmedInsights,
      directionCandidates: overrides.directionCandidates ?? brain.directionCandidates,
      conceptCandidates: overrides.conceptCandidates ?? brain.conceptCandidates,
      contentOrigin: brain.contentOrigin,
    },
  };
}

const mergeOverviewKeepingEdits = (generated, current) => {
  const edited = new Set(current?.overviewUserEditedFields ?? []);
  if (!current?.projectOverview || !edited.size) return generated;
  const next = { ...generated };
  for (const field of edited) {
    if (!overviewEditableFields.has(field)) continue;
    if (field === 'coreConflict') next.coreConflict = current.projectOverview.coreConflict;
    else if (field === 'targetUser') next.targetUser = current.projectOverview.targetUser;
    else next[field] = current.projectOverview[field];
  }
  return validateProjectOverview(next);
};

function understandingVersionId(projectId, version) {
  return `understanding-${projectId}-${version}-${createId('candidate').slice(-8)}`;
}

function understandingFailureMessage(response, fallback = 'AI 服务暂时不可用，当前项目内容已保存。') {
  const detail = response ? localizeAiFailure(response, '') : '';
  return detail ? `项目已创建，但 AI 项目理解暂时生成失败。${detail}` : fallback;
}

function appendUnderstandingVersion(project, snapshot) {
  const versions = Array.isArray(project.projectUnderstandingVersions) ? project.projectUnderstandingVersions : [];
  const version = versions.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  const nextVersion = {
    id: understandingVersionId(project.id, version),
    version,
    createdAt: now(),
    source: snapshot.source,
    projectOverview: snapshot.projectOverview,
    designBrief: snapshot.designBrief,
  };
  return {
    version: nextVersion,
    versions: [...versions, nextVersion],
  };
}

const sortProjects = (items) => [...items].sort((a, b) => {
  const rankA = industrialProjectRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const rankB = industrialProjectRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) return rankA - rankB;
  return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
});

const normalizeProjectVersions = (project) => {
  const story = project.industrial?.versionStory;
  const draftFlagNeedsUpdate = Boolean(project.industrial?.briefConfirmed && project.isDraft);
  if (!Array.isArray(story) || !story.length) return draftFlagNeedsUpdate ? { ...project, isDraft: false } : project;
  let nextNumber = 0;
  let previous = null;
  const fallbackOrigin = project.industrial?.contentOrigin ?? (project.industrial?.prototypeMode === 'portfolio-seed' ? 'demo_seed' : 'user');
  const versionStory = story.map((item) => {
    const parsed = Number(item.number);
    const number = Number.isFinite(parsed) && parsed > 0 ? parsed : nextNumber + 1;
    nextNumber = Math.max(nextNumber, number);
    const next = {
      ...item,
      number,
      parentVersionId: item.parentVersionId ?? previous?.id ?? null,
      retained: Array.isArray(item.retained) ? item.retained : [],
      nextValidation: Array.isArray(item.nextValidation) ? item.nextValidation : [],
      contentOrigin: item.contentOrigin ?? fallbackOrigin,
    };
    previous = next;
    return next;
  });
  return { ...project, isDraft: draftFlagNeedsUpdate ? false : project.isDraft, industrial: { ...project.industrial, versionStory } };
};

const projectSnapshotFromState = (state, projectId) => ({
  project: state.projects.find((item) => item.id === projectId),
  briefs: state.briefs.filter((item) => item.projectId === projectId),
  assets: state.assets.filter((item) => item.projectId === projectId),
  researchItems: state.researchItems.filter((item) => item.projectId === projectId),
  moodboardItems: state.moodboardItems.filter((item) => item.projectId === projectId),
  analyses: state.analyses.filter((item) => item.projectId === projectId),
  directions: state.directions.filter((item) => item.projectId === projectId),
  explorations: state.explorations.filter((item) => item.projectId === projectId),
  critiques: state.critiques.filter((item) => item.projectId === projectId),
  canvas: state.canvas.filter((item) => item.projectId === projectId),
});

const normalizeProjectOwnership = (project, account) => {
  if (project.ownerId) {
    return project.ownerScope ? project : {
      ...project,
      ownerScope: project.ownerId === account?.id ? 'user' : 'starter',
    };
  }
  return {
    ...project,
    ownerId: project.isDraft ? account?.id ?? 'local-guest' : 'starter',
    ownerScope: project.isDraft ? 'user' : 'starter',
  };
};

const normalizeAssetOwnership = (asset, projectOwners, account) => {
  const originalAsset = asset.originalAsset ?? (asset.url ? { url: asset.url, width: asset.width, height: asset.height, mimeType: asset.mimeType } : null);
  const displayAsset = asset.displayAsset ?? (asset.url ? { url: asset.url, width: asset.width, height: asset.height, fit: 'contain', crop: 'none' } : null);
  const ownerId = asset.ownerId ?? (asset.projectId ? projectOwners.get(asset.projectId) : undefined) ?? 'starter';
  const normalized = {
    ...asset,
    ownerId,
    ownerScope: ownerId === account?.id ? 'user' : 'starter',
    provenance: asset.provenance ?? (ownerId === 'starter' ? { type: 'starter-library', label: 'Muse 起始素材' } : undefined),
    ...(originalAsset ? { originalAsset } : {}),
    ...(displayAsset ? { displayAsset } : {}),
  };
  return asset.ownerId && asset.ownerScope && asset.originalAsset === originalAsset && asset.displayAsset === displayAsset ? asset : normalized;
};

const loadAll = async () => {
  const [rawProjects, briefs, assets, moodboardItems, analyses, directions, explorations, critiques, versions, canvas, templates, templateFavorites, researchItems, assetCollections, directionLibrary, trash, preferences, providerConfigs, workflowRuns] = await Promise.all([
    db.projects.orderBy('updatedAt').reverse().toArray(),
    db.briefs.toArray(), db.assets.toArray(), db.moodboardItems.toArray(), db.analyses.toArray(),
    db.directions.toArray(), db.explorations.toArray(), db.critiques.toArray(), db.versions.toArray(),
    db.canvas.toArray(), db.templates.toArray(), db.templateFavorites.toArray(), db.researchItems.toArray(), db.assetCollections.toArray(), db.directionLibrary.toArray(),
    db.trash.orderBy('deletedAt').reverse().toArray(), db.preferences.toArray(), db.providerConfigs.toArray(), db.workflowRuns.toArray(),
  ]);
  const account = preferences.find((item) => item.id === LOCAL_ACCOUNT_PREFERENCE)?.value ?? null;
  const normalizedProjects = rawProjects.map((item) => normalizeProjectOwnership(normalizeProjectVersions(item), account));
  const changedProjects = normalizedProjects.filter((item, index) => item !== rawProjects[index]);
  if (changedProjects.length) await db.projects.bulkPut(changedProjects);
  const projectOwners = new Map(normalizedProjects.map((item) => [item.id, item.ownerId]));
  const normalizedAssets = assets.map((item) => normalizeAssetOwnership(item, projectOwners, account));
  const changedAssets = normalizedAssets.filter((item, index) => item !== assets[index]);
  if (changedAssets.length) await db.assets.bulkPut(changedAssets);
  return { account, projects: sortProjects(normalizedProjects), briefs, assets: normalizedAssets, moodboardItems, analyses, directions, explorations, critiques, versions, canvas, templates, templateFavorites, researchItems, assetCollections, directionLibrary, trash, preferences, providerConfigs, workflowRuns };
};

export const useMuseStore = create((set, get) => ({
  ready: false, account: null,
  projects: [], briefs: [], assets: [], moodboardItems: [], analyses: [], directions: [],
  explorations: [], critiques: [], versions: [], canvas: [], templates: [], researchItems: [],
  directionLibrary: [], templateFavorites: [], assetCollections: [], trash: [], preferences: [], providerConfigs: [], workflowRuns: [],
  toasts: [], aiJob: emptyJob,

  initialize: async () => {
    await cleanupLegacySeedOnce(db);
    await ensureLocalAccount(db);
    await seedJinganbaoDemo(db);
    await seedIndustrialPortfolio(db);
    set({ ...(await loadAll()), ready: true });
  },

  refresh: async () => set(await loadAll()),

  ensureResearchWorkspace: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId) ?? await db.projects.get(projectId);
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    const brief = current.designBrief;
    if (!brief) return current;
    const workspace = researchWorkspaceIsCurrent(current.researchWorkspace, current, brief)
      ? current.researchWorkspace
      : migrateResearchWorkspace(current.researchWorkspace, { project: current, brief });
    if (current.researchWorkspace === workspace) return current;
    const next = { ...current, researchWorkspace: workspace, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  addResearchSource: async (projectId, input = {}) => {
    const current = await get().ensureResearchWorkspace(projectId);
    if (!current.researchWorkspace) throw new Error('RESEARCH_BRIEF_NOT_READY');
    const source = createResearchSourceRecord(input);
    const candidate = createCandidateEvidence({ project: current, brief: current.designBrief, source, questionIds: input.questionIds });
    const workspace = recomputeResearchWorkspace({ ...current.researchWorkspace, sources: [source, ...(current.researchWorkspace.sources ?? [])], evidence: [candidate, ...(current.researchWorkspace.evidence ?? [])] });
    const next = { ...current, researchWorkspace: workspace, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    get().pushToast(input.kind === 'url' ? '链接已记录为候选来源，读取后才能采纳' : '材料已加入候选证据');
    return { project: next, source, evidence: candidate };
  },

  searchResearchSources: async (projectId, query, questionId, maxResults = 5) => {
    let current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    current = await get().ensureResearchWorkspace(projectId);
    const workspace = current.researchWorkspace;
    if (!workspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const cleanQuery = String(query ?? '').trim();
    const previousResults = workspace.researchSearch?.results ?? [];
    const searchingWorkspace = { ...workspace, researchSearch: createResearchSearchState({ ...(workspace.researchSearch ?? {}), status: 'searching', query: cleanQuery, questionId: questionId || null, errorMessage: null, results: previousResults }) };
    const running = { ...current, researchWorkspace: searchingWorkspace, updatedAt: now() };
    await db.projects.put(running);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? running : item), aiJob: { status: 'processing', message: '正在搜索真实来源；结果会先进入候选区，需你打开原文核对。' } }));
    const response = await requestIndustrialResearchSearch({ project: current, query: cleanQuery, questionId, maxResults });
    if (response?.source !== 'live' || !response.result) {
      const errorMessage = `真实来源搜索失败：${localizeAiFailure(response, 'Web Search 暂时不可用；你仍可手动添加链接或上传材料。')}`;
      const failedWorkspace = { ...workspace, researchSearch: createResearchSearchState({ ...(workspace.researchSearch ?? {}), status: 'error', query: cleanQuery, questionId: questionId || null, errorMessage, results: previousResults }) };
      const failed = { ...current, researchWorkspace: failedWorkspace, updatedAt: now() };
      await db.projects.put(failed);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? failed : item), aiJob: { status: 'failed', errorCode: response?.errorCode, message: errorMessage } }));
      return failed;
    }
    const trace = response.result.trace ?? {};
    const results = normalizeResearchSearchResults(response.result.results, cleanQuery, trace.providerId);
    const searchedAt = now();
    const searchState = createResearchSearchState({ status: results.length ? 'success' : 'empty', query: cleanQuery, questionId: questionId || null, provider: trace.providerId || 'tavily-search', runId: response.result.runId, searchedAt, results, errorMessage: null });
    const next = { ...current, researchWorkspace: recomputeResearchWorkspace({ ...workspace, researchSearch: searchState }), updatedAt: searchedAt };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: results.length ? `已找到 ${results.length} 条真实来源候选，请打开原文核对。` : '搜索完成，但暂时没有找到可安全导入的公开来源。' } }));
    return next;
  },

  importResearchSearchResult: async (projectId, result, questionId) => {
    const current = await get().ensureResearchWorkspace(projectId);
    if (!current.researchWorkspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const url = String(result?.url ?? '').trim();
    if (!url) return { ok: false, error: 'SEARCH_RESULT_URL_MISSING', project: current };
    const existing = current.researchWorkspace.sources.find((item) => item.sourceUrl === url);
    if (existing) {
      get().pushToast('这个来源已经在候选区，不会重复导入', 'warning');
      return { ok: false, error: 'SEARCH_RESULT_ALREADY_IMPORTED', project: current, source: existing };
    }
    const source = createResearchSourceRecord({ kind: 'external_search', name: result.title, sourceTitle: result.title, sourcePublisher: result.publisher, sourceDate: result.publishedAt, sourceUrl: url, originalExcerpt: result.rawContent || result.snippet, contentStatus: result.contentStatus, searchQuery: result.query || current.researchWorkspace.researchSearch?.query, searchProvider: result.provider || current.researchWorkspace.researchSearch?.provider, searchResultId: result.id, userProvidedSource: false, limitations: result.contentStatus === 'full' ? '搜索服务抓取了正文片段；请打开原文核对上下文、发布日期与适用范围。' : '当前只有搜索摘要；必须打开原文并补充原始摘录后才可采纳。' });
    const candidate = createCandidateEvidence({ project: current, brief: current.designBrief, source, questionIds: questionId ? [questionId] : [] });
    const workspace = recomputeResearchWorkspace({ ...current.researchWorkspace, sources: [source, ...(current.researchWorkspace.sources ?? [])], evidence: [candidate, ...(current.researchWorkspace.evidence ?? [])] });
    const next = { ...current, researchWorkspace: workspace, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    get().pushToast('已导入候选来源；打开原文核对后再采纳');
    return { ok: true, project: next, source, evidence: candidate };
  },

  updateResearchEvidence: async (projectId, evidenceId, patch = {}) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.researchWorkspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const workspace = updateResearchEvidence(current.researchWorkspace, evidenceId, patch);
    const next = { ...current, researchWorkspace: workspace, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  acceptResearchEvidence: async (projectId, evidenceId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.researchWorkspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const result = acceptResearchEvidenceModel(current.researchWorkspace, evidenceId);
    if (!result.ok) {
      get().pushToast(result.error === 'EVIDENCE_NEEDS_ORIGINAL_EXCERPT' ? '搜索摘要不能直接采纳，请打开原文并补充原始摘录' : '没有可追溯原文，暂时不能标记为已验证', 'warning');
      return { ok: false, error: result.error, project: current };
    }
    const next = persistProjectBrain({ ...current, researchWorkspace: result.workspace, updatedAt: now() });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    get().pushToast('证据已采纳，并进入研究摘要');
    return { ok: true, project: next };
  },

  setResearchEvidenceAction: async (projectId, evidenceId, action) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.researchWorkspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const nextWorkspace = evidenceAction(current.researchWorkspace, evidenceId, action);
    const next = persistProjectBrain({ ...current, researchWorkspace: nextWorkspace, updatedAt: now() });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  deleteResearchEvidence: async (projectId, evidenceId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.researchWorkspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const evidence = current.researchWorkspace.evidence.find((item) => item.id === evidenceId);
    const workspace = recomputeResearchWorkspace({
      ...current.researchWorkspace,
      evidence: current.researchWorkspace.evidence.filter((item) => item.id !== evidenceId),
      sources: evidence?.sourceId ? current.researchWorkspace.sources.filter((item) => item.id !== evidence.sourceId) : current.researchWorkspace.sources,
    });
    const next = persistProjectBrain({ ...current, researchWorkspace: workspace, updatedAt: now() });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  setResearchEvidenceLimited: async (projectId, limited = true) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.researchWorkspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    const next = persistProjectBrain({ ...current, researchWorkspace: recomputeResearchWorkspace({ ...current.researchWorkspace, evidenceLimited: limited }), updatedAt: now() });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  ensureDesignInsights: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId) ?? await db.projects.get(projectId);
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    if (!current.designBrief) return current;
    if (isDemoPortfolioProject(current)
      && current.industrial?.demoPortfolioReady
      && current.designInsights?.length
      && current.confirmedInsightIds?.length >= 2
      && current.insightGenerationMeta?.source === 'demo-seed') return current;
    if (current.insightGenerationMeta?.source === 'live' && current.designInsights?.length && current.designInsightContextSignature === getDesignInsightContextSignature(current)) return current;
    const generated = generateDesignInsights(current);
    const existing = new Map((current.designInsights ?? []).map((item) => [item.id, item]));
    const acceptedIds = new Set(generated.evidence.map((item) => item.id));
    const designInsights = generated.insights.map((item) => {
      const saved = existing.get(item.id);
      if (!saved) return item;
      return {
        ...item,
        ...saved,
        evidenceIds: item.evidenceIds,
        sourceEvidenceIds: item.evidenceIds,
        relatedBriefFields: item.relatedBriefFields,
        evidenceStrength: item.evidenceStrength,
      };
    });
    const confirmedInsightIds = (current.confirmedInsightIds ?? [])
      .filter((id) => designInsights.some((item) => item.id === id && item.evidenceIds.every((evidenceId) => acceptedIds.has(evidenceId))));
    const sameContext = current.designInsightContextSignature === generated.contextSignature
      && JSON.stringify(current.designInsights ?? []) === JSON.stringify(designInsights)
      && JSON.stringify(current.confirmedInsightIds ?? []) === JSON.stringify(confirmedInsightIds);
    if (sameContext) return current;
    const next = persistProjectBrain({ ...current, designInsights, confirmedInsightIds, designInsightContextSignature: generated.contextSignature, updatedAt: now() }, { confirmedInsights: designInsights.filter((item) => confirmedInsightIds.includes(item.id)) });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  ensureDesignDirections: async (projectId) => {
    const currentWithInsights = await get().ensureDesignInsights(projectId);
    const current = currentWithInsights?.industrial ? currentWithInsights : await db.projects.get(projectId);
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    if (!current.designBrief || !current.industrial) return current;
    const generated = generateDesignDirections(current);
    const existingDirections = current.designDirections ?? [];
    const sameContext = current.directionContextSignature === generated.contextSignature
      && existingDirections.length === generated.directions.length
      && existingDirections.every((item) => !item.image && item.imageSource === 'not-generated')
      && JSON.stringify(existingDirections.map((item) => [item.strategyKey, item.thesis])) === JSON.stringify(generated.directions.map((item) => [item.strategyKey, item.thesis]));
    if (sameContext) return current;
    const next = { ...applyGeneratedDirections(current, generated), updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  setDesignInsightAction: async (projectId, insightId, action) => {
    const current = await get().ensureDesignInsights(projectId);
    const insights = current.designInsights ?? [];
    if (!insights.some((item) => item.id === insightId)) throw new Error('DESIGN_INSIGHT_NOT_FOUND');
    const confirmed = new Set(current.confirmedInsightIds ?? []);
    const nextStatus = action === 'keep' ? 'confirmed' : action === 'reject' ? 'rejected' : 'candidate';
    if (action === 'keep') confirmed.add(insightId);
    else confirmed.delete(insightId);
    const next = persistProjectBrain({
      ...current,
      designInsights: insights.map((item) => item.id === insightId ? { ...item, status: nextStatus, userEdited: item.userEdited ?? false } : item),
      confirmedInsightIds: [...confirmed],
      updatedAt: now(),
    }, { confirmedInsights: insights.filter((item) => confirmed.has(item.id)).map((item) => item.id === insightId ? { ...item, status: nextStatus } : item) });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  updateDesignInsight: async (projectId, insightId, patch = {}) => {
    const current = await get().ensureDesignInsights(projectId);
    const confirmed = new Set(current.confirmedInsightIds ?? []);
    const next = persistProjectBrain({
      ...current,
      designInsights: (current.designInsights ?? []).map((item) => item.id === insightId ? {
        ...item,
        ...patch,
        status: confirmed.has(insightId) ? 'confirmed' : 'edited',
        userEdited: true,
      } : item),
      updatedAt: now(),
    });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  confirmDesignInsights: async (projectId, insightIds = []) => {
    const current = await get().ensureDesignInsights(projectId);
    const available = new Set((current.designInsights ?? []).map((item) => item.id));
    const selected = [...new Set(insightIds)].filter((id) => available.has(id));
    if (selected.length < 2) throw new Error('DESIGN_INSIGHTS_MINIMUM_NOT_MET');
    if (selected.length > 4) throw new Error('DESIGN_INSIGHTS_MAXIMUM_EXCEEDED');
    if (!current.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    const timestamp = now();
    const industrial = {
      ...current.industrial,
      selectedInsightIds: selected,
      currentStage: 'direction',
      completedStages: [...new Set([...(current.industrial.completedStages ?? []), 'insight'])],
      decisions: [...(current.industrial.decisions ?? []), {
        id: `insights-confirmed-${timestamp}-${selected[0].slice(-6)}`,
        type: 'INSIGHTS_CONFIRMED',
        at: timestamp,
        selectedInsightId: selected[0],
        insightIds: selected,
        label: `确认 ${selected.length} 条设计洞察`,
      }],
    };
    const next = persistProjectBrain({
      ...current,
      industrial,
      confirmedInsightIds: selected,
      designInsights: (current.designInsights ?? []).map((item) => ({ ...item, status: selected.includes(item.id) ? 'confirmed' : item.status === 'rejected' ? 'rejected' : 'candidate' })),
      stage: 'direction',
      progress: Math.min(96, 12 + ([...(industrial.completedStages ?? [])].length * 10)),
      updatedAt: timestamp,
    }, { confirmedInsights: (current.designInsights ?? []).filter((item) => selected.includes(item.id)).map((item) => ({ ...item, status: 'confirmed' })) });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  ensureIndustrialProject: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId) ?? await db.projects.get(projectId);
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    const sourceBrief = get().briefs.find((item) => item.projectId === projectId) ?? await db.briefs.where('projectId').equals(projectId).first();
    const staleLocalDraft = current.industrial?.prototypeMode === 'local-draft' && current.industrial.currentStage === 'brief' && current.industrial.brief?.targetUser === '待补充';
    const ownerId = current.ownerId ?? get().account?.id ?? 'local-guest';
    if (current.industrial && !staleLocalDraft) {
      const hydratedIndustrial = hydrateIndustrialVisuals(current, current.industrial);
      const hydratedCoverImage = current.coverImage ?? hydratedIndustrial.conceptCandidates?.find((item) => item.image)?.image ?? null;
      const originalBrief = current.originalBrief ?? createOriginalBriefSnapshot({ project: current, sourceBrief });
      const generatedOverview = createProjectOverview({ project: { ...current, originalBrief }, sourceBrief, industrial: hydratedIndustrial });
      const overviewNeedsV21 = !current.projectOverview?.expectedOutcomes || !current.projectOverview?.outcomeDefinition || !current.projectOverview?.designConstants || !current.projectOverview?.designExclusions;
      const projectOverview = overviewNeedsV21
        ? mergeOverviewKeepingEdits(generatedOverview, { ...current, projectOverview: current.projectOverview })
        : current.projectOverview;
      const generatedDesignBrief = createDesignBrief({ project: { ...current, originalBrief }, sourceBrief, industrial: hydratedIndustrial, projectOverview });
      const briefNeedsV2Migration = !current.designBrief || current.designBrief.domain?.primary === 'uiux' && current.productDiscipline === 'industrial';
      const designBrief = briefNeedsV2Migration
        ? { ...generatedDesignBrief, status: current.industrial?.briefConfirmed ? 'confirmed' : 'draft', confirmedAt: current.industrial?.briefConfirmed ? (current.briefConfirmedAt ?? current.updatedAt ?? now()) : null }
        : completeCoreTension(current.designBrief);
      const syncedIndustrial = briefNeedsV2Migration ? syncIndustrialBriefFromDesignBrief(hydratedIndustrial, designBrief) : hydratedIndustrial;
      const overviewFields = {
        originalBrief,
        projectOverview,
        overviewVersion: current.overviewVersion ?? 1,
        lastOverviewGeneratedAt: current.lastOverviewGeneratedAt ?? now(),
        overviewUserEditedFields: current.overviewUserEditedFields ?? [],
        overviewStale: current.overviewStale ?? false,
        ...((current.isDraft || current.projectUnderstandingStatus !== undefined) ? {
          projectUnderstandingStatus: current.projectUnderstandingStatus ?? 'idle',
          projectUnderstandingError: current.projectUnderstandingError ?? null,
          projectUnderstandingSource: current.projectUnderstandingSource ?? 'local',
          projectUnderstandingVersion: current.projectUnderstandingVersion ?? 0,
          projectUnderstandingCurrentVersionId: current.projectUnderstandingCurrentVersionId ?? null,
          projectUnderstandingVersions: current.projectUnderstandingVersions ?? [],
          projectUnderstandingConfirmedAt: current.projectUnderstandingConfirmedAt ?? null,
        } : {}),
      };
      if (!overviewNeedsV21 && !briefNeedsV2Migration && hydratedIndustrial === current.industrial && syncedIndustrial === hydratedIndustrial && hydratedCoverImage === current.coverImage && designBrief === current.designBrief && current.ownerId === ownerId
        && current.originalBrief && current.projectOverview && current.designBrief) return current;
      const hydrated = { ...current, ownerId, ownerScope: ownerId === get().account?.id ? 'user' : 'starter', industrial: syncedIndustrial, designBrief, briefStatus: designBrief.status, briefConfirmedAt: designBrief.confirmedAt ?? null, briefVersion: current.briefVersion ?? 1, coverImage: hydratedCoverImage, ...overviewFields, updatedAt: now() };
      await db.projects.put(hydrated);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? hydrated : item) }));
      return hydrated;
    }
    const industrial = hydrateIndustrialVisuals(current, createIndustrialDraftState({ project: current, sourceBrief }));
    const originalBrief = current.originalBrief ?? createOriginalBriefSnapshot({ project: current, sourceBrief });
    const projectOverview = current.projectOverview ?? createProjectOverview({ project: { ...current, originalBrief }, sourceBrief, industrial });
    const designBrief = createDesignBrief({ project: { ...current, originalBrief }, sourceBrief, industrial });
    const syncedIndustrial = syncIndustrialBriefFromDesignBrief(industrial, designBrief);
    const next = {
      ...current,
      ownerId,
      ownerScope: ownerId === get().account?.id ? 'user' : 'starter',
      productDiscipline: 'industrial',
      industrial: syncedIndustrial,
      designBrief,
      briefStatus: designBrief.status,
      briefConfirmedAt: null,
      briefVersion: 1,
      originalBrief,
      projectOverview,
      overviewVersion: current.overviewVersion ?? 1,
      lastOverviewGeneratedAt: current.lastOverviewGeneratedAt ?? now(),
      overviewUserEditedFields: current.overviewUserEditedFields ?? [],
      overviewStale: current.overviewStale ?? false,
      projectUnderstandingStatus: current.projectUnderstandingStatus ?? 'idle',
      projectUnderstandingError: current.projectUnderstandingError ?? null,
      projectUnderstandingSource: current.projectUnderstandingSource ?? 'local',
      projectUnderstandingVersion: current.projectUnderstandingVersion ?? 0,
      projectUnderstandingCurrentVersionId: current.projectUnderstandingCurrentVersionId ?? null,
      projectUnderstandingVersions: current.projectUnderstandingVersions ?? [],
      projectUnderstandingConfirmedAt: current.projectUnderstandingConfirmedAt ?? null,
      coverImage: current.coverImage ?? industrial.conceptCandidates?.find((item) => item.image)?.image ?? null,
      stage: 'brief',
      status: 'active',
      progress: 8,
      isDraft: true,
      updatedAt: now(),
    };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.some((item) => item.id === projectId) ? state.projects.map((item) => item.id === projectId ? next : item) : [next, ...state.projects] }));
    return next;
  },

  generateProjectOverview: async (projectId) => {
    let current = get().projects.find((item) => item.id === projectId) ?? await db.projects.get(projectId);
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    // This is a deterministic, local scaffold only. It never calls an AI provider
    // and guarantees that the project can be opened even when the provider is down.
    current = await get().ensureIndustrialProject(projectId);
    const sourceBrief = get().briefs.find((item) => item.projectId === projectId) ?? await db.briefs.where('projectId').equals(projectId).first();
    const originalBrief = current.originalBrief ?? createOriginalBriefSnapshot({ project: current, sourceBrief });
    const running = {
      ...current,
      originalBrief,
      projectUnderstandingStatus: 'running',
      projectUnderstandingError: null,
      updatedAt: now(),
    };
    await db.projects.put(running);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? running : item), aiJob: { status: 'processing', message: '正在理解项目目标、用户、场景、冲突与限制…' } }));
    try {
      const workingProject = { ...running, originalBrief };
      const response = await requestIndustrialStructured({ project: workingProject, purpose: 'overview', instruction: overviewInstruction(workingProject, running.industrial, sourceBrief), schemaHint: industrialSchemaHints.overview });
      const responseIsValid = response?.source === 'live' && response?.ok === true && response?.parsed === true && response?.validation?.success === true;
      if (!responseIsValid) {
        const message = understandingFailureMessage(response);
        const failed = {
          ...running,
          projectUnderstandingStatus: 'error',
          projectUnderstandingError: message,
          // Keep the deterministic local understanding (or the last selected
          // version) visible for manual editing. Nothing is cleared on failure.
          projectUnderstandingSource: running.projectUnderstandingSource ?? 'local',
          updatedAt: now(),
        };
        await db.projects.put(failed);
        set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? failed : item), aiJob: { status: 'failed', errorCode: response?.errorCode, message } }));
        return failed;
      }

      const generated = createProjectOverview({ project: workingProject, sourceBrief, industrial: running.industrial });
      const aiOverview = response.result ?? {};
      const listOrFallback = (key) => Array.isArray(aiOverview[key]) && aiOverview[key].length ? aiOverview[key] : generated[key];
      const candidateOverview = mergeOverviewKeepingEdits(validateProjectOverview({
        ...generated,
        ...aiOverview,
        projectType: listOrFallback('projectType'),
        keywords: listOrFallback('keywords'),
        mustKeep: listOrFallback('mustKeep'),
        mustAvoid: listOrFallback('mustAvoid'),
        deliverables: listOrFallback('deliverables'),
        successCriteria: listOrFallback('successCriteria'),
        openQuestions: listOrFallback('openQuestions'),
        coreConflict: { ...generated.coreConflict, ...(aiOverview.coreConflict ?? {}) },
        targetUser: { ...generated.targetUser, ...(aiOverview.targetUser ?? {}) },
      }), running);
      const candidateBrief = createDesignBrief({ project: workingProject, sourceBrief, industrial: running.industrial, projectOverview: candidateOverview });
      const appended = appendUnderstandingVersion(running, { source: 'live', projectOverview: candidateOverview, designBrief: candidateBrief });
      // The first candidate becomes current automatically. Regenerations are
      // candidates until the user explicitly chooses “设为当前版本”.
      const shouldAdopt = !running.projectUnderstandingCurrentVersionId && running.projectUnderstandingSource !== 'user';
      const timestamp = now();
      const selectedOverview = shouldAdopt ? candidateOverview : running.projectOverview;
      const selectedBrief = shouldAdopt ? candidateBrief : running.designBrief;
      const selectedVersionId = shouldAdopt ? appended.version.id : running.projectUnderstandingCurrentVersionId;
      const next = {
        ...running,
        originalBrief,
        projectOverview: selectedOverview,
        designBrief: selectedBrief,
        briefStatus: selectedBrief?.status ?? 'draft',
        briefConfirmedAt: shouldAdopt ? null : running.briefConfirmedAt ?? null,
        projectUnderstandingStatus: 'success',
        projectUnderstandingError: null,
        projectUnderstandingSource: shouldAdopt ? 'live' : running.projectUnderstandingSource ?? 'live',
        projectUnderstandingVersion: appended.version.version,
        projectUnderstandingCurrentVersionId: selectedVersionId,
        projectUnderstandingVersions: appended.versions,
        overviewVersion: (running.overviewVersion ?? 0) + 1,
        lastOverviewGeneratedAt: timestamp,
        overviewGenerationMeta: { source: 'live', provider: response.trace?.providerId, model: response.trace?.model, httpStatus: response.trace?.httpStatus, rawContentLength: response.trace?.rawContentLength, parsed: response.trace?.parsed === true, validation: 'success', generatedAt: timestamp },
        overviewStale: false,
        industrial: shouldAdopt && running.industrial
          ? syncIndustrialBriefFromDesignBrief({ ...running.industrial, ai: { ...running.industrial.ai, mode: 'live', lastOperation: 'overview', lastRunId: response.runId, lastModel: response.trace?.model, updatedAt: timestamp } }, candidateBrief)
          : running.industrial ? { ...running.industrial, ai: { ...running.industrial.ai, mode: 'live', lastOperation: 'overview', lastRunId: response.runId, lastModel: response.trace?.model, updatedAt: timestamp } } : running.industrial,
        updatedAt: timestamp,
      };
      await db.projects.put(next);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: shouldAdopt ? '项目理解与设计简报初稿已生成，等待人工确认' : `已生成 V${appended.version.version}，请选择是否设为当前版本` } }));
      return next;
    } catch (error) {
      const message = `项目已创建，但 AI 项目理解暂时生成失败。${localizeThrownAiFailure(error, 'AI 服务暂时不可用，当前项目内容已保存。')}`;
      const failed = { ...running, projectUnderstandingStatus: 'error', projectUnderstandingError: message, updatedAt: now() };
      await db.projects.put(failed);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? failed : item), aiJob: { status: 'failed', errorCode: error?.code, message } }));
      return failed;
    }
  },

  updateProjectOverview: async (projectId, patch) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.projectOverview) throw new Error('PROJECT_OVERVIEW_NOT_FOUND');
    const allowed = Object.fromEntries(Object.entries(patch ?? {}).filter(([key]) => overviewEditableFields.has(key)));
    const normalizedAllowed = { ...allowed };
    if (Array.isArray(allowed.mustKeep)) normalizedAllowed.designConstants = allowed.mustKeep.map((label, index) => ({ id: `${projectId}-overview-constant-edited-${index + 1}`, label, origin: 'explicit', sourceText: label }));
    if (Array.isArray(allowed.mustAvoid)) normalizedAllowed.designExclusions = allowed.mustAvoid.map((label, index) => ({ id: `${projectId}-overview-exclusion-edited-${index + 1}`, label, origin: 'explicit', sourceText: label }));
    if (Array.isArray(allowed.deliverables)) normalizedAllowed.expectedOutcomes = { explicit: allowed.deliverables.map((label, index) => ({ id: `${projectId}-overview-outcome-edited-${index + 1}`, label, category: 'Design Output', origin: 'explicit', sourceText: label })), suggested: current.projectOverview.expectedOutcomes?.suggested ?? [] };
    const projectOverview = validateProjectOverview({ ...current.projectOverview, ...normalizedAllowed });
    const editedFields = [...new Set([...(current.overviewUserEditedFields ?? []), ...Object.keys(normalizedAllowed)])];
    // A user may deliberately complete the project understanding after a live
    // run failed. That is a valid human-authored branch, but an error state may
    // never be silently confirmed as if it were a successful AI result.
    const next = { ...current, projectOverview, overviewUserEditedFields: editedFields, projectUnderstandingStatus: 'success', projectUnderstandingError: null, projectUnderstandingSource: 'user', projectUnderstandingConfirmedAt: null, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  confirmProjectUnderstanding: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.projectOverview || !current.designBrief) throw new Error('PROJECT_UNDERSTANDING_NOT_READY');
    if (current.projectUnderstandingStatus === 'error') throw new Error('PROJECT_UNDERSTANDING_FAILED');
    if (current.projectUnderstandingStatus === 'running' || current.projectUnderstandingStatus === 'queued') throw new Error('PROJECT_UNDERSTANDING_NOT_READY');
    if (current.projectUnderstandingSource !== 'live' && current.projectUnderstandingSource !== 'user') throw new Error('PROJECT_UNDERSTANDING_NOT_READY');
    const timestamp = now();
    const next = {
      ...current,
      projectUnderstandingConfirmedAt: timestamp,
      projectUnderstandingStatus: current.projectUnderstandingStatus ?? 'success',
      projectUnderstandingError: null,
      creationReady: true,
      stage: 'brief',
      progress: Math.max(Number(current.progress) || 0, 18),
      isDraft: true,
      updatedAt: timestamp,
    };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: '项目理解已确认，可以继续编辑设计简报' } }));
    return next;
  },

  selectProjectUnderstandingVersion: async (projectId, versionId) => {
    const current = get().projects.find((item) => item.id === projectId);
    const version = current?.projectUnderstandingVersions?.find((item) => item.id === versionId);
    if (!current || !version) throw new Error('PROJECT_UNDERSTANDING_VERSION_NOT_FOUND');
    const industrial = current.industrial && version.designBrief ? syncIndustrialBriefFromDesignBrief(current.industrial, { ...version.designBrief, status: 'draft', confirmedAt: null }) : current.industrial;
    const next = {
      ...current,
      projectOverview: version.projectOverview,
      designBrief: { ...version.designBrief, status: 'draft', confirmedAt: null },
      briefStatus: 'draft',
      briefConfirmedAt: null,
      briefStale: false,
      projectUnderstandingSource: version.source,
      projectUnderstandingCurrentVersionId: version.id,
      projectUnderstandingConfirmedAt: null,
      projectUnderstandingError: null,
      isDraft: true,
      industrial,
      updatedAt: now(),
    };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: `已将 V${version.version} 设为当前版本，请确认后继续` } }));
    return next;
  },

  dismissProjectOverviewStale: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    const next = { ...current, overviewStale: false, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  updateOriginalBrief: async (projectId, patch) => {
    const current = get().projects.find((item) => item.id === projectId);
    const brief = get().briefs.find((item) => item.projectId === projectId) ?? await db.briefs.where('projectId').equals(projectId).first();
    if (!current || !brief) throw new Error('PROJECT_BRIEF_NOT_FOUND');
    const nextBrief = {
      ...brief,
      goal: typeof patch?.designGoal === 'string' ? patch.designGoal.trim() : brief.goal,
      audience: typeof patch?.audience === 'string' ? patch.audience.trim() : brief.audience,
      context: typeof patch?.context === 'string' ? patch.context.trim() : brief.context,
      deliverables: Array.isArray(patch?.deliverables) ? patch.deliverables.filter(Boolean).map(String) : brief.deliverables,
      constraints: Array.isArray(patch?.constraints) ? patch.constraints.filter(Boolean).map(String) : brief.constraints,
      keywords: Array.isArray(patch?.keywords) ? patch.keywords.filter(Boolean).map(String) : brief.keywords,
      avoid: Array.isArray(patch?.avoid) ? patch.avoid.filter(Boolean).map(String) : brief.avoid,
      updatedAt: now(),
    };
    const projectWithBrief = { ...current, ...(patch?.projectName ? { name: patch.projectName.trim() } : {}) };
    const next = {
      ...projectWithBrief,
      originalBrief: createOriginalBriefSnapshot({ project: projectWithBrief, sourceBrief: nextBrief }),
      overviewStale: true,
      projectUnderstandingStatus: 'idle',
      projectUnderstandingError: null,
      projectUnderstandingConfirmedAt: null,
      updatedAt: now(),
    };
    await db.transaction('rw', db.projects, db.briefs, async () => { await db.briefs.put(nextBrief); await db.projects.put(next); });
    set((state) => ({
      projects: state.projects.map((item) => item.id === projectId ? next : item),
      briefs: state.briefs.map((item) => item.id === nextBrief.id ? nextBrief : item),
    }));
    return next;
  },

  prepareIndustrialProject: async (projectId, onStep) => {
    await onStep?.('保存原始输入', '正在创建 Project ID，并保存项目名称、命题、用户与场景限制。', 'processing');
    const scaffold = await get().ensureIndustrialProject(projectId);
    await onStep?.('保存原始输入', 'Project ID 与原始 Brief 已保存，AI 请求不会影响项目是否存在。', 'success');
    await onStep?.('生成项目理解', '正在用 Text AI 形成 Project Understanding 与 Design Brief Draft。', 'processing');
    const understood = await get().generateProjectOverview(projectId);
    const understandingFailed = understood?.projectUnderstandingStatus === 'error';
    await onStep?.('生成项目理解', understandingFailed ? 'AI 服务暂时不可用，项目仍已创建，当前内容可以手动完善。' : 'Project Understanding 与 Design Brief Draft 已保存，等待人工确认。', understandingFailed ? 'error' : 'success');
    const current = get().projects.find((item) => item.id === projectId) ?? understood ?? scaffold;
    if (!current) throw new Error('PROJECT_NOT_FOUND');
    const ready = { ...current, creationReady: true, stage: 'brief', progress: Math.max(Number(current.progress) || 0, 18), updatedAt: now() };
    await db.projects.put(ready);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? ready : item) }));
    await onStep?.('准备人工确认', '项目理解可编辑、可重试；确认前不会生成研究、方向或图片。', 'success');
    return ready;
  },

  generateIndustrialBrief: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    set({ aiJob: { status: 'processing', message: '正在整理项目 Brief…' } });
    const response = await requestIndustrialStructured({ project: current, purpose: 'prompt', instruction: designBriefInstruction(current, get().briefs.find((item) => item.projectId === projectId), current.industrial), schemaHint: industrialSchemaHints.brief });
    if (response.source !== 'live') {
      set({ aiJob: { status: 'failed', errorCode: response.errorCode, message: `Brief 生成失败：${localizeAiFailure(response, '已有 Brief 未被覆盖。')}` } });
      return current;
    }
    const sourceBrief = get().briefs.find((item) => item.projectId === projectId);
    const localDraft = createIndustrialDraftState({ project: current, sourceBrief });
    const generatedBrief = createDesignBrief({ project: current, sourceBrief, industrial: current.industrial, projectOverview: current.projectOverview });
    const designBrief = response.result?.coreDesignQuestion ? { ...generatedBrief, ...response.result, status: 'draft', confirmedAt: null } : generatedBrief;
    const nextBrief = response.result?.goal ? mergeIndustrialBrief(current.industrial, response.result).brief : localDraft.brief;
    const industrial = hydrateIndustrialVisuals(current, {
      ...current.industrial,
      brief: nextBrief,
      evidence: localDraft.evidence,
      insights: localDraft.insights,
      directions: localDraft.directions,
      conceptCandidates: localDraft.conceptCandidates,
      cmfSchemes: localDraft.cmfSchemes,
      ai: { ...current.industrial.ai, mode: 'live', lastOperation: 'brief', updatedAt: now() },
    });
    const syncedIndustrial = syncIndustrialBriefFromDesignBrief({ ...industrial, brief: nextBrief }, designBrief);
    const next = { ...current, industrial: syncedIndustrial, designBrief, briefStatus: designBrief.status, briefConfirmedAt: null, briefVersion: current.briefVersion ?? 1, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: '真实 AI 已更新 Brief' } }));
    return next;
  },

  updateDesignBrief: async (projectId, patch) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.designBrief) throw new Error('DESIGN_BRIEF_NOT_FOUND');
    const allowed = Object.fromEntries(Object.entries(patch ?? {}).filter(([key]) => briefEditableFields.has(key)));
    const nextBrief = { ...current.designBrief, ...allowed, status: 'draft', confirmedAt: null };
    const checked = validateDesignBrief(nextBrief, JSON.stringify(current.originalBrief ?? {}));
    if (!checked.ok) throw new Error(`DESIGN_BRIEF_INVALID:${checked.errors.join('、')}`);
    const next = { ...current, designBrief: checked.data, briefStatus: 'draft', briefConfirmedAt: null, briefStale: Boolean(current.briefStatus === 'confirmed'), briefUserEditedFields: [...new Set([...(current.briefUserEditedFields ?? []), ...Object.keys(allowed)])], updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  acceptProjectOutcomeSuggestion: async (projectId, outcomeId, accepted = true) => {
    const current = get().projects.find((item) => item.id === projectId);
    const outcomes = current?.projectOverview?.expectedOutcomes;
    if (!current?.projectOverview || !outcomes) throw new Error('PROJECT_OUTCOMES_NOT_FOUND');
    const suggested = outcomes.suggested.map((item) => item.id === outcomeId ? { ...item, accepted } : item);
    const nextOverview = validateProjectOverview({ ...current.projectOverview, expectedOutcomes: { ...outcomes, suggested } });
    const next = { ...current, projectOverview: nextOverview, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  confirmDesignBrief: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.designBrief) throw new Error('DESIGN_BRIEF_NOT_FOUND');
    const checked = validateDesignBrief({ ...current.designBrief, status: 'confirmed', confirmedAt: now() }, JSON.stringify(current.originalBrief ?? {}));
    if (!checked.ok) throw new Error(`DESIGN_BRIEF_INVALID:${checked.errors.join('、')}`);
    const timestamp = checked.data.confirmedAt ?? now();
    const industrial = syncIndustrialBriefFromDesignBrief(current.industrial, checked.data);
    const next = { ...current, designBrief: checked.data, briefStatus: 'confirmed', briefConfirmedAt: timestamp, briefStale: false, industrial: { ...industrial, briefConfirmed: true }, stage: 'research', status: 'active', progress: Math.max(Number(current.progress) || 0, 18), isDraft: false, updatedAt: timestamp };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  createDesignBriefVersion: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.designBrief) throw new Error('DESIGN_BRIEF_NOT_FOUND');
    const nextBrief = { ...current.designBrief, status: 'draft', confirmedAt: null };
    const next = { ...current, designBrief: nextBrief, briefStatus: 'draft', briefConfirmedAt: null, briefStale: false, briefVersion: (current.briefVersion ?? 1) + 1, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  generateIndustrialResearchPlan: async (projectId) => {
    let current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    current = await get().ensureResearchWorkspace(projectId);
    const workspace = current.researchWorkspace;
    if (!workspace) throw new Error('RESEARCH_WORKSPACE_NOT_FOUND');
    set({ aiJob: { status: 'processing', message: '正在把研究问题转成可执行的检索线索；不会伪造研究事实…' } });
    const response = await requestIndustrialStructured({ project: current, purpose: 'research_plan', instruction: researchPlanInstruction(current, current.industrial), schemaHint: industrialSchemaHints.researchPlan, enableSearch: false });
    const responseIsValid = response?.source === 'live' && response?.ok === true && response?.parsed === true && response?.validation?.success === true;
    if (!responseIsValid) {
      const errorMessage = `研究计划生成失败：${localizeAiFailure(response, '真实 Text AI 暂时不可用，当前研究问题与已有材料未被改写。')}`;
      const failedAssistant = createResearchAssistant({
        ...(workspace.researchAssistant ?? {}),
        status: 'error',
        source: response?.source === 'live' ? 'live' : 'none',
        provider: response?.trace?.providerId ?? workspace.researchAssistant?.provider ?? null,
        model: response?.trace?.model ?? workspace.researchAssistant?.model ?? null,
        errorMessage,
      });
      const failed = persistProjectBrain({ ...current, researchWorkspace: { ...workspace, researchAssistant: failedAssistant }, updatedAt: now() });
      await db.projects.put(failed);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? failed : item), aiJob: { status: 'failed', errorCode: response?.errorCode, message: errorMessage } }));
      return failed;
    }
    const normalized = normalizeResearchAssistantResult(response.result, workspace.questions);
    if (!normalized.questionPlans.length) {
      const errorMessage = '研究计划生成失败：AI 返回的研究问题无法与当前简报对应，已有研究内容未被覆盖。';
      const failedAssistant = createResearchAssistant({ ...(workspace.researchAssistant ?? {}), status: 'error', source: 'live', provider: response.trace?.providerId ?? null, model: response.trace?.model ?? null, errorMessage });
      const failed = persistProjectBrain({ ...current, researchWorkspace: { ...workspace, researchAssistant: failedAssistant }, updatedAt: now() });
      await db.projects.put(failed);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? failed : item), aiJob: { status: 'failed', message: errorMessage } }));
      return failed;
    }
    const timestamp = now();
    const assistant = createResearchAssistant({
      status: normalized.questionPlans.length < workspace.questions.length ? 'partial' : 'success',
      source: 'live',
      provider: response.trace?.providerId,
      model: response.trace?.model,
      runId: response.runId,
      generatedAt: timestamp,
      ...normalized,
      note: '真实 Text AI 只生成检索线索与证据标准；它没有联网，也没有生成或验证任何来源。请打开检索结果，补充 URL 与原文摘录后再采纳。',
    });
    const nextWorkspace = { ...workspace, researchAssistant: assistant };
    const next = persistProjectBrain({ ...current, researchWorkspace: nextWorkspace, updatedAt: timestamp });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: `真实 DeepSeek 已生成 ${assistant.questionPlans.length} 条研究计划；请用线索寻找并确认真实来源。` } }));
    return next;
  },

  generateIndustrialResearch: async (projectId) => {
    let current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    current = await get().ensureResearchWorkspace(projectId);
    const workspace = current.researchWorkspace;
    if (!workspace || !workspace.evidence?.length) {
      set({ aiJob: { status: 'failed', message: '当前没有可解读的研究材料；请先添加带原文的来源。' } });
      return current;
    }
    set({ aiJob: { status: 'processing', message: '正在用 DeepSeek 解读已有研究证据；不会新增外部事实…' } });
    const response = await requestIndustrialStructured({ project: current, purpose: 'research', instruction: researchInstruction(current, current.industrial), schemaHint: industrialSchemaHints.research, enableSearch: false });
    const responseIsValid = response?.source === 'live' && response?.ok === true && response?.parsed === true && response?.validation?.success === true;
    if (!responseIsValid) {
      set({ aiJob: { status: 'failed', errorCode: response?.errorCode, message: `研究解读失败：${localizeAiFailure(response, '研究解读响应未通过真实结构校验。')}` } });
      return current;
    }
    const generatedRows = Array.isArray(response.result?.evidence) ? response.result.evidence : [];
    const existingRows = workspace.evidence ?? [];
    const findGenerated = (item, index) => generatedRows.find((row) => row.id === item.id || (row.sourceId && row.sourceId === item.sourceId) || (row.title && row.title === item.title)) ?? generatedRows[index];
    const mappedCount = existingRows.reduce((count, item, index) => count + (findGenerated(item, index) ? 1 : 0), 0);
    if (!generatedRows.length || mappedCount < Math.min(2, existingRows.length)) {
      set({ aiJob: { status: 'failed', message: '研究解读失败：DeepSeek 没有返回足够的可回溯证据解读，已有材料未被覆盖。' } });
      return current;
    }
    const timestamp = now();
    const evidence = existingRows.map((item, index) => {
      const row = findGenerated(item, index);
      if (!row) return item;
      const interpretation = row.interpretation || row.museInterpretation || item.interpretation;
      return {
        ...item,
        interpretation,
        museInterpretation: row.museInterpretation || interpretation,
        designImplication: row.designImplication || item.designImplication,
        limitation: row.limitation || row.limitations || item.limitation || item.limitations,
        limitations: row.limitation || row.limitations || item.limitations,
        researchAi: { source: 'live', provider: response.trace?.providerId, model: response.trace?.model, updatedAt: timestamp },
        updatedAt: timestamp,
      };
    });
    const nextWorkspace = recomputeResearchWorkspace({ ...workspace, evidence, mode: 'live_interpretation', providerStatus: 'deepseek_ready', researchGenerationMeta: { source: 'live', provider: response.trace?.providerId, model: response.trace?.model, httpStatus: response.trace?.httpStatus, rawContentLength: response.trace?.rawContentLength, parsed: response.trace?.parsed === true, interpretedCount: mappedCount, generatedAt: timestamp } });
    const byId = new Map(evidence.map((item) => [item.id, item]));
    const industrialEvidence = (current.industrial.evidence ?? []).map((item, index) => {
      const updated = byId.get(item.id) ?? evidence.find((candidate) => candidate.sourceId && candidate.sourceId === item.sourceId) ?? evidence[index];
      return updated ? { ...item, interpretation: updated.interpretation, museInterpretation: updated.museInterpretation, designImplication: updated.designImplication, limitation: updated.limitation, limitations: updated.limitations } : item;
    });
    const next = persistProjectBrain({ ...current, researchWorkspace: nextWorkspace, researchGenerationMeta: nextWorkspace.researchGenerationMeta, insightGenerationMeta: null, industrial: { ...current.industrial, evidence: industrialEvidence, ai: { ...current.industrial.ai, mode: 'live', lastOperation: 'research', lastRunId: response.runId, lastModel: response.trace?.model, updatedAt: timestamp } }, updatedAt: timestamp });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: `真实 DeepSeek 已完成研究证据解读（${mappedCount} 条）；来源与采纳状态未被改写。` } }));
    return next;
  },

  generateIndustrialInsights: async (projectId) => {
    let current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    current = await get().ensureResearchWorkspace(projectId);
    const accepted = getAcceptedResearchEvidence(current);
    if (accepted.length < 2) {
      set({ aiJob: { status: 'failed', message: '至少需要 2 条已保留的可追溯证据，才能调用 DeepSeek 生成设计洞察。' } });
      return current;
    }
    set({ aiJob: { status: 'processing', message: '正在基于已保留证据生成设计洞察…' } });
    const response = await requestIndustrialStructured({ project: current, purpose: 'insight', instruction: insightInstruction(current, current.industrial), schemaHint: industrialSchemaHints.insight, enableSearch: false });
    const responseIsValid = response?.source === 'live' && response?.ok === true && response?.parsed === true && response?.validation?.success === true;
    if (!responseIsValid) {
      set({ aiJob: { status: 'failed', errorCode: response?.errorCode, message: `设计洞察生成失败：${localizeAiFailure(response, '设计洞察响应未通过真实结构校验。')}` } });
      return current;
    }
    const acceptedIds = new Set(accepted.map((item) => item.id));
    const existing = current.designInsights ?? [];
    const existingById = new Map(existing.map((item) => [item.id, item]));
    const generated = (response.result?.insights ?? []).map((item, index) => {
      const evidenceIds = [...new Set((item.evidenceIds ?? []).filter((id) => acceptedIds.has(id)))];
      const saved = item.id ? existingById.get(item.id) : existing[index];
      return {
        ...item,
        id: saved?.id ?? item.id ?? `${projectId}-live-insight-${String(index + 1).padStart(2, '0')}`,
        evidenceIds,
        sourceEvidenceIds: evidenceIds,
        evidenceStrength: item.evidenceStrength ?? (evidenceIds.length >= 2 ? 'strong' : 'medium'),
        relatedBriefFields: item.relatedBriefFields ?? [],
        status: saved?.status ?? 'candidate',
        userEdited: saved?.userEdited ?? false,
        evidenceSourceCount: new Set(accepted.filter((evidence) => evidenceIds.includes(evidence.id)).map((evidence) => evidence.sourceName || evidence.sourceId)).size,
      };
    }).filter((item) => item.evidenceIds.length > 0);
    if (generated.length < 2) {
      set({ aiJob: { status: 'failed', message: '设计洞察生成失败：DeepSeek 返回的洞察没有引用至少 2 条已保留证据，已有洞察未被覆盖。' } });
      return current;
    }
    const quality = qualityReviewDesignInsights({ project: current, insights: generated, evidence: accepted });
    if (!quality.ok) {
      set({ aiJob: { status: 'failed', message: `设计洞察生成失败：${quality.errors.slice(0, 3).join('；')}` } });
      return current;
    }
    const confirmedInsightIds = (current.confirmedInsightIds ?? []).filter((id) => generated.some((item) => item.id === id));
    const timestamp = now();
    const nextWorkspace = current.researchWorkspace;
    const industrial = { ...current.industrial, insights: generated, selectedInsightIds: confirmedInsightIds, ai: { ...current.industrial.ai, mode: 'live', lastOperation: 'insight', lastRunId: response.runId, lastModel: response.trace?.model, updatedAt: timestamp } };
    const next = persistProjectBrain({
      ...current,
      industrial,
      designInsights: generated,
      confirmedInsightIds,
      designInsightContextSignature: getDesignInsightContextSignature({ ...current, researchWorkspace: nextWorkspace, designInsights: generated }),
      insightGenerationMeta: { source: 'live', provider: response.trace?.providerId, model: response.trace?.model, httpStatus: response.trace?.httpStatus, rawContentLength: response.trace?.rawContentLength, parsed: response.trace?.parsed === true, generatedCount: generated.length, generatedAt: timestamp },
      updatedAt: timestamp,
    }, { confirmedInsights: generated.filter((item) => confirmedInsightIds.includes(item.id)) });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: `真实 DeepSeek 已生成 ${generated.length} 条设计洞察；引用关系已保存。` } }));
    return next;
  },

  generateIndustrialDirections: async (projectId) => {
    const current = await get().ensureDesignInsights(projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    set({ aiJob: { status: 'processing', message: '正在基于已确认简报、证据与洞察生成设计战略…' } });
    const local = generateDesignDirections(current);
    if (!local.gate?.ready) {
      const next = { ...applyGeneratedDirections(current, local, 'blocked'), updatedAt: now() };
      await db.projects.put(next);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'failed', message: '方向生成已暂停：至少需要 2 条已采纳证据和 1 条已确认洞察。' } }));
      return next;
    }
    const response = await requestIndustrialStructured({ project: current, purpose: 'direction', instruction: directionInstruction(current, current.industrial), schemaHint: industrialSchemaHints.direction });
    if (response.source !== 'live') {
      set({ aiJob: { status: 'failed', errorCode: response.errorCode, message: `方向生成失败：${localizeAiFailure(response, '已有方向与用户选择均已保留。')}` } });
      return current;
    }
    const normalized = normalizeDirectionResponse(current, response.result, local.directions);
    if (normalized.source !== 'live') {
      set({ aiJob: { status: 'failed', message: 'DeepSeek 返回的方向未通过差异与结构校验，已有方向未被覆盖。' } });
      return current;
    }
    const generated = { ...local, directions: normalized.directions, quality: normalized.quality, generationMeta: { ...local.generationMeta, source: 'live-context-validated' } };
    const next = persistProjectBrain({ ...applyGeneratedDirections(current, generated, 'live'), updatedAt: now() });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: '真实 AI 已通过证据与领域校验更新三条方向；方向阶段没有生成图片。' } }));
    return next;
  },

  generateIndustrialConcepts: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    const direction = current?.industrial?.directions.find((item) => item.id === current.industrial.selectedDirectionId);
    if (!current?.industrial || !direction) throw new Error('DIRECTION_NOT_SELECTED');
    set({ aiJob: { status: 'processing', message: '正在围绕当前方向生成产品概念…' } });
    const response = await requestIndustrialStructured({ project: current, purpose: 'concept', instruction: conceptInstruction(current, current.industrial, direction), schemaHint: industrialSchemaHints.concept });
    const parsedConceptCount = Array.isArray(response?.result?.concepts) ? response.result.concepts.length : 0;
    const responseIsValid = response?.source === 'live'
      && response?.ok === true
      && response?.parsed === true
      && response?.validation?.success === true
      && parsedConceptCount >= 2;
    if (!responseIsValid) {
      set({ aiJob: { status: 'failed', errorCode: response?.errorCode, message: `概念生成失败：${localizeAiFailure(response, '概念响应未通过真实结构校验。')}` } });
      return current;
    }
    const industrial = hydrateIndustrialVisuals(current, mergeIndustrialConcepts(current.industrial, response.result));
    // The just-merged result is the new canonical candidate set. Pass it into
    // the brain builder explicitly so an older persisted brain cannot win over
    // a successful live generation during the same transaction.
    const candidateBrain = buildProjectBrain({
      ...current,
      industrial,
      projectBrain: { ...current.projectBrain, conceptCandidates: industrial.conceptCandidates },
    });
    const generationMeta = {
      'HTTP status': response.trace?.httpStatus ?? 0,
      provider: response.trace?.providerId ?? 'unknown',
      model: response.trace?.model ?? 'unknown',
      rawContentLength: response.trace?.rawContentLength ?? 0,
      parsedConceptCount,
      validationResult: 'success',
      contentOrigin: 'real_ai',
    };
    const next = {
      ...current,
      industrial,
      projectBrain: { ...candidateBrain, conceptGeneration: generationMeta },
      updatedAt: now(),
    };
    await db.projects.put(next);
    const persisted = await db.projects.get(projectId);
    const persistedConceptCount = persisted?.projectBrain?.conceptCandidates?.length ?? 0;
    console.info('[ConceptGeneration]', JSON.stringify({
      stage: 'persistence',
      'HTTP status': generationMeta['HTTP status'],
      provider: generationMeta.provider,
      model: generationMeta.model,
      rawContentLength: generationMeta.rawContentLength,
      parsedConceptCount,
      validationResult: generationMeta.validationResult,
      persistedConceptCount,
      renderedConceptCount: 0,
    }));
    const persistenceSuccess = persistedConceptCount >= 2;
    if (!persistenceSuccess) {
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'failed', message: '概念生成失败：真实 AI 结果未能持久化到 ProjectBrain。' } }));
      return next;
    }
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: '真实 AI 已更新产品概念' } }));
    return next;
  },

  generateIndustrialCmf: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    const concept = current?.industrial?.conceptCandidates.find((item) => item.id === current.industrial.selectedConceptId);
    if (!current?.industrial || !concept) throw new Error('CONCEPT_NOT_SELECTED');
    set({ aiJob: { status: 'processing', message: '正在生成材料、颜色与表面处理决策…' } });
    const response = await requestIndustrialStructured({ project: current, purpose: 'moodboard', instruction: cmfInstruction(current, current.industrial, concept), schemaHint: industrialSchemaHints.cmf });
    if (response.source !== 'live') {
      set({ aiJob: { status: 'failed', errorCode: response.errorCode, message: `材料方案生成失败：${localizeAiFailure(response, '已有材料方案已保留，没有生成本地替代方案。')}` } });
      return current;
    }
    let industrial = hydrateIndustrialVisuals(current, mergeIndustrialCmf(current.industrial, response.result));
    let next = persistProjectBrain({ ...current, industrial, updatedAt: now() });
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: '真实 DeepSeek 已更新 CMF 决策；本阶段不调用图片 AI。' } }));
    return next;
  },

  generateIndustrialConceptImage: async (projectId, conceptId) => {
    const current = get().projects.find((item) => item.id === projectId);
    const industrial = current?.industrial;
    const concept = industrial?.conceptCandidates.find((item) => item.id === conceptId);
    const direction = industrial?.directions.find((item) => item.id === concept?.directionId);
    if (!current || !industrial || !concept || !direction) throw new Error('CONCEPT_NOT_FOUND');
    if (industrial.selectedConceptId !== conceptId) throw new Error('CONCEPT_MUST_BE_SELECTED_BEFORE_IMAGE_GENERATION');
    if (isDemoPortfolioProject(current) || industrial.demoPortfolioReady) {
      set({ aiJob: { status: 'processing', message: `正在准备“${concept.name}”对应的 Demo Visual 资产…` } });
      const demoResult = DemoVisualProvider.generateVisual({ project: current, conceptId });
      if (!demoResult.ok) {
        set({ aiJob: { status: 'failed', message: '概念文字已保留，但当前概念没有对应的视觉演示资产；不会用其他项目图片替代。' } });
        return [];
      }
      const demoVisuals = [...ensureDemoVisuals(current, industrial), ...demoResult.visuals].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
      const nextIndustrial = {
        ...industrial,
        demoVisuals,
        generatedVisuals: [...(industrial.generatedVisuals ?? []), ...demoVisuals].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index),
        visualMode: 'demo-asset',
        ai: { ...industrial.ai, mode: 'demo-visual', lastOperation: 'demo-visual', updatedAt: now() },
      };
      const next = { ...current, industrial: nextIndustrial, updatedAt: now() };
      await db.projects.put(next);
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), aiJob: { status: 'success', message: `已准备 ${demoResult.visuals.length} 张与“${concept.name}”对应的 Demo Visual。` } }));
      return demoResult.visuals;
    }
    set({ aiJob: { status: 'processing', message: `正在把“${concept.name}”转译为视觉生成简报…` } });
    const briefResponse = await requestIndustrialStructured({ project: current, purpose: 'visual_brief', instruction: visualBriefInstruction(current, industrial, direction, concept), schemaHint: industrialSchemaHints.visualBrief });
    if (briefResponse.source !== 'live' || !briefResponse.result) {
      set({ aiJob: { status: 'failed', message: 'Visual Brief 未生成：请先在设置中启用 DeepSeek Text AI。Muse 不会用模板提示词冒充真实推理。' } });
      return [];
    }
    const visualBrief = briefResponse.result;
    const domain = buildProjectBrain(current).domain;
    const variations = domain === 'brand-spatial' ? [
      { key: 'hero', label: '空间总览', prompt: 'wide spatial overview showing the complete concept, zones, scale and visitor flow' },
      { key: 'interaction', label: '核心触点', prompt: 'real visitor participation at the core touchpoint, behavior mechanism clearly visible' },
      { key: 'context', label: '路径场景', prompt: 'authentic entry-to-exit journey with surrounding city context and correct human scale' },
      { key: 'detail', label: '材料与光细节', prompt: 'controlled close-up of material, graphic and lighting integration, same exact spatial identity' },
    ] : domain === 'digital' ? [
      { key: 'hero', label: '核心界面', prompt: 'primary product screen showing the central task, clear information hierarchy and realistic content' },
      { key: 'interaction', label: '关键流程', prompt: 'two to three coherent interaction states showing the core user flow without poster decoration' },
      { key: 'context', label: '真实使用场景', prompt: 'authentic device and user context with readable interface scale, product UI remains the focus' },
      { key: 'detail', label: '组件与状态', prompt: 'controlled close-up of components, tokens, states and feedback, same exact interface system' },
    ] : [
      { key: 'hero', label: '主视图', prompt: 'three-quarter hero view, complete product identity and proportions, neutral design review studio' },
      { key: 'interaction', label: '交互视图', prompt: 'real user interaction moment, hands only when structurally necessary, core mechanism clearly visible' },
      { key: 'context', label: '场景视图', prompt: 'authentic use environment with correct scale and surrounding objects, product remains the focal point' },
      { key: 'detail', label: '结构细节', prompt: 'controlled close-up of interface, maintenance boundary and material transitions, same exact product identity' },
    ];
    const visualType = domain === 'brand-spatial' ? 'brand spatial experience design visualization' : domain === 'digital' ? 'digital product interface design visualization' : 'industrial product design visualization';
    const existing = (industrial.generatedVisuals ?? []).filter((item) => item.conceptId === conceptId);
    const generated = [...existing];
    let workingProject = current;
    for (const [index, variation] of variations.entries()) {
      if (generated.some((item) => item.variationKey === variation.key)) continue;
      set({ aiJob: { status: 'processing', message: `正在生成产品图 ${index + 1}/4 · ${variation.label}。页面会等待真实图像返回，不会提前完成。` } });
      const prompt = `High-quality ${visualType}. SUBJECT: ${visualBrief.subject}. SCENE: ${visualBrief.scene}. FORM OR SYSTEM: ${visualBrief.form}. MATERIALS OR VISUAL TOKENS: ${visualBrief.materials}. INTERACTION: ${visualBrief.interaction}. CAMERA OR VIEWPORT: ${visualBrief.camera}. LIGHTING OR CONTRAST: ${visualBrief.lighting}. COMPOSITION: ${visualBrief.composition}. VARIATION: ${variation.prompt}. Preserve one coherent design identity across all four images. No poster layout, no text watermark, no invented logo. Constraints: ${(visualBrief.constraints ?? []).join('; ')}.`;
      const response = await requestIndustrialImage({ project: workingProject, prompt, negativePrompt: visualBrief.negativePrompt });
      if (!response.result?.assetUrl || response.source !== 'live') {
        set({ aiJob: { status: 'failed', message: response.source === 'unavailable' ? 'OpenAI Image AI 尚未在服务端启用；未生成任何伪图片。配置后可继续补齐缺失视图。' : `产品图 ${index + 1}/4 生成失败，已保留前面成功的真实图片，可重试补齐。` } });
        break;
      }
      const quality = await validateIndustrialImage(response.result.assetUrl);
      if (!quality.ok) {
        set({ aiJob: { status: 'failed', message: `产品图 ${index + 1}/4 未达到质量门槛：${quality.reason === 'low-resolution' ? `分辨率仅 ${quality.width}×${quality.height}` : '图片无法稳定加载'}。` } });
        break;
      }
      if (generated.some((item) => item.imageUrl === response.result.assetUrl)) {
        set({ aiJob: { status: 'failed', message: `产品图 ${index + 1}/4 与已有结果重复，已拒绝保存。` } });
        break;
      }
      const timestamp = now();
      const visual = { id: response.result.runId, stage: 'concept', provider: response.result.trace?.providerId ?? 'openai-image', model: response.result.trace?.model ?? 'unknown', generatedAt: timestamp, directionId: direction.id, conceptId, generationBrief: JSON.stringify(visualBrief), variation: variation.label, variationKey: variation.key, imageUrl: response.result.assetUrl, status: 'ready', visualMode: 'real-ai', contentOrigin: 'real_ai' };
      generated.push(visual);
      const allVisuals = [...(workingProject.industrial.generatedVisuals ?? []).filter((item) => item.id !== visual.id), visual];
      const hasVisualVersion = workingProject.industrial.versionStory.some((item) => item.reviewTrigger === '首次真实视觉生成');
      const parentVersion = workingProject.industrial.versionStory.at(-1) ?? null;
      const nextIndustrial = { ...workingProject.industrial, generatedVisuals: allVisuals, visualBrief, conceptCandidates: workingProject.industrial.conceptCandidates.map((item) => item.id === conceptId ? { ...item, image: item.image || visual.imageUrl, imageSource: 'live-ai', imageRunId: item.imageRunId || visual.id, contentOrigin: 'real_ai' } : item), versionStory: hasVisualVersion ? workingProject.industrial.versionStory : [...workingProject.industrial.versionStory, { id: `visual-created-${visual.id}`, number: workingProject.industrial.versionStory.length + 1, parentVersionId: parentVersion?.id ?? null, label: '首轮真实视觉探索', image: visual.imageUrl, whatChanged: '基于已选概念生成第一张可追溯产品视觉。', retained: ['已确认概念与方向规则'], why: '视觉必须继承已确认概念，而不是独立发散。', reviewTrigger: '首次真实视觉生成', nextValidation: ['核对四张视图的产品身份、比例与交互一致性'], contentOrigin: 'real_ai' }], ai: { ...workingProject.industrial.ai, mode: 'live', lastOperation: 'image', lastRunId: visual.id, lastModel: visual.model, updatedAt: timestamp } };
      workingProject = { ...workingProject, industrial: nextIndustrial, coverImage: workingProject.coverImage || visual.imageUrl, updatedAt: timestamp };
      const ownerId = workingProject.ownerId ?? get().account?.id ?? 'local-guest';
      const asset = { id: visual.id, projectId, ownerId, ownerScope: ownerId === get().account?.id ? 'user' : 'starter', name: `${concept.name} / ${variation.label}`, kind: 'image', source: 'ai', url: visual.imageUrl, mimeType: response.result.mimeType, createdAt: timestamp, updatedAt: timestamp, provenance: visual, contentOrigin: 'real_ai' };
      await db.transaction('rw', db.projects, db.assets, async () => { await db.projects.put(workingProject); await db.assets.put(asset); });
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? workingProject : item), assets: [asset, ...state.assets.filter((item) => item.id !== asset.id)] }));
    }
    const complete = generated.filter((item) => variations.some((variation) => variation.key === item.variationKey)).length;
    if (complete === 4) set({ aiJob: { status: 'success', message: '4/4 张真实产品视觉已生成并保存。请选择一张作为 CMF 与评审的视觉基线。' } });
    return generated;
  },

  clearAllLocalData: async () => {
    for (const controller of activeGenerationControllers.values()) {
      controller.abort();
    }
    activeGenerationControllers.clear();
    cancelledGenerationProjects.clear();
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    });
    await ensureLocalAccount(db);
    set({ ...(await loadAll()), aiJob: emptyJob });
    get().pushToast('当前浏览器中的 Muse 数据已清空', 'neutral');
  },

  pushToast: (message, type = 'success') => {
    const id = createId('toast');
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    window.setTimeout(() => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })), 3200);
  },

  createProjectDraft: async (input) => {
    const timestamp = now();
    const project = { id: createId('project'), name: input.name.trim(), stage: 'brief', status: 'active', progress: 8, isDraft: true, createdAt: timestamp, updatedAt: timestamp };
    const brief = { id: createId('brief'), projectId: project.id, requirement: input.requirement.trim(), audience: input.audience.trim(), background: input.background?.trim() ?? '', deliverables: input.deliverables ?? [], constraints: input.constraints ?? [], keywords: input.keywords ?? [], avoid: input.avoid ?? [], opportunities: [], risks: [], questions: [], templateId: input.templateId ?? null, createdAt: timestamp, updatedAt: timestamp };
    await db.transaction('rw', db.projects, db.briefs, async () => { await db.projects.add(project); await db.briefs.add(brief); });
    set((state) => ({ projects: [project, ...state.projects], briefs: [...state.briefs, brief] }));
    return project;
  },

  analyzeBrief: async (projectId) => {
    const project = get().projects.find((item) => item.id === projectId);
    const brief = get().briefs.find((item) => item.projectId === projectId);
    if (!project || !brief) throw new Error('PROJECT_NOT_FOUND');
    set({ aiJob: { status: 'processing', message: '正在理解设计需求' } });
    try {
      const analysis = await organizeProjectBrief({ ...brief, name: project.name }, (message) => set({ aiJob: { status: 'processing', message } }));
      const next = { ...brief, ...analysis, updatedAt: now() };
      await db.briefs.put(next);
      set((state) => ({ briefs: state.briefs.map((item) => item.id === next.id ? next : item), aiJob: { status: 'success', message: '项目简报已整理完成' } }));
      return next;
    } catch (error) {
      set({ aiJob: { status: 'failed', message: '暂时无法整理简报，请检查内容后重试' } });
      throw error;
    }
  },

  updateBrief: async (projectId, patch) => {
    const current = get().briefs.find((item) => item.projectId === projectId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    await db.briefs.put(next);
    set((state) => ({ briefs: state.briefs.map((item) => item.id === next.id ? next : item) }));
    return next;
  },

  confirmProject: async (projectId) => {
    const project = get().projects.find((item) => item.id === projectId);
    if (!project) return null;
    const timestamp = now();
    const next = { ...project, stage: 'research', status: 'active', progress: 18, isDraft: false, updatedAt: timestamp };
    const canvas = { projectId, engine: 'muse', nodes: [], viewport: { x: 0, y: 0, zoom: 1 }, history: [], historyIndex: 0, updatedAt: timestamp };
    await db.transaction('rw', db.projects, db.canvas, async () => { await db.projects.put(next); if (!(await db.canvas.get(projectId))) await db.canvas.put(canvas); });
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item), canvas: state.canvas.some((item) => item.projectId === projectId) ? state.canvas : [...state.canvas, canvas] }));
    return next;
  },

  updateProject: async (projectId, patch) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  applyIndustrialEvent: async (projectId, event) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    const transitionSource = event.type === 'VISUAL_SELECTED'
      ? { ...current.industrial, generatedVisuals: [...(current.industrial.generatedVisuals ?? []), ...(current.industrial.demoVisuals ?? [])] }
      : current.industrial;
    const industrial = transitionIndustrialState(transitionSource, event);
    const next = {
      ...current,
      industrial,
      stage: industrial.currentStage,
      progress: Math.min(96, 12 + (industrial.completedStages?.length ?? 0) * 10),
      isDraft: industrial.briefConfirmed ? false : current.isDraft,
      updatedAt: now(),
    };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  lockDesignDirection: async (projectId, directionId, userReason = '') => {
    const current = await get().ensureDesignDirections(projectId);
    const direction = (current.designDirections ?? current.industrial?.directions ?? []).find((item) => item.id === directionId);
    if (!direction) throw new Error('DIRECTION_NOT_FOUND');
    const insightIds = [...new Set(current.confirmedInsightIds ?? current.industrial?.selectedInsightIds ?? [])];
    if (!insightIds.length) throw new Error('INSIGHT_NOT_SELECTED');
    const acceptedEvidence = getAcceptedResearchEvidence(current);
    if (acceptedEvidence.length < 2) throw new Error('EVIDENCE_MINIMUM_NOT_MET');
    const industrialForTransition = {
      ...current.industrial,
      directions: directionRowsForIndustrial(current, current.designDirections ?? [direction]),
      selectedInsightIds: insightIds,
    };
    const industrial = transitionIndustrialState(industrialForTransition, { type: 'DIRECTION_LOCKED', directionId, at: now() });
    const selected = (current.designDirections ?? []).find((item) => item.id === directionId) ?? direction;
    const timestamp = now();
    const lockedDirection = {
      directionId,
      selectedAt: timestamp,
      userReason: String(userReason ?? '').trim() || undefined,
      thesis: selected.thesis,
      evidenceIds: [...(selected.evidenceIds ?? [])],
      insightIds: [...(selected.insightIds ?? insightIds)],
      designRules: [...(selected.mustKeep ?? [])],
      risks: [...(selected.risks ?? [])],
      validationQuestions: [...(selected.validationQuestions ?? [])],
    };
    const next = { ...current, industrial, lockedDirection, stage: industrial.currentStage, progress: Math.min(96, 12 + (industrial.completedStages?.length ?? 0) * 10), isDraft: false, updatedAt: timestamp };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  runIndustrialReview: async (projectId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial) throw new Error('INDUSTRIAL_PROJECT_NOT_FOUND');
    set({ aiJob: { status: 'processing', message: '正在基于 Brief、证据、方向、概念与 CMF 建立评审上下文' } });
    const direction = current.industrial.directions.find((item) => item.id === current.industrial.selectedDirectionId);
    const concept = current.industrial.conceptCandidates.find((item) => item.id === current.industrial.selectedConceptId);
    const cmf = current.industrial.cmfSchemes.find((item) => item.id === current.industrial.selectedCMFId);
    if (!direction || !concept || !cmf) throw new Error('REVIEW_CONTEXT_INCOMPLETE');
    const fallback = buildDeterministicReview(current.industrial);
    const response = await requestIndustrialStructured({ project: current, purpose: 'review', instruction: reviewInstruction(current, current.industrial, direction, concept, cmf), schemaHint: industrialSchemaHints.review });
    if (response.source !== 'live') {
      set({ aiJob: { status: 'failed', message: response.source === 'unavailable' ? 'DeepSeek Text AI 未连接。没有生成本地评审，也没有改动当前方案。' : '设计评审生成失败，当前方案与已有评审均已保留。' } });
      return { project: current, review: null };
    }
    const review = normalizeIndustrialReview(current.industrial, response.result, fallback);
    review.mode = 'live-ai';
    review.context = { ...review.context, visualInspection: 'metadata-only', visionProvider: null };
    const next = await get().applyIndustrialEvent(projectId, { type: 'REVIEW_CREATED', review });
    set({ aiJob: { status: 'success', message: '评审已生成；结论已标记证据与验证边界' } });
    return { project: next, review };
  },

  setIndustrialReviewIssueDecision: async (projectId, issueId, decision, editedRecommendation) => {
    const current = get().projects.find((item) => item.id === projectId);
    const reviewId = current?.industrial?.currentReviewId;
    if (!current?.industrial || !reviewId) throw new Error('REVIEW_NOT_CREATED');
    const reviews = current.industrial.reviews.map((review) => review.id !== reviewId ? review : { ...review, issues: review.issues.map((issue) => issue.id !== issueId ? issue : { ...issue, decision, recommendation: editedRecommendation?.trim() || issue.recommendation, decidedAt: now() }) });
    const next = { ...current, industrial: { ...current.industrial, reviews }, updatedAt: now() };
    await db.projects.put(next);
    set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? next : item) }));
    return next;
  },

  createIndustrialRevision: async (projectId, issueId) => {
    const current = get().projects.find((item) => item.id === projectId);
    if (!current?.industrial?.currentReviewId) throw new Error('REVIEW_NOT_CREATED');
    const review = current.industrial.reviews.find((item) => item.id === current.industrial.currentReviewId);
    const issue = review?.issues.find((item) => item.id === issueId);
    if (!issue || !['accepted', 'edited'].includes(issue.decision)) { set({ aiJob: { status: 'failed', message: '先接受或编辑这条评审建议，Muse 才会修改图片并创建版本。' } }); return null; }
    const selectedVisual = [...(current.industrial.generatedVisuals ?? []), ...(current.industrial.demoVisuals ?? [])].find((item) => item.id === current.industrial.selectedVisualId);
    if (!selectedVisual) { set({ aiJob: { status: 'failed', message: '当前没有可编辑的真实视觉基线。' } }); return null; }
    set({ aiJob: { status: 'processing', message: '正在用 DeepSeek 解释评审修改与下一版验证目标…' } });
    const versionResponse = await requestIndustrialStructured({ project: current, purpose: 'version', instruction: versionInstruction(current, current.industrial, issue, selectedVisual), schemaHint: industrialSchemaHints.version, enableSearch: false });
    const versionResponseIsValid = versionResponse?.source === 'live' && versionResponse?.ok === true && versionResponse?.parsed === true && versionResponse?.validation?.success === true;
    if (!versionResponseIsValid) {
      const detail = versionResponse?.validation?.error || versionResponse?.error?.message || (versionResponse?.source === 'unavailable' ? 'DeepSeek Text AI 未连接。' : '版本说明未通过真实结构校验。');
      set({ aiJob: { status: 'failed', message: `版本创建失败：${detail}` } });
      return null;
    }
    const versionExplanation = versionResponse.result;
    if (isDemoPortfolioProject(current) || current.industrial.demoPortfolioReady) {
      set({ aiJob: { status: 'processing', message: '正在准备与评审问题对应的 Demo Visual 修订…' } });
      const demoEdit = DemoVisualProvider.editVisual({ project: current, visual: selectedVisual, issue });
      if (!demoEdit.ok || !demoEdit.visual) {
        set({ aiJob: { status: 'failed', message: '评审文字已保留，但当前项目没有对应的 Demo Visual 修订资产。' } });
        return null;
      }
      const timestamp = now();
      const versionId = createId('version');
      const projectVersions = get().versions.filter((item) => item.projectId === projectId);
      const parent = projectVersions.slice().sort((a, b) => b.number - a.number)[0] ?? null;
      const revisedVisual = {
        ...demoEdit.visual,
        id: `demo-revision-${versionId}`,
        projectId,
        stage: 'version',
        variant: `V${Math.max(2, ...current.industrial.versionStory.map((item) => Number(item.number)).filter(Number.isFinite))}`,
        variation: `评审修订 · ${issue.title}`,
        variationKey: `review-demo-${issue.id}`,
        imagePath: demoEdit.visual.imagePath ?? demoEdit.visual.imageUrl ?? demoEdit.visual.image,
        imageUrl: demoEdit.visual.imageUrl ?? demoEdit.visual.imagePath ?? demoEdit.visual.image,
        image: demoEdit.visual.image ?? demoEdit.visual.imagePath ?? demoEdit.visual.imageUrl,
        imageSource: 'demo-asset',
        visualMode: 'demo-asset',
        contentOrigin: 'demo_seed',
        parentVisualId: selectedVisual.id,
        versionId,
        reviewIssueId: issue.id,
        generatedAt: timestamp,
      };
      const transitionSource = { ...current.industrial, generatedVisuals: [...(current.industrial.generatedVisuals ?? []), ...(current.industrial.demoVisuals ?? [])] };
      const transitioned = transitionIndustrialState(transitionSource, { type: 'REVISION_CREATED', issueId, versionId, at: timestamp, image: revisedVisual.imagePath, contentOrigin: 'demo_seed' });
      const demoVisuals = [...(transitioned.demoVisuals ?? []), revisedVisual].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
      const versionStory = transitioned.versionStory.map((item) => item.id === versionId ? { ...item, changeSummary: versionExplanation.changeSummary, whatChanged: versionExplanation.whatChanged, why: versionExplanation.why, reviewTrigger: versionExplanation.reviewTrigger ?? item.reviewTrigger, retained: versionExplanation.retained ?? [], evidenceIds: versionExplanation.evidenceIds ?? [], insightIds: versionExplanation.insightIds ?? [] } : item);
      const nextIndustrial = { ...transitioned, versionStory, demoVisuals, generatedVisuals: [...(transitioned.generatedVisuals ?? []), revisedVisual].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index), selectedVisualId: revisedVisual.id, visualMode: 'demo-asset', versionExplanationMeta: { source: 'live', provider: versionResponse.trace?.providerId, model: versionResponse.trace?.model, runId: versionResponse.runId, generatedAt: timestamp }, ai: { ...transitioned.ai, mode: 'live-text-demo-visual', lastOperation: 'version', lastRunId: versionResponse.runId, lastModel: versionResponse.trace?.model, updatedAt: timestamp } };
      const nextProject = { ...current, industrial: nextIndustrial, coverImage: current.coverImage ?? revisedVisual.imagePath, stage: 'versions', progress: 96, isDraft: false, updatedAt: timestamp };
      const versionNumber = Math.max(0, ...projectVersions.map((item) => Number(item.number)).filter(Number.isFinite), ...current.industrial.versionStory.map((item) => Number(item.number)).filter(Number.isFinite)) + 1;
      const version = {
        id: versionId,
        projectId,
        number: versionNumber,
        parentVersionId: parent?.id ?? null,
        branchId: parent?.branchId ?? 'main',
        changeSummary: versionExplanation.changeSummary ?? `采纳 Review：${issue.recommendation}`,
        snapshot: { ...projectSnapshotFromState(get(), projectId), project: nextProject },
        status: 'saved',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const edge = parent ? { id: createId('version-edge'), projectId, parentVersionId: parent.id, childVersionId: versionId, createdAt: timestamp } : null;
      await db.transaction('rw', db.projects, db.versions, db.versionEdges, async () => {
        await db.projects.put(nextProject);
        await db.versions.add(version);
        if (edge) await db.versionEdges.add(edge);
      });
      set((state) => ({ projects: state.projects.map((item) => item.id === projectId ? nextProject : item), versions: [...state.versions, version], aiJob: { status: 'success', message: '真实 DeepSeek 已完成评审与版本说明；Demo Visual 修订已创建新版本。' } }));
      get().pushToast(`已创建 V${version.number}：评审意见进入下一轮验证`);
      return version;
    }
    const domain = buildProjectBrain(current).domain;
    const identityRule = domain === 'brand-spatial'
      ? 'Preserve the spatial plan, visitor path, core installation, human scale, camera and brand identity.'
      : domain === 'digital'
        ? 'Preserve the information architecture, screen layout, task flow, component hierarchy and product identity.'
        : 'Preserve the product identity, manufacturable geometry, scale, camera, scene and interaction.';
    const revisionVariants = [
      { key: 'direct', label: '直接修订', emphasis: 'Apply the accepted change directly and visibly with the minimum necessary intervention.' },
      { key: 'conservative', label: '克制修订', emphasis: 'Apply a more conservative alternative that solves the same issue while retaining more of the current visual character.' },
    ];
    const edits = [];
    for (const [index, variant] of revisionVariants.entries()) {
      set({ aiJob: { status: 'processing', message: `正在生成评审修订 ${index + 1}/2 · ${variant.label}` } });
      const edited = await requestIndustrialImageEdit({ project: current, stage: 'review', sourceAssetUrls: [selectedVisual.imageUrl], prompt: `Edit the source design only where required by this accepted review issue. ${identityRule} Review finding: ${issue.title}. Evidence: ${issue.evidence}. Accepted change: ${issue.recommendation}. ${variant.emphasis} The result must visibly address the issue without redesigning unrelated decisions. No text watermark, no invented logo, no unrelated objects.` });
      if (edited.source !== 'live' || !edited.result?.assetUrl) { set({ aiJob: { status: 'failed', message: edited.source === 'unavailable' ? 'OpenAI Image AI 未启用，评审决定已保留，但没有伪造新版本图片。' : `评审修订 ${index + 1}/2 失败，当前视觉与评审决定均未被覆盖。` } }); return null; }
      const imageQuality = await validateIndustrialImage(edited.result.assetUrl);
      if (!imageQuality.ok) { set({ aiJob: { status: 'failed', message: `评审修订 ${index + 1}/2 没有通过清晰度与可加载性检查。` } }); return null; }
      if (edits.some((item) => item.result.assetUrl === edited.result.assetUrl)) { set({ aiJob: { status: 'failed', message: '第二张评审修订与第一张重复，已拒绝创建伪差异版本。' } }); return null; }
      edits.push({ ...edited, variant });
    }
    const primaryEdit = edits[0];
    const projectVersions = get().versions.filter((item) => item.projectId === projectId);
    const parent = projectVersions.slice().sort((a, b) => b.number - a.number)[0] ?? null;
    const timestamp = now();
    const versionId = createId('version');
    const industrial = transitionIndustrialState(current.industrial, {
      type: 'REVISION_CREATED', issueId, versionId, at: timestamp, contentOrigin: 'real_ai',
      image: primaryEdit.result.assetUrl,
    });
    const revisedVisuals = edits.map((edited, index) => ({ ...selectedVisual, id: edited.result.runId, stage: 'version', visualMode: 'real-ai', contentOrigin: 'real_ai', parentVisualId: selectedVisual.id, imageUrl: edited.result.assetUrl, provider: edited.result.trace?.providerId ?? selectedVisual.provider, model: edited.result.trace?.model ?? selectedVisual.model, generatedAt: timestamp, variation: `评审编辑 · ${edited.variant.label} · ${issue.title}`, variationKey: `review-${edited.variant.key}`, versionId, reviewIssueId: issue.id, revisionCandidate: index + 1 }));
    const revisedVisual = revisedVisuals[0];
    const versionStory = industrial.versionStory.map((item) => item.id === versionId ? { ...item, changeSummary: versionExplanation.changeSummary, whatChanged: versionExplanation.whatChanged, why: versionExplanation.why, reviewTrigger: versionExplanation.reviewTrigger ?? item.reviewTrigger, retained: versionExplanation.retained ?? [], evidenceIds: versionExplanation.evidenceIds ?? [], insightIds: versionExplanation.insightIds ?? [] } : item);
    const nextIndustrial = { ...industrial, versionStory, versionExplanationMeta: { source: 'live', provider: versionResponse.trace?.providerId, model: versionResponse.trace?.model, runId: versionResponse.runId, generatedAt: timestamp }, generatedVisuals: [...(industrial.generatedVisuals ?? []), ...revisedVisuals], selectedVisualId: revisedVisual.id };
    const nextProject = { ...current, industrial: nextIndustrial, coverImage: revisedVisual.imageUrl, stage: 'versions', progress: 96, isDraft: false, updatedAt: timestamp };
    const version = {
      id: versionId,
      projectId,
      number: Math.max(0, ...projectVersions.map((item) => Number(item.number)).filter(Number.isFinite)) + 1,
      parentVersionId: parent?.id ?? null,
      branchId: parent?.branchId ?? 'main',
      changeSummary: versionExplanation.changeSummary ?? `采纳 Review：${industrial.versionStory.at(-1)?.whatChanged ?? '建立下一轮验证版本'}`,
      snapshot: { ...projectSnapshotFromState(get(), projectId), project: nextProject },
      status: 'saved',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const edge = parent ? {
      id: createId('version-edge'), projectId, parentVersionId: parent.id,
      childVersionId: versionId, createdAt: timestamp,
    } : null;
    const ownerId = current.ownerId ?? get().account?.id ?? 'local-guest';
    const assets = edits.map((edited, index) => ({ id: edited.result.runId, projectId, ownerId, ownerScope: ownerId === get().account?.id ? 'user' : 'starter', name: `评审编辑 / ${edited.variant.label} / ${issue.title}`, kind: 'image', source: 'ai', url: edited.result.assetUrl, mimeType: edited.result.mimeType, createdAt: timestamp, updatedAt: timestamp, provenance: revisedVisuals[index], contentOrigin: 'real_ai' }));
    await db.transaction('rw', db.projects, db.versions, db.versionEdges, db.assets, async () => {
      await db.projects.put(nextProject);
      await db.versions.add(version);
      if (edge) await db.versionEdges.add(edge);
      await db.assets.bulkPut(assets);
    });
    set((state) => ({
      projects: state.projects.map((item) => item.id === projectId ? nextProject : item),
      versions: [...state.versions, version],
      assets: [...assets, ...state.assets.filter((item) => !assets.some((asset) => asset.id === item.id))],
      aiJob: { status: 'success', message: '2/2 张评审修订已完成；直接修订进入新版本，克制修订作为可追溯备选保留。' },
    }));
    get().pushToast(`已创建 V${version.number}：评审意见进入下一轮验证`);
    return version;
  },

  saveCanvas: async (record) => {
    const next = {
      ...record,
      id: record.id || `${record.projectId}-canvas`,
      updatedAt: now(),
    };
    await db.canvas.put(next);
    set((state) => ({
      canvas: [...state.canvas.filter((item) => item.projectId !== next.projectId), next],
    }));
    return next;
  },

  addGlobalAssets: async (records) => {
    if (!records.length) return [];
    const ownerId = get().account?.id ?? 'local-guest';
    const ownedRecords = records.map((record) => ({ ...record, ownerId, ownerScope: 'user', provenance: { type: 'user-upload', label: '我的素材' } }));
    await db.assets.bulkPut(ownedRecords);
    set((state) => ({ assets: [...ownedRecords, ...state.assets] }));
    get().pushToast(`已添加 ${ownedRecords.length} 个素材`);
    return ownedRecords;
  },

  addProjectAssets: async (projectId, records) => {
    const ownerId = get().projects.find((item) => item.id === projectId)?.ownerId ?? get().account?.id ?? 'local-guest';
    const nextRecords = records.map((record) => ({ ...record, projectId, ownerId, ownerScope: ownerId === get().account?.id ? 'user' : 'starter', updatedAt: now() }));
    if (!nextRecords.length) return [];
    await db.assets.bulkPut(nextRecords);
    set((state) => ({ assets: [...nextRecords, ...state.assets] }));
    return nextRecords;
  },

  addResearchItem: async (projectId, input) => {
    const timestamp = now();
    const item = { id: createId('research'), projectId, ...input, evidenceStatus: input.evidenceStatus || 'pending', createdAt: timestamp, updatedAt: timestamp };
    await db.researchItems.add(item);
    set((state) => ({ researchItems: [item, ...state.researchItems] }));
    get().pushToast('研究条目已保存');
    return item;
  },

  updateResearchItem: async (itemId, patch) => {
    const current = get().researchItems.find((item) => item.id === itemId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    await db.researchItems.put(next);
    set((state) => ({ researchItems: state.researchItems.map((item) => item.id === itemId ? next : item) }));
    return next;
  },

  deleteResearchItem: async (itemId) => {
    await db.researchItems.delete(itemId);
    set((state) => ({ researchItems: state.researchItems.filter((item) => item.id !== itemId) }));
    get().pushToast('研究条目已删除', 'neutral');
  },

  addCanvasNode: async (projectId, node) => {
    const current = get().canvas.find((item) => item.projectId === projectId) || { projectId, engine: 'muse', nodes: [], viewport: { x: 0, y: 0, zoom: 1 }, history: [], historyIndex: -1 };
    if (current.nodes.some((item) => item.sourceId && item.sourceId === node.sourceId)) {
      get().pushToast('该内容已经在画布中', 'neutral');
      return current;
    }
    const nextNodes = [...current.nodes, { id: createId('node'), x: 80 + (current.nodes.length % 3) * 300, y: 110 + Math.floor(current.nodes.length / 3) * 210, width: 250, height: 150, ...node }];
    const history = [...(current.history ?? []).slice(0, (current.historyIndex ?? -1) + 1), nextNodes];
    const next = { ...current, nodes: nextNodes, history, historyIndex: history.length - 1, updatedAt: now() };
    await get().saveCanvas(next);
    get().pushToast('已添加到项目画布');
    return next;
  },

  addMoodboardAssets: async (projectId, assetIds) => {
    const existing = get().moodboardItems.filter((item) => item.projectId === projectId);
    const existingIds = new Set(existing.map((item) => item.assetId));
    const freshIds = assetIds.filter((id) => !existingIds.has(id));
    const records = freshIds.map((assetId, index) => ({
      id: createId('mood-item'), projectId, assetId,
      x: (existing.length + index) % 4,
      y: Math.floor((existing.length + index) / 4) * 3,
      w: 3, h: 3, groupId: null, createdAt: now(), updatedAt: now(),
    }));
    if (records.length) await db.moodboardItems.bulkAdd(records);
    set((state) => ({ moodboardItems: [...state.moodboardItems, ...records] }));
    get().pushToast(records.length ? `已加入 ${records.length} 个情绪板素材` : '所选素材已在情绪板中', records.length ? 'success' : 'neutral');
    return records;
  },

  updateMoodboardLayouts: async (projectId, layout) => {
    const projectItems = get().moodboardItems.filter((item) => item.projectId === projectId);
    const byId = new Map(layout.map((item) => [item.i, item]));
    const updates = projectItems.map((item) => {
      const nextLayout = byId.get(item.id);
      return nextLayout ? { ...item, x: nextLayout.x, y: nextLayout.y, w: nextLayout.w, h: nextLayout.h, updatedAt: now() } : item;
    });
    await db.moodboardItems.bulkPut(updates);
    set((state) => ({ moodboardItems: state.moodboardItems.map((item) => updates.find((next) => next.id === item.id) ?? item) }));
  },

  groupMoodboardItems: async (projectId, itemIds) => {
    const groupId = createId('mood-group');
    const updates = get().moodboardItems.filter((item) => item.projectId === projectId && itemIds.includes(item.id)).map((item) => ({ ...item, groupId, updatedAt: now() }));
    if (updates.length < 2) return null;
    await db.moodboardItems.bulkPut(updates);
    set((state) => ({ moodboardItems: state.moodboardItems.map((item) => updates.find((next) => next.id === item.id) ?? item) }));
    get().pushToast(`已将 ${updates.length} 个素材归为一组`);
    return groupId;
  },

  ungroupMoodboardItems: async (itemIds) => {
    const updates = get().moodboardItems.filter((item) => itemIds.includes(item.id)).map((item) => ({ ...item, groupId: null, updatedAt: now() }));
    await db.moodboardItems.bulkPut(updates);
    set((state) => ({ moodboardItems: state.moodboardItems.map((item) => updates.find((next) => next.id === item.id) ?? item) }));
    get().pushToast('已取消分组', 'neutral');
  },

  removeMoodboardItems: async (itemIds) => {
    await db.moodboardItems.bulkDelete(itemIds);
    set((state) => ({ moodboardItems: state.moodboardItems.filter((item) => !itemIds.includes(item.id)) }));
    get().pushToast('已从情绪板移除', 'neutral');
  },

  analyzeMoodboard: async (projectId) => {
    const items = get().moodboardItems.filter((item) => item.projectId === projectId);
    const assetIds = new Set(items.map((item) => item.assetId));
    const assets = get().assets.filter((item) => assetIds.has(item.id));
    if (!assets.length) throw new Error('MOODBOARD_EMPTY');
    set({ aiJob: { status: 'processing', message: '正在读取素材中的色彩与标签' } });
    const colorCounts = new Map(); const tagCounts = new Map();
    assets.forEach((asset) => {
      (asset.colors ?? []).forEach((color) => colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1));
      (asset.tags ?? []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
    });
    const colors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color, count]) => ({ color, count }));
    const keywords = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);
    const timestamp = now();
    const analysis = { id: createId('analysis'), projectId, assetCount: assets.length, colors, keywords, evidence: `${assets.length} 个素材中共识别 ${colorCounts.size} 种主色与 ${tagCounts.size} 个标签。`, createdAt: timestamp, updatedAt: timestamp };
    await db.analyses.add(analysis);
    set((state) => ({ analyses: [...state.analyses, analysis], aiJob: { status: 'success', message: '视觉分析已完成' } }));
    return analysis;
  },

  generateDirections: async (projectId) => {
    const project = get().projects.find((item) => item.id === projectId);
    const brief = get().briefs.find((item) => item.projectId === projectId);
    const analysis = get().analyses.filter((item) => item.projectId === projectId).at(-1);
    if (!project || !brief) throw new Error('PROJECT_NOT_FOUND');
    set({ aiJob: { status: 'processing', message: '正在把研究证据组织为三个可比较方向' } });
    const palettes = analysis?.colors?.map((item) => item.color) ?? ['#D8D0C2', '#889A90', '#303936', '#B78E68', '#EEEAE2'];
    const baseKeywords = [...new Set([...(brief.keywords ?? []), ...(analysis?.keywords ?? [])])];
    const strategies = [
      { name: '方向 A｜证据秩序', concept: '把研究中的核心信息转化为克制、清晰、可信的视觉秩序。', composition: '大面积留白与明确网格', risk: '情绪张力可能偏弱' },
      { name: '方向 B｜情绪张力', concept: '放大情绪板中的色彩与材质反差，形成更强的第一视觉记忆。', composition: '尺度对比与局部突破', risk: '需要控制视觉噪音' },
      { name: '方向 C｜场景叙事', concept: '围绕受众使用场景组织连续画面，让视觉方向具备故事推进感。', composition: '序列化版面与场景切换', risk: '跨媒介一致性需要验证' },
    ];
    const timestamp = now();
    const records = strategies.map((strategy, index) => ({
      id: createId('direction'), projectId, strategyIndex: index + 1, ...strategy,
      keywords: [...baseKeywords.slice(index, index + 4), ['秩序', '张力', '叙事'][index]].filter(Boolean),
      palette: [...palettes.slice(index, index + 4), ...palettes].slice(0, 5),
      typography: ['克制层级与高可读性', '尺度对比与紧凑节奏', '编辑式标题与连续正文'][index],
      imageLanguage: ['客观、精确、材质克制', '近景、冲突、色彩聚焦', '环境、人物关系、连续镜头'][index],
      do: ['保持项目目标可见', '用视觉证据支持风格选择', '让主次层级可以被快速识别'],
      dont: ['只替换颜色而不改变策略', '脱离受众与使用场景', '堆叠无依据的风格标签'],
      lockedAt: null, createdAt: timestamp, updatedAt: timestamp,
    }));
    await db.transaction('rw', db.directions, db.projects, async () => { await db.directions.where('projectId').equals(projectId).delete(); await db.directions.bulkAdd(records); await db.projects.update(projectId, { stage: 'directions', progress: 52, updatedAt: timestamp }); });
    set((state) => ({ directions: [...state.directions.filter((item) => item.projectId !== projectId), ...records], projects: state.projects.map((item) => item.id === projectId ? { ...item, stage: 'directions', progress: 52, updatedAt: timestamp } : item), aiJob: { status: 'success', message: '已生成三个创意方向' } }));
    return records;
  },

  fuseDirections: async (projectId, directionIds) => {
    const selected = get().directions.filter((item) => item.projectId === projectId && directionIds.includes(item.id));
    if (selected.length !== 2) throw new Error('SELECT_TWO_DIRECTIONS');
    const timestamp = now();
    const direction = { id: createId('direction'), projectId, strategyIndex: 4, name: '融合方向｜平衡提案', concept: `${selected[0].concept} 同时吸收“${selected[1].name}”的构图与场景策略。`, composition: `${selected[0].composition} × ${selected[1].composition}`, risk: '融合后需检查核心概念是否仍然单一清晰', keywords: [...new Set([...selected[0].keywords, ...selected[1].keywords])].slice(0, 7), palette: [...new Set([...selected[0].palette, ...selected[1].palette])].slice(0, 5), typography: `${selected[0].typography}；${selected[1].typography}`, imageLanguage: `${selected[0].imageLanguage}；${selected[1].imageLanguage}`, do: [...new Set([...selected[0].do, ...selected[1].do])], dont: [...new Set([...selected[0].dont, ...selected[1].dont])], mergedFrom: directionIds, lockedAt: null, createdAt: timestamp, updatedAt: timestamp };
    await db.directions.add(direction);
    set((state) => ({ directions: [...state.directions, direction] }));
    get().pushToast('已生成融合方向');
    return direction;
  },

  lockDirection: async (projectId, directionId) => {
    const timestamp = now();
    const projectDirections = get().directions.filter((item) => item.projectId === projectId);
    const updates = projectDirections.map((item) => ({ ...item, lockedAt: item.id === directionId ? timestamp : null, updatedAt: timestamp }));
    await db.transaction('rw', db.directions, db.projects, async () => { await db.directions.bulkPut(updates); await db.projects.update(projectId, { stage: 'exploration', progress: 64, updatedAt: timestamp }); });
    set((state) => ({ directions: state.directions.map((item) => updates.find((next) => next.id === item.id) ?? item), projects: state.projects.map((item) => item.id === projectId ? { ...item, stage: 'exploration', progress: 64, updatedAt: timestamp } : item) }));
    get().pushToast('创意方向已锁定');
  },

  saveDirectionToLibrary: async (directionId) => {
    const direction = get().directions.find((item) => item.id === directionId);
    const project = get().projects.find((item) => item.id === direction?.projectId);
    if (!direction || !project) return null;
    const existing = get().directionLibrary.find((item) => item.sourceDirectionId === directionId);
    if (existing) { get().pushToast('该方向已在方向库中', 'neutral'); return existing; }
    const timestamp = now();
    const record = { id: createId('library-direction'), name: direction.name, summary: direction.concept, tags: direction.keywords, palette: direction.palette, sourceProjectId: project.id, sourceProjectName: project.name, sourceDirectionId: direction.id, direction, favorite: false, archived: false, createdAt: timestamp, updatedAt: timestamp };
    await db.directionLibrary.add(record);
    set((state) => ({ directionLibrary: [record, ...state.directionLibrary] }));
    get().pushToast('已保存到方向库');
    return record;
  },

  generateExplorations: async (projectId, directionId, notes = '') => {
    const direction = get().directions.find((item) => item.id === directionId);
    const boardItems = get().moodboardItems.filter((item) => item.projectId === projectId);
    const assetIds = new Set(boardItems.map((item) => item.assetId));
    const sourceAssets = get().assets.filter((item) => assetIds.has(item.id));
    if (!direction?.lockedAt) throw new Error('DIRECTION_NOT_LOCKED');
    if (!sourceAssets.length) throw new Error('NO_VISUAL_SOURCE');
    cancelledGenerationProjects.delete(projectId);
    const providerConfig = get().providerConfigs.find((item) => item.id === 'local-image-provider' && item.enabled && item.workflow);
    const runId = createId('workflow-run');
    let run = createWorkflowRun({ id: runId, projectId, workflowId: 'visual-exploration', provider: providerConfig ? 'local-image' : 'local-preview' });
    run = reduceWorkflowRun(run, { type: 'queued' }); run = reduceWorkflowRun(run, { type: 'node-started', nodeId: 'compose' }); run = reduceWorkflowRun(run, { type: 'progress', value: 45 });
    set({ aiJob: { status: 'processing', message: '正在组织视觉探索候选' }, workflowRuns: [...get().workflowRuns, run] });
    await db.workflowRuns.put(run);
    const timestamp = now();
    const variants = ['主视觉聚焦', '结构与节奏', '场景化延展'];
    let records;
    if (providerConfig) {
      const controller = new AbortController(); activeGenerationControllers.set(projectId, controller);
      const provider = new ComfyUIProvider({ baseUrl: providerConfig.baseUrl });
      try {
        const result = await provider.execute(providerConfig.workflow, { signal: controller.signal, onEvent: (message) => { run = reduceWorkflowRun(run, comfyMessageToWorkflowEvent(message)); db.workflowRuns.put(run); set((state) => ({ workflowRuns: state.workflowRuns.map((item) => item.id === runId ? run : item) })); } });
        const images = Object.values(result.history?.outputs ?? {}).flatMap((output) => output.images ?? []);
        if (!images.length) throw new Error('NO_PROVIDER_OUTPUT');
        records = images.map((image, index) => ({ id: createId('exploration'), projectId, directionId, name: `本机生成候选 ${String(index + 1).padStart(2, '0')}`, prompt: `${direction.concept}；${direction.composition}；${direction.imageLanguage}${notes ? `；本轮要求：${notes}` : ''}`, outputUrl: provider.getImageUrl(image), sourceAssetId: null, provider: 'local-image', status: 'candidate', variantIndex: index + 1, metadata: { filename: image.filename, subfolder: image.subfolder, outputType: image.type, promptId: result.promptId, generationMode: 'local-image' }, createdAt: timestamp, updatedAt: timestamp }));
      } catch (error) {
        run = reduceWorkflowRun(run, error.name === 'AbortError' ? { type: 'cancelled' } : { type: 'failed', error: error.message });
        await db.workflowRuns.put(run); activeGenerationControllers.delete(projectId);
        set((state) => ({ workflowRuns: state.workflowRuns.map((item) => item.id === runId ? run : item), aiJob: { status: 'failed', message: error.name === 'AbortError' ? '本轮视觉探索已取消' : '本地图像服务执行失败，可切换为本地预览后重试' } }));
        throw error;
      }
      activeGenerationControllers.delete(projectId);
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      if (cancelledGenerationProjects.has(projectId)) {
        run = reduceWorkflowRun(run, { type: 'cancelled' }); await db.workflowRuns.put(run);
        set((state) => ({ workflowRuns: state.workflowRuns.map((item) => item.id === runId ? run : item), aiJob: { status: 'failed', message: '本轮视觉探索已取消' } }));
        return [];
      }
      records = variants.map((label, index) => { const asset = sourceAssets[index % sourceAssets.length]; return { id: createId('exploration'), projectId, directionId, name: `${label} ${String(index + 1).padStart(2, '0')}`, prompt: `${direction.concept}；${direction.composition}；${direction.imageLanguage}${notes ? `；本轮要求：${notes}` : ''}`, outputUrl: asset.url, sourceAssetId: asset.id, provider: 'local-preview', status: 'candidate', variantIndex: index + 1, metadata: { sourceAssetName: asset.name, palette: direction.palette, generationMode: 'local-preview' }, createdAt: timestamp, updatedAt: timestamp }; });
    }
    run = reduceWorkflowRun(run, { type: 'progress', value: 100 }); records.forEach((record) => { run = reduceWorkflowRun(run, { type: 'output', output: { explorationId: record.id } }); }); run = reduceWorkflowRun(run, { type: 'completed' });
    await db.transaction('rw', db.explorations, db.workflowRuns, db.projects, async () => { await db.explorations.bulkAdd(records); await db.workflowRuns.put(run); await db.projects.update(projectId, { stage: 'exploration', progress: 72, updatedAt: timestamp }); });
    set((state) => ({ explorations: [...state.explorations, ...records], workflowRuns: state.workflowRuns.map((item) => item.id === runId ? run : item), projects: state.projects.map((item) => item.id === projectId ? { ...item, stage: 'exploration', progress: 72, updatedAt: timestamp } : item), aiJob: { status: 'success', message: '视觉探索候选已生成' } }));
    return records;
  },

  cancelGeneration: async (projectId) => {
    cancelledGenerationProjects.add(projectId);
    activeGenerationControllers.get(projectId)?.abort();
    set({ aiJob: { status: 'failed', message: '正在取消本轮视觉探索' } });
  },

  selectExploration: async (projectId, explorationId) => {
    const projectExplorations = get().explorations.filter((item) => item.projectId === projectId);
    const timestamp = now(); const updates = projectExplorations.map((item) => ({ ...item, status: item.id === explorationId ? 'selected' : item.status === 'selected' ? 'candidate' : item.status, updatedAt: timestamp }));
    await db.transaction('rw', db.explorations, db.projects, async () => { await db.explorations.bulkPut(updates); await db.projects.update(projectId, { stage: 'critique', progress: 82, updatedAt: timestamp }); });
    set((state) => ({ explorations: state.explorations.map((item) => updates.find((next) => next.id === item.id) ?? item), projects: state.projects.map((item) => item.id === projectId ? { ...item, stage: 'critique', progress: 82, updatedAt: timestamp } : item) }));
    get().pushToast('候选方案已送入评审');
  },

  runCritique: async (projectId, explorationId) => {
    const brief = get().briefs.find((item) => item.projectId === projectId);
    const exploration = get().explorations.find((item) => item.id === explorationId);
    const direction = get().directions.find((item) => item.id === exploration?.directionId);
    const analysis = get().analyses.filter((item) => item.projectId === projectId).at(-1);
    if (!brief || !exploration || !direction) throw new Error('CRITIQUE_CONTEXT_MISSING');
    set({ aiJob: { status: 'processing', message: '正在依据项目简报与视觉证据进行评审' } });
    const result = evaluateExploration({ brief, direction, exploration, analysis });
    const timestamp = now(); const critique = { id: createId('critique'), projectId, explorationId, directionId: direction.id, ...result, createdAt: timestamp, updatedAt: timestamp };
    await db.transaction('rw', db.critiques, db.projects, async () => { await db.critiques.add(critique); await db.projects.update(projectId, { stage: 'critique', progress: 88, updatedAt: timestamp }); });
    set((state) => ({ critiques: [...state.critiques, critique], projects: state.projects.map((item) => item.id === projectId ? { ...item, stage: 'critique', progress: 88, updatedAt: timestamp } : item), aiJob: { status: 'success', message: '评审报告已生成' } }));
    return critique;
  },

  createVersion: async (projectId, changeSummary, parentVersionId = null, branchId = null) => {
    const project = get().projects.find((item) => item.id === projectId);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    const projectVersions = get().versions.filter((item) => item.projectId === projectId);
    const parent = parentVersionId ? projectVersions.find((item) => item.id === parentVersionId) : projectVersions.sort((a, b) => b.number - a.number)[0];
    const timestamp = now();
    const version = { id: createId('version'), projectId, number: Math.max(0, ...projectVersions.map((item) => item.number)) + 1, parentVersionId: parent?.id ?? null, branchId: branchId ?? parent?.branchId ?? 'main', changeSummary: changeSummary.trim() || '保存当前项目状态', snapshot: projectSnapshotFromState(get(), projectId), status: 'saved', createdAt: timestamp, updatedAt: timestamp };
    const edge = version.parentVersionId ? { id: createId('version-edge'), projectId, parentVersionId: version.parentVersionId, childVersionId: version.id, createdAt: timestamp } : null;
    await db.transaction('rw', db.versions, db.versionEdges, async () => { await db.versions.add(version); if (edge) await db.versionEdges.add(edge); });
    set((state) => ({ versions: [...state.versions, version] }));
    get().pushToast(`版本 V${version.number} 已保存`);
    return version;
  },

  branchVersion: async (versionId, changeSummary = '从历史版本创建分支') => {
    const source = get().versions.find((item) => item.id === versionId);
    if (!source) return null;
    const projectVersions = get().versions.filter((item) => item.projectId === source.projectId);
    const timestamp = now();
    const version = { ...source, id: createId('version'), number: Math.max(...projectVersions.map((item) => item.number)) + 1, parentVersionId: source.id, branchId: createId('branch'), changeSummary, createdAt: timestamp, updatedAt: timestamp };
    const edge = { id: createId('version-edge'), projectId: source.projectId, parentVersionId: source.id, childVersionId: version.id, createdAt: timestamp };
    await db.transaction('rw', db.versions, db.versionEdges, async () => { await db.versions.add(version); await db.versionEdges.add(edge); });
    set((state) => ({ versions: [...state.versions, version] }));
    get().pushToast(`已从 V${source.number} 创建新分支`);
    return version;
  },

  restoreVersion: async (versionId) => {
    const source = get().versions.find((item) => item.id === versionId);
    if (!source?.snapshot?.project) throw new Error('VERSION_SNAPSHOT_MISSING');
    const projectId = source.projectId;
    const tableMap = { briefs: db.briefs, assets: db.assets, researchItems: db.researchItems, moodboardItems: db.moodboardItems, analyses: db.analyses, directions: db.directions, explorations: db.explorations, critiques: db.critiques, canvas: db.canvas };
    await db.transaction('rw', [db.projects, db.versions, db.versionEdges, ...Object.values(tableMap)], async () => {
      await db.projects.put({ ...source.snapshot.project, updatedAt: now() });
      for (const [key, table] of Object.entries(tableMap)) {
        await table.where('projectId').equals(projectId).delete();
        if (source.snapshot[key]?.length) await table.bulkPut(source.snapshot[key]);
      }
    });
    set({ ...(await loadAll()) });
    const restored = await get().createVersion(projectId, `恢复自 V${source.number}`, source.id, createId('branch'));
    get().pushToast(`已恢复 V${source.number}，历史版本保持不变`);
    return restored;
  },

  savePreference: async (id, value) => {
    const record = { id, value, updatedAt: now() };
    await db.preferences.put(record);
    set((state) => ({ preferences: [...state.preferences.filter((item) => item.id !== id), record] }));
    return record;
  },

  saveLocalAccount: async (patch) => {
    const account = await updateLocalAccount(patch, db);
    set((state) => ({ account, preferences: [...state.preferences.filter((item) => item.id !== LOCAL_ACCOUNT_PREFERENCE), { id: LOCAL_ACCOUNT_PREFERENCE, value: account, updatedAt: account.updatedAt }] }));
    return account;
  },

  cloneAssetToAccount: async (assetId) => {
    const source = get().assets.find((item) => item.id === assetId);
    const ownerId = get().account?.id ?? 'local-guest';
    if (!source || source.ownerId === ownerId) return source ?? null;
    const timestamp = now();
    const copy = { ...source, id: createId('asset'), projectId: null, ownerId, ownerScope: 'user', source: '起始素材复制', provenance: { type: 'starter-copy', sourceAssetId: source.id, label: '来自起始素材库' }, createdAt: timestamp, updatedAt: timestamp };
    await db.assets.put(copy);
    set((state) => ({ assets: [copy, ...state.assets] }));
    get().pushToast('已复制到我的素材库');
    return copy;
  },

  saveProviderConfig: async (input) => {
    const record = { id: 'local-image-provider', kind: 'local-image', enabled: Boolean(input.enabled), baseUrl: input.baseUrl?.trim() || 'http://127.0.0.1:8188', workflow: input.workflow ?? null, updatedAt: now() };
    await db.providerConfigs.put(record);
    set((state) => ({ providerConfigs: [...state.providerConfigs.filter((item) => item.id !== record.id), record] }));
    get().pushToast('本地图像服务设置已保存');
    return record;
  },

  updateAsset: async (assetId, patch) => {
    const current = get().assets.find((item) => item.id === assetId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    await db.assets.put(next);
    set((state) => ({ assets: state.assets.map((item) => item.id === assetId ? next : item) }));
    return next;
  },

  moveAssetToTrash: async (assetId) => {
    const asset = get().assets.find((item) => item.id === assetId);
    if (!asset) return;
    const entry = { id: createId('trash'), entityType: 'asset', entityId: assetId, snapshot: asset, deletedAt: now() };
    await db.transaction('rw', db.assets, db.trash, async () => { await db.assets.delete(assetId); await db.trash.add(entry); });
    set((state) => ({ assets: state.assets.filter((item) => item.id !== assetId), trash: [entry, ...state.trash] }));
    get().pushToast('素材已移到回收站', 'neutral');
  },

  toggleTemplateFavorite: async (templateId) => {
    const existing = get().templateFavorites.find((item) => item.templateId === templateId);
    if (existing) {
      await db.templateFavorites.delete(existing.id);
      set((state) => ({ templateFavorites: state.templateFavorites.filter((item) => item.id !== existing.id) }));
      return false;
    }
    const record = { id: createId('template-favorite'), templateId, updatedAt: now() };
    await db.templateFavorites.add(record);
    set((state) => ({ templateFavorites: [...state.templateFavorites, record] }));
    return true;
  },

  saveProjectAsTemplate: async (projectId) => {
    const project = get().projects.find((item) => item.id === projectId);
    const brief = get().briefs.find((item) => item.projectId === projectId);
    if (!project || !brief) return null;
    const timestamp = now();
    const template = { id: createId('template'), name: `${project.name} 模板`, category: '我的模板', description: '从个人项目保存的通用结构，不包含项目名称和具体需求。', accent: '#9FB2A3', ownerType: 'user', defaults: { deliverables: brief.deliverables ?? [], keywords: brief.keywords ?? [], constraints: brief.constraints ?? [] }, createdAt: timestamp, updatedAt: timestamp };
    await db.templates.add(template);
    set((state) => ({ templates: [template, ...state.templates] }));
    get().pushToast('已保存到“我的模板”');
    return template;
  },

  toggleDirectionFavorite: async (libraryId) => {
    const current = get().directionLibrary.find((item) => item.id === libraryId);
    if (!current) return null;
    const next = { ...current, favorite: !current.favorite, updatedAt: now() };
    await db.directionLibrary.put(next);
    set((state) => ({ directionLibrary: state.directionLibrary.map((item) => item.id === libraryId ? next : item) }));
    return next;
  },

  toggleDirectionArchived: async (libraryId) => {
    const current = get().directionLibrary.find((item) => item.id === libraryId);
    if (!current) return null;
    const next = { ...current, archived: !current.archived, updatedAt: now() };
    await db.directionLibrary.put(next);
    set((state) => ({ directionLibrary: state.directionLibrary.map((item) => item.id === libraryId ? next : item) }));
    return next;
  },

  reuseDirection: async (libraryId, projectId) => {
    const source = get().directionLibrary.find((item) => item.id === libraryId);
    const project = get().projects.find((item) => item.id === projectId);
    if (!source || !project) return null;
    const direction = { ...source.direction, id: createId('direction'), projectId, sourceLibraryId: libraryId, lockedAt: null, updatedAt: now(), createdAt: now() };
    await db.directions.add(direction);
    set((state) => ({ directions: [...state.directions, direction] }));
    get().pushToast(`已复用到“${project.name}”`);
    return direction;
  },

  duplicateProject: async (projectId) => {
    const source = get().projects.find((item) => item.id === projectId);
    const brief = get().briefs.find((item) => item.projectId === projectId);
    if (!source) return null;
    const timestamp = now(); const id = createId('project');
    const project = { ...source, id, name: `${source.name} 副本`, progress: Math.min(source.progress, 25), createdAt: timestamp, updatedAt: timestamp };
    const nextBrief = brief ? { ...brief, id: createId('brief'), projectId: id, createdAt: timestamp, updatedAt: timestamp } : null;
    await db.transaction('rw', db.projects, db.briefs, async () => { await db.projects.add(project); if (nextBrief) await db.briefs.add(nextBrief); });
    set((state) => ({ projects: [project, ...state.projects], briefs: nextBrief ? [...state.briefs, nextBrief] : state.briefs }));
    get().pushToast('项目副本已创建');
    return project;
  },

  moveProjectToTrash: async (projectId) => {
    const project = get().projects.find((item) => item.id === projectId);
    if (!project) return;
    const brief = get().briefs.find((item) => item.projectId === projectId);
    const entry = { id: createId('trash'), entityType: 'project', entityId: projectId, snapshot: { project, brief }, deletedAt: now() };
    await db.transaction('rw', db.projects, db.trash, async () => { await db.projects.delete(projectId); await db.trash.add(entry); });
    set((state) => ({ projects: state.projects.filter((item) => item.id !== projectId), trash: [entry, ...state.trash] }));
    get().pushToast('项目已移到回收站', 'neutral');
  },

  restoreTrashEntry: async (entryId) => {
    const entry = get().trash.find((item) => item.id === entryId);
    if (!entry) return;
    if (entry.entityType === 'project') {
      const { project, brief } = entry.snapshot;
      await db.transaction('rw', db.projects, db.briefs, db.trash, async () => { await db.projects.put(project); if (brief) await db.briefs.put(brief); await db.trash.delete(entryId); });
    } else if (entry.entityType === 'asset') {
      await db.transaction('rw', db.assets, db.trash, async () => { await db.assets.put(entry.snapshot); await db.trash.delete(entryId); });
    }
    set({ ...(await loadAll()) });
    get().pushToast('已从回收站恢复');
  },

  deleteTrashEntry: async (entryId) => {
    const entry = get().trash.find((item) => item.id === entryId);
    if (!entry) return;
    if (entry.entityType === 'project') {
      const projectId = entry.entityId;
      await db.transaction('rw', db.trash, db.briefs, db.assets, db.moodboardItems, db.analyses, db.directions, db.explorations, db.critiques, db.versions, db.canvas, db.researchItems, db.workflowRuns, async () => {
        await Promise.all([
          db.briefs.where('projectId').equals(projectId).delete(),
          db.assets.where('projectId').equals(projectId).delete(),
          db.moodboardItems.where('projectId').equals(projectId).delete(),
          db.analyses.where('projectId').equals(projectId).delete(),
          db.directions.where('projectId').equals(projectId).delete(),
          db.explorations.where('projectId').equals(projectId).delete(),
          db.critiques.where('projectId').equals(projectId).delete(),
          db.versions.where('projectId').equals(projectId).delete(),
          db.canvas.where('projectId').equals(projectId).delete(),
          db.researchItems.where('projectId').equals(projectId).delete(),
          db.workflowRuns.where('projectId').equals(projectId).delete(),
        ]);
        await db.trash.delete(entryId);
      });
    } else {
      await db.trash.delete(entryId);
    }
    set({ ...(await loadAll()) });
    get().pushToast('已永久删除', 'neutral');
  },
}));
