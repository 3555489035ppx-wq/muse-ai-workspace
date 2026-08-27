import { createIndustrialPortfolioSeeds } from "../data/industrialPortfolio.js";
import { enrichDemoProjectSeed, repairDemoIndustrialSelection } from "../data/demoProjectSeed.js";

const timestamp = "2026-08-02T08:00:00.000Z";
const RETIRED_JOURNEY_WATER_PROJECT_ID = "f1000000-0000-4000-8000-000000000102";

async function retireJourneyWaterProject(database) {
  const project = await database.projects.get(RETIRED_JOURNEY_WATER_PROJECT_ID);
  if (!project) return false;

  const brief = await database.briefs.where("projectId").equals(RETIRED_JOURNEY_WATER_PROJECT_ID).first();
  const existingTrashEntry = await database.trash
    .where("entityId")
    .equals(RETIRED_JOURNEY_WATER_PROJECT_ID)
    .filter((item) => item.entityType === "project")
    .first();
  const entry = existingTrashEntry ?? {
    id: "retired-journey-water-project-v2",
    entityType: "project",
    entityId: RETIRED_JOURNEY_WATER_PROJECT_ID,
    snapshot: { project, brief },
    deletedAt: timestamp,
  };

  await database.transaction("rw", database.projects, database.trash, async () => {
    await database.projects.delete(RETIRED_JOURNEY_WATER_PROJECT_ID);
    if (!existingTrashEntry) await database.trash.add(entry);
  });
  return true;
}

