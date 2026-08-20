import { createJinganbaoSeed, JINGANBAO_PROJECT_ID } from "../data/jinganbao";
import { enrichDemoProjectSeed, repairDemoIndustrialSelection } from "../data/demoProjectSeed.js";

export async function seedJinganbaoDemo(database) {
  const seed = createJinganbaoSeed();
  const enrichedSeedProject = enrichDemoProjectSeed(seed.project, seed.brief);
  const existing = await database.projects.get(JINGANBAO_PROJECT_ID);
  const workspaceNeedsRefresh = (existing?.researchWorkspace?.evidence?.length ?? 0) !== seed.project.industrial.evidence.length;
  const overviewNeedsRefresh = !existing?.projectOverview?.expectedOutcomes || !existing?.projectOverview?.outcomeDefinition;
  const seedIndustrial = seed.project.industrial;
  const selectionNeedsRepair = existing?.industrial?.selectedDirectionId !== seedIndustrial.selectedDirectionId
    || existing?.industrial?.selectedConceptId !== seedIndustrial.selectedConceptId
    || existing?.industrial?.selectedCMFId !== seedIndustrial.selectedCMFId
    || existing?.industrial?.currentReviewId !== seedIndustrial.currentReviewId
    || existing?.industrial?.selectedVisualId !== seedIndustrial.selectedVisualId;
  if (existing?.industrial?.schemaVersion === seed.project.industrial.schemaVersion
    && existing.coverImage === seed.project.coverImage
    && existing.industrial?.demoPortfolioReady === true
    && existing.researchWorkspace
    && existing.designBrief
    && !workspaceNeedsRefresh
    && !overviewNeedsRefresh
    && existing.designInsights?.length >= 3
    && existing.confirmedInsightIds?.length >= 2
    && !selectionNeedsRepair) return false;

  const industrialSeed = existing?.industrial
    ? {
        ...enrichedSeedProject.industrial,
        ...existing.industrial,
        schemaVersion: enrichedSeedProject.industrial.schemaVersion,
        brief: enrichedSeedProject.industrial.brief,
        evidence: enrichedSeedProject.industrial.evidence,
        insights: enrichedSeedProject.industrial.insights,
        directions: enrichedSeedProject.industrial.directions,
        conceptCandidates: enrichedSeedProject.industrial.conceptCandidates,
        cmfSchemes: enrichedSeedProject.industrial.cmfSchemes,
        reviews: existing.industrial.reviews?.length ? existing.industrial.reviews : enrichedSeedProject.industrial.reviews,
        versionStory: enrichedSeedProject.industrial.versionStory,
        demoPortfolioReady: true,
        visualMode: "demo-asset",
        demoVisuals: existing.industrial.demoVisuals?.length ? existing.industrial.demoVisuals : enrichedSeedProject.industrial.demoVisuals,
      }
    : enrichedSeedProject.industrial;
  const industrial = repairDemoIndustrialSelection(industrialSeed);

  const project = existing
    ? {
        ...enrichedSeedProject,
        ...existing,
        industrial,
        designBrief: existing.designBrief ?? enrichedSeedProject.designBrief,
        projectOverview: overviewNeedsRefresh ? enrichedSeedProject.projectOverview : (existing.projectOverview ?? enrichedSeedProject.projectOverview),
        researchWorkspace: workspaceNeedsRefresh ? enrichedSeedProject.researchWorkspace : (existing.researchWorkspace ?? enrichedSeedProject.researchWorkspace),
        designInsights: existing.designInsights?.length >= 3 && existing.confirmedInsightIds?.length >= 2 ? existing.designInsights : enrichedSeedProject.designInsights,
        confirmedInsightIds: existing.confirmedInsightIds?.length >= 2 ? existing.confirmedInsightIds : enrichedSeedProject.confirmedInsightIds,
        insightGenerationMeta: existing.designInsights?.length >= 3 && existing.confirmedInsightIds?.length >= 2 ? existing.insightGenerationMeta : enrichedSeedProject.insightGenerationMeta,
        updatedAt: existing.updatedAt,
      }
    : { ...enrichedSeedProject, industrial };

  const versions = seed.project.industrial.versionStory.map((story, index) => ({
    id: story.id,
    projectId: JINGANBAO_PROJECT_ID,
    number: story.number,
    parentVersionId: index > 0 ? seed.versionIds[index - 1] : null,
    branchId: "main",
    changeSummary: story.label,
    snapshot: {
      project: {
        ...project,
        industrial: { ...project.industrial, currentVersionId: story.id },
      },
      briefs: [seed.brief],
      assets: seed.assets,
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
    id: `f1000000-0000-4000-8000-${String(91 + index).padStart(12, "0")}`,
    projectId: JINGANBAO_PROJECT_ID,
    parentVersionId: versions[index].id,
    childVersionId: version.id,
    createdAt: version.createdAt,
  }));

  await database.transaction(
    "rw",
    database.projects,
    database.briefs,
    database.assets,
    database.versions,
    database.versionEdges,
    async () => {
      await database.projects.put(project);
      await database.briefs.put(seed.brief);
      await database.assets.bulkPut(seed.assets);
      await database.versions.bulkPut(versions);
      await database.versionEdges.bulkPut(edges);
      const legacyAssetIds = await database.assets
        .filter((item) => item.storageKey?.startsWith("demo/phase-2/"))
        .primaryKeys();
      if (legacyAssetIds.length) await database.assets.bulkDelete(legacyAssetIds);
    },
  );
  return true;
}
