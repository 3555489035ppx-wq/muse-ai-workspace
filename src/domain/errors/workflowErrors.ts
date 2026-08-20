import { DomainError } from "./domainError.js";

export class InvalidWorkflowTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super("INVALID_WORKFLOW_TRANSITION", "Workflow transition is not allowed.", {
      from,
      to,
    });
  }
}