function createBrief(project) {
  const brief = project.industrial.brief;
  return {
    id: `brief-${project.id}`,
    projectId: project.id,
    goal: brief.goal,
    requirement: brief.goal,
    target: brief.goal,
    audience: brief.targetUser,
    background: brief.scenario,
    context: brief.scenario,
    deliverables: brief.deliverables,
    constraints: brief.constraints,
    keywords: brief.keyNeeds,
    avoid: brief.unknowns,
    opportunities: project.industrial.insights.map((item) => item.opportunity),
    risks: brief.unknowns,
    questions: ["哪一条结构关系最值得先做 1:1 样机？", "哪些材料与维护结论仍需要工程验证？"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createVersionRecords(project, brief, assets) {
  const stories = project.industrial.versionStory;
  const versions = stories.map((story, index) => ({
    id: story.id,
    projectId: project.id,
    number: story.number,
    parentVersionId: index > 0 ? stories[index - 1].id : null,
    branchId: "main",
    changeSummary: story.label,
    snapshot: {
      project: { ...project, industrial: { ...project.industrial, currentVersionId: story.id } },
      briefs: [brief],
      assets,
      researchItems: [],
      moodboardItems: [],
      analyses: [],
      directions: [],
      explorations: [],
      critiques: [],
      canvas: [],
    },
    status: "saved",
    createdAt: `2026-07-${String(20 + index).padStart(2, "0")}T08:00:00.000Z`,
    updatedAt: `2026-07-${String(20 + index).padStart(2, "0")}T08:00:00.000Z`,
  }));
  const edges = versions.slice(1).map((version, index) => ({
    id: `${project.id}-edge-${index + 1}`,
    projectId: project.id,
    parentVersionId: versions[index].id,
    childVersionId: version.id,
    createdAt: version.createdAt,
  }));
  return { versions, edges };
}

function hasConsistentInsightSelection(project) {
  const selectedIds = project?.confirmedInsightIds ?? project?.industrial?.selectedInsightIds ?? [];
  if (!Array.isArray(selectedIds) || selectedIds.length < 2) return false;
  const confirmedIds = (project?.designInsights ?? [])
    .filter((item) => item?.status === "confirmed" || item?.confirmed === true)
    .map((item) => item.id);
  return confirmedIds.length === selectedIds.length && confirmedIds.every((id) => selectedIds.includes(id));
}

function shouldRefresh(existing, project) {
  const industrial = existing?.industrial;
  const selectedInsightIds = existing?.confirmedInsightIds ?? industrial?.selectedInsightIds ?? [];
  const insightSelectionDrift = Array.isArray(selectedInsightIds)
    && selectedInsightIds.length > 0
    && !hasConsistentInsightSelection(existing);
  return !industrial
    || existing.coverImage !== project.coverImage
    || industrial.schemaVersion !== project.industrial.schemaVersion
    || industrial.evidence?.length !== project.industrial.evidence.length
    || industrial.insights?.length !== project.industrial.insights.length
    || industrial.directions?.length !== project.industrial.directions.length
    || industrial.conceptCandidates?.length !== project.industrial.conceptCandidates.length
    || industrial.cmfSchemes?.length !== project.industrial.cmfSchemes.length
    || industrial.versionStory?.length !== project.industrial.versionStory.length
    || industrial.demoPortfolioReady !== true
    || !industrial.demoVisuals?.length
    || industrial.selectedDirectionId !== project.industrial.selectedDirectionId
    || industrial.selectedConceptId !== project.industrial.selectedConceptId
    || industrial.selectedCMFId !== project.industrial.selectedCMFId
    || industrial.currentReviewId !== project.industrial.currentReviewId
    || industrial.selectedVisualId !== project.industrial.selectedVisualId
    || !existing.designBrief
    || !existing.researchWorkspace
    || existing.researchWorkspace.evidence?.length !== project.industrial.evidence.length
    || !existing.projectOverview?.expectedOutcomes
    || !existing.projectOverview?.outcomeDefinition
    || existing.designInsights?.length < 3
    || existing.confirmedInsightIds?.length < 2
    || insightSelectionDrift;
}

export async function seedIndustrialPortfolio(database) {
  const retired = await retireJourneyWaterProject(database);
  const seeds = createIndustrialPortfolioSeeds();
  const ids = seeds.map(({ project }) => project.id);
  const existingProjects = await database.projects.bulkGet(ids);
  const refreshIndexes = seeds.map(({ project }, index) => shouldRefresh(existingProjects[index], project) ? index : -1).filter((index) => index >= 0);
  if (!refreshIndexes.length) return retired;

  const refreshed = refreshIndexes.map((index) => {
    const seed = seeds[index];
    const current = existingProjects[index];
    const enrichedSeedProject = enrichDemoProjectSeed(seed.project, seed.project.industrial.brief);
    const keepCurrentInsights = hasConsistentInsightSelection(current);
    const industrialSeed = current?.industrial
      ? {
          ...enrichedSeedProject.industrial,
          ...current.industrial,
          brief: enrichedSeedProject.industrial.brief,
          evidence: enrichedSeedProject.industrial.evidence,
          insights: enrichedSeedProject.industrial.insights,
          directions: enrichedSeedProject.industrial.directions,
          conceptCandidates: enrichedSeedProject.industrial.conceptCandidates,
          cmfSchemes: enrichedSeedProject.industrial.cmfSchemes,
          reviews: current.industrial.reviews?.length ? current.industrial.reviews : enrichedSeedProject.industrial.reviews,
          versionStory: enrichedSeedProject.industrial.versionStory,
          demoPortfolioReady: true,
          visualMode: "demo-asset",
          demoVisuals: current.industrial.demoVisuals?.length ? current.industrial.demoVisuals : enrichedSeedProject.industrial.demoVisuals,
          schemaVersion: enrichedSeedProject.industrial.schemaVersion,
        }
      : enrichedSeedProject.industrial;
    const industrial = repairDemoIndustrialSelection(industrialSeed);
    const researchWorkspace = current?.researchWorkspace?.evidence?.length === enrichedSeedProject.researchWorkspace.evidence.length
      ? current.researchWorkspace
      : enrichedSeedProject.researchWorkspace;
    const projectOverview = current?.projectOverview?.expectedOutcomes && current.projectOverview?.outcomeDefinition
      ? current.projectOverview
      : enrichedSeedProject.projectOverview;
    const designBrief = current?.designBrief?.status === "confirmed"
      ? current.designBrief
      : enrichedSeedProject.designBrief;
    const project = current
      ? {
          ...enrichedSeedProject,
          ...current,
          industrial,
          projectOverview,
          designBrief,
          researchWorkspace,
          designInsights: keepCurrentInsights ? current.designInsights : enrichedSeedProject.designInsights,
          confirmedInsightIds: keepCurrentInsights ? current.confirmedInsightIds : enrichedSeedProject.confirmedInsightIds,
          insightGenerationMeta: keepCurrentInsights ? current.insightGenerationMeta : enrichedSeedProject.insightGenerationMeta,
          updatedAt: current.updatedAt,
        }
      : { ...enrichedSeedProject, industrial };
    const brief = createBrief(project);
    const { versions, edges } = createVersionRecords(project, brief, seed.assets);
    const canvas = { projectId: project.id, engine: "muse", nodes: [], viewport: { x: 0, y: 0, zoom: 1 }, history: [], historyIndex: 0, updatedAt: timestamp };
    return { project, brief, assets: seed.assets, versions, edges, canvas };
  });

  await database.transaction(
    "rw",
    database.projects,
    database.briefs,
    database.assets,
    database.versions,
    database.versionEdges,
    database.canvas,
    async () => {
      await database.projects.bulkPut(refreshed.map((item) => item.project));
      await database.briefs.bulkPut(refreshed.map((item) => item.brief));
      await database.assets.bulkPut(refreshed.flatMap((item) => item.assets));
      await database.versions.bulkPut(refreshed.flatMap((item) => item.versions));
      await database.versionEdges.bulkPut(refreshed.flatMap((item) => item.edges));
      await database.canvas.bulkPut(refreshed.map((item) => item.canvas));
    },
  );
  return true;
}
