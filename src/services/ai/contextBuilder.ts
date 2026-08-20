import type { MuseAiStage, ProjectBrain } from "../../domain/project/types.js";

const shared = (brain: ProjectBrain) => ({
  projectId: brain.projectId,
  projectName: brain.projectName,
  domain: brain.domain,
  designBrief: brain.designBrief,
  userLockedFields: brain.userLockedFields,
});

export function buildStageContext(brain: ProjectBrain, stage: MuseAiStage): Readonly<Record<string, unknown>> {
  const base = shared(brain);
  switch (stage) {
    case "research": return { ...base, projectOverview: brain.projectOverview, originalBrief: brain.originalBrief };
    case "insight": return { ...base, acceptedEvidence: brain.acceptedEvidence };
    case "direction": return { ...base, acceptedEvidence: brain.acceptedEvidence, confirmedInsights: brain.confirmedInsights };
    case "concept": return { ...base, acceptedEvidence: brain.acceptedEvidence, confirmedInsights: brain.confirmedInsights, lockedDirection: brain.lockedDirection };
    case "visual": return { ...base, lockedDirection: brain.lockedDirection, selectedConcept: brain.selectedConcept };
    case "cmf": return { ...base, lockedDirection: brain.lockedDirection, selectedConcept: brain.selectedConcept, selectedVisual: brain.selectedVisual };
    case "review": return { ...base, acceptedEvidence: brain.acceptedEvidence, confirmedInsights: brain.confirmedInsights, lockedDirection: brain.lockedDirection, selectedConcept: brain.selectedConcept, selectedVisual: brain.selectedVisual, cmfDecision: brain.cmfDecision };
    case "version": return { ...base, selectedConcept: brain.selectedConcept, selectedVisual: brain.selectedVisual, cmfDecision: brain.cmfDecision, reviewResults: brain.reviewResults, versionEvents: brain.versionEvents };
    case "decision-map": return { ...base, acceptedEvidence: brain.acceptedEvidence, confirmedInsights: brain.confirmedInsights, lockedDirection: brain.lockedDirection, selectedConcept: brain.selectedConcept, selectedVisual: brain.selectedVisual, cmfDecision: brain.cmfDecision, reviewResults: brain.reviewResults, versionEvents: brain.versionEvents, decisions: brain.decisions };
    default: return { ...base, projectOverview: brain.projectOverview, originalBrief: brain.originalBrief };
  }
}

export function serializeStageContext(brain: ProjectBrain, stage: MuseAiStage): string {
  return JSON.stringify(buildStageContext(brain, stage), null, 2);
}
