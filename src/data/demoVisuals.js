/**
 * V4.2 Demo Visual data contract.
 *
 * Demo visuals are curated project assets, not image-provider output.  Keeping
 * them as a separate record type prevents the UI from labelling a local asset
 * as a paid/live image run while still allowing the same downstream workflow
 * (visual selection -> CMF -> review -> version) to operate on it.
 */

export const DEMO_VISUAL_MODE = "demo-asset";

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const DEMO_PROJECT_IDS = Object.freeze([
  "f1000000-0000-4000-8000-000000000001",
  "f1000000-0000-4000-8000-000000000101",
  "f1000000-0000-4000-8000-000000000103",
  "f1000000-0000-4000-8000-000000000104",
]);

export function isDemoPortfolioProject(project) {
  return Boolean(project?.id && DEMO_PROJECT_IDS.includes(project.id));
}

function demoId(projectId, stage, sourceId, variant) {
  return `demo-visual-${projectId}-${stage}-${sourceId}-${variant}`;
}

function imageOf(record) {
  return record?.imagePath || record?.imageUrl || record?.image || null;
}

function baseVisual({ projectId, stage, sourceId, variant, imagePath, rationale, visualDescription, visualAttributes = {}, directionId, conceptId, cmfId, parentVisualId }) {
  if (!imagePath) return null;
  return {
    id: demoId(projectId, stage, sourceId, variant),
    projectId,
    stage,
    variant,
    variation: variant,
    variationKey: String(variant).toLowerCase(),
    directionId: directionId ?? null,
    conceptId: conceptId ?? null,
    cmfId: cmfId ?? null,
    imagePath,
    imageUrl: imagePath,
    image: imagePath,
    imageSource: DEMO_VISUAL_MODE,
    visualMode: DEMO_VISUAL_MODE,
    contentOrigin: "demo_seed",
    mode: "demo",
    status: "ready",
    rationale: clean(rationale),
    visualDescription: clean(visualDescription),
    visualAttributes,
    parentVisualId: parentVisualId ?? null,
    generatedAt: "2026-08-02T08:00:00.000Z",
  };
}

function conceptVisuals({ projectId, industrial, directionId }) {
  const concepts = (industrial?.conceptCandidates ?? []).filter((item) => !directionId || item.directionId === directionId);
  return concepts.slice(0, 3).map((concept, index) => baseVisual({
    projectId,
    stage: "concept",
    sourceId: concept.id,
    variant: concept.code || String(index + 1),
    imagePath: imageOf(concept),
    directionId: concept.directionId,
    conceptId: concept.id,
    rationale: `Demo asset · ${concept.name} · ${concept.whyFitsDirection || concept.conceptStatement}`,
    visualDescription: `${concept.name}：${concept.conceptStatement || concept.productExpression || "项目概念视觉"}`,
    visualAttributes: {
      form: concept.productExpression || concept.coreMechanism || "与概念候选一致的产品形态",
      interaction: concept.userExperience || "围绕核心任务的使用路径",
      material: industrial?.directions?.find((item) => item.id === concept.directionId)?.cmf || "待 CMF 阶段确认",
    },
  })).filter(Boolean);
}

function cmfVisuals({ projectId, industrial, conceptId, parentVisualId }) {
  return (industrial?.cmfSchemes ?? []).filter((item) => !item.conceptId || !conceptId || item.conceptId === conceptId).slice(0, 3).map((scheme, index) => baseVisual({
    projectId,
    stage: "cmf",
    sourceId: scheme.id,
    variant: scheme.code || String(index + 1),
    imagePath: imageOf(scheme),
    directionId: industrial?.selectedDirectionId,
    conceptId,
    cmfId: scheme.id,
    parentVisualId,
    rationale: `Demo asset · ${scheme.name} · ${scheme.summary}`,
    visualDescription: `${scheme.name}：${scheme.summary || "材料、颜色与表面处理演示"}`,
    visualAttributes: {
      parts: (scheme.parts ?? []).map((part) => ({ part: part.part, material: part.material, color: part.color, finish: part.finish })),
    },
  })).filter(Boolean);
}

function versionVisuals({ projectId, industrial, parentVisualId }) {
  return (industrial?.versionStory ?? []).slice(0, 3).map((version) => baseVisual({
    projectId,
    stage: "version",
    sourceId: version.id,
    variant: `V${version.number}`,
    imagePath: imageOf(version),
    directionId: industrial?.selectedDirectionId,
    conceptId: industrial?.selectedConceptId,
    parentVisualId: version.number > 1 ? parentVisualId : null,
    rationale: `Demo asset · ${version.label} · ${version.whatChanged}`,
    visualDescription: `${version.label}：${version.whatChanged}`,
    visualAttributes: { reviewTrigger: version.reviewTrigger, why: version.why },
  })).filter(Boolean);
}

/**
 * Derive the small, deterministic set of visual assets for the currently
 * selected direction/concept.  The provider can add another direction on
 * demand, but never returns assets from another project or a random fallback.
 */
export function createDemoVisualsFromIndustrial({ projectId, industrial = {}, directionId = industrial.selectedDirectionId, conceptId = industrial.selectedConceptId } = {}) {
  const concepts = conceptVisuals({ projectId, industrial, directionId });
  const selectedConceptVisual = concepts.find((item) => item.conceptId === conceptId) || concepts[0];
  const cmf = cmfVisuals({ projectId, industrial, conceptId: selectedConceptVisual?.conceptId ?? conceptId, parentVisualId: selectedConceptVisual?.id });
  const versions = versionVisuals({ projectId, industrial, parentVisualId: selectedConceptVisual?.id });
  const records = [...concepts, ...cmf, ...versions];
  const seen = new Set();
  return records.filter((record) => {
    const key = `${record.stage}:${record.imagePath}`;
    if (!record.imagePath || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ensureDemoVisuals(project, industrial = project?.industrial) {
  if (!project?.id || !industrial) return [];
  const existing = Array.isArray(industrial.demoVisuals) ? industrial.demoVisuals : [];
  const required = createDemoVisualsFromIndustrial({ projectId: project.id, industrial });
  const byId = new Map(existing.map((item) => [item.id, item]));
  required.forEach((item) => { if (!byId.has(item.id)) byId.set(item.id, item); });
  return [...byId.values()].filter((item) => item.projectId === project.id);
}

export function visualAssetUrl(visual) {
  return imageOf(visual);
}
