function stripNonGeneratedImage(item) {
  if (!item?.image && item?.imageSource === 'not-generated') return item;
  return { ...item, image: null, imageSource: 'not-generated' };
}

function keepOnlyRealImage(item) {
  if (item?.imageSource === 'demo-asset' || item?.visualMode === 'demo-asset') return item;
  if (!item?.image) return { ...item, image: null, imageSource: 'not-generated' };
  if (item.imageSource === 'live-ai' || item.imageSource === 'live-ai-edit') return item;
  return { ...item, image: null, imageSource: 'not-generated', imageRunId: undefined };
}

/**
 * Runtime migration for pre-V4 projects.
 * Research, insight and direction are decision stages and never render AI
 * imagery. Concept and CMF keep only traceable provider outputs; deterministic
 * SVGs and duplicated seed pictures are removed instead of being "hydrated".
 */
export function hydrateIndustrialVisuals(_project, industrial) {
  if (!industrial) return industrial;
  const conceptCandidates = migrateIndustrialConceptCandidates(industrial);
  const withoutLegacyConcepts = { ...industrial };
  delete withoutLegacyConcepts.concepts;
  return {
    ...withoutLegacyConcepts,
    evidence: (industrial.evidence ?? []).map(stripNonGeneratedImage),
    insights: (industrial.insights ?? []).map(stripNonGeneratedImage),
    directions: (industrial.directions ?? []).map(stripNonGeneratedImage),
    conceptCandidates: conceptCandidates.map((item) => item.imageSource === 'demo-asset' ? item : keepOnlyRealImage(item)),
    cmfSchemes: (industrial.cmfSchemes ?? []).map((item) => item.imageSource === 'demo-asset' ? item : keepOnlyRealImage(item)),
    demoVisuals: Array.isArray(industrial.demoVisuals) ? industrial.demoVisuals.filter((visual) => visual?.projectId === _project?.id || !visual?.projectId) : [],
    generatedVisuals: (industrial.generatedVisuals ?? []).filter((visual) => visual?.imageUrl && visual?.provider && visual?.model),
  };
}
import { migrateIndustrialConceptCandidates } from "../../data/industrialDraft.js";
