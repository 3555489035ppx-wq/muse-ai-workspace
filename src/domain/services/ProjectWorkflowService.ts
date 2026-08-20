import { InvalidWorkflowTransitionError } from "../errors/index.js";

export const PROJECT_WORKFLOW_STATES = [
  "DRAFT",
  "RESEARCHING",
  "RESEARCH_READY",
  "MOODBOARD_GENERATING",
  "MOODBOARD_READY",
  "DIRECTIONS_GENERATING",
  "DIRECTIONS_READY",
  "LOCKED",
  "EXPLORING",
  "EXPLORATIONS_READY",
  "PROMPTING",
  "PROMPT_READY",
  "GENERATING",
  "GENERATED",
  "REVIEWING",
  "REVIEWED",
] as const;

export type ProjectWorkflowState = (typeof PROJECT_WORKFLOW_STATES)[number];

const TRANSITIONS: Readonly<Record<ProjectWorkflowState, readonly ProjectWorkflowState[]>> = {
  DRAFT: ["RESEARCHING"],
  RESEARCHING: ["RESEARCH_READY"],
  RESEARCH_READY: ["MOODBOARD_GENERATING"],
  MOODBOARD_GENERATING: ["MOODBOARD_READY"],
  MOODBOARD_READY: ["DIRECTIONS_GENERATING"],
  DIRECTIONS_GENERATING: ["DIRECTIONS_READY"],
  DIRECTIONS_READY: ["LOCKED"],
  LOCKED: ["EXPLORING"],
  EXPLORING: ["EXPLORATIONS_READY"],
  EXPLORATIONS_READY: ["PROMPTING"],
  PROMPTING: ["PROMPT_READY"],
  PROMPT_READY: ["GENERATING"],
  GENERATING: ["GENERATED"],
  GENERATED: ["REVIEWING"],
  REVIEWING: ["REVIEWED"],
  REVIEWED: [],
};

export class ProjectWorkflowService {
  canTransition(from: ProjectWorkflowState, to: ProjectWorkflowState): boolean {
    return TRANSITIONS[from].includes(to);
  }

  transition(from: ProjectWorkflowState, to: ProjectWorkflowState): ProjectWorkflowState {
    if (!this.canTransition(from, to)) throw new InvalidWorkflowTransitionError(from, to);
    return to;
  }

  getAvailableTransitions(from: ProjectWorkflowState): readonly ProjectWorkflowState[] {
    return [...TRANSITIONS[from]];
  }
}
