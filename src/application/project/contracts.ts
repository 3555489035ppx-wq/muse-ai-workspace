import type { ProjectOutputType, ProjectType } from "../../domain/project/index.js";
import type { EntityId, ProjectId } from "../../domain/shared/id.js";

export interface CreateProjectInput {
  readonly name: string;
  readonly description: string;
  readonly projectType: ProjectType;
  readonly targetOutputs: readonly ProjectOutputType[];
  readonly templateId?: EntityId;
  readonly audience?: string;
  readonly context?: string;
  readonly deliverables?: readonly string[];
  readonly constraints?: readonly string[];
  readonly references?: readonly string[];
  readonly keywords?: readonly string[];
  readonly avoid?: readonly string[];
}

export interface CreateProjectCommand extends CreateProjectInput {}

export interface CreateProjectResult {
  readonly projectId: ProjectId;
  readonly briefId: EntityId;
  readonly workflowState: "DRAFT";
}

export const CREATE_PROJECT_UNKNOWN_FIELD_POLICY = "reject" as const;
