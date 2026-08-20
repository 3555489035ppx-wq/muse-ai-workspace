import { createDemoVisualsFromIndustrial, ensureDemoVisuals, DEMO_VISUAL_MODE, visualAssetUrl } from "../../data/demoVisuals.js";

function scoped(project, industrial = project?.industrial) {
  return ensureDemoVisuals(project, industrial).filter((item) => item.projectId === project?.id);
}

function withSelection(project, industrial, selectedConceptId = industrial?.selectedConceptId) {
  const visuals = scoped(project, industrial);
  const missingDirectionVisuals = createDemoVisualsFromIndustrial({
    projectId: project.id,
    industrial,
    directionId: industrial?.selectedDirectionId,
    conceptId: selectedConceptId,
  }).filter((item) => item.conceptId === selectedConceptId);
  const byId = new Map(visuals.map((item) => [item.id, item]));
  missingDirectionVisuals.forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}

export const DemoVisualProvider = Object.freeze({
  mode: DEMO_VISUAL_MODE,

  generateVisual({ project, conceptId } = {}) {
    if (!project?.id || !project?.industrial) return { ok: false, source: "demo", visuals: [], error: "PROJECT_NOT_FOUND" };
    const visuals = withSelection(project, project.industrial, conceptId).filter((item) => item.stage === "concept" && item.conceptId === conceptId);
    if (!visuals.length) return { ok: false, source: "demo", visuals: [], error: "DEMO_VISUAL_ASSET_NOT_FOUND" };
    return { ok: true, source: "demo", visualMode: DEMO_VISUAL_MODE, visuals };
  },

  generateVariation({ project, conceptId, cmfId } = {}) {
    if (!project?.id || !project?.industrial) return { ok: false, source: "demo", visuals: [], error: "PROJECT_NOT_FOUND" };
    const visuals = withSelection(project, project.industrial, conceptId).filter((item) => item.stage === "cmf" && item.conceptId === conceptId && (!cmfId || item.cmfId === cmfId));
    if (!visuals.length) return { ok: false, source: "demo", visuals: [], error: "DEMO_CMF_VISUAL_ASSET_NOT_FOUND" };
    return { ok: true, source: "demo", visualMode: DEMO_VISUAL_MODE, visuals };
  },

  editVisual({ project, visual, issue } = {}) {
    if (!project?.id || !project?.industrial || !visual) return { ok: false, source: "demo", visual: null, error: "VISUAL_NOT_FOUND" };
    const visuals = withSelection(project, project.industrial, visual.conceptId).filter((item) => item.stage === "version" && item.conceptId === visual.conceptId);
    const candidate = visuals.find((item) => item.variant === "V2") || visuals[1] || visuals[0];
    if (!candidate) return { ok: false, source: "demo", visual: null, error: "DEMO_REVISION_ASSET_NOT_FOUND" };
    return {
      ok: true,
      source: "demo",
      visualMode: DEMO_VISUAL_MODE,
      visual: { ...candidate, parentVisualId: visual.id, rationale: `${candidate.rationale} · 评审修订：${issue?.title || "已采纳问题"}` },
    };
  },

  assetUrl(visual) {
    return visualAssetUrl(visual);
  },
});
