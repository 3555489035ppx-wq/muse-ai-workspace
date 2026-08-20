import type { Project, ProjectBrief } from "../../domain/project/index.js";
import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, createProjectId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { ProjectRepository } from "../../repositories/ProjectRepository.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import type { CreateProjectResult } from "./contracts.js";
import { validateCreateProjectInput } from "./validation.js";

export const PROJECT_CREATION_IDEMPOTENCY_POLICY = "create-new-project-per-submission" as const;

export type ProjectCreationStage = "project_created" | "brief_created" | "workflow_created";

export interface ProjectCreationServiceOptions {
  readonly clock?: RepositoryClock;
  readonly projectIdFactory?: () => ProjectId;
  readonly entityIdFactory?: () => EntityId;
  readonly faultInjector?: (stage: ProjectCreationStage) => void | Promise<void>;
}

interface ProjectWorkflowRecord extends ProjectScopedEntity {
  readonly entityId: EntityId;
  readonly entityType: "Project";
  readonly state: ProjectWorkflowState;
}

export class ProjectCreationService {
  readonly #database: MuseDatabase;
  readonly #projects: ProjectRepository;
  readonly #briefs: BaseRepository<ProjectBrief>;
  readonly #workflowRuns: BaseRepository<ProjectWorkflowRecord>;
  readonly #projectIdFactory: () => ProjectId;
  readonly #entityIdFactory: () => EntityId;
  readonly #faultInjector: ((stage: ProjectCreationStage) => void | Promise<void>) | undefined;

  constructor(database: MuseDatabase, options: ProjectCreationServiceOptions = {}) {
    this.#database = database;
    this.#projects = new ProjectRepository(database, options.clock);
    this.#briefs = new BaseRepository(database.table("briefs"), "ProjectBrief", options.clock);
    this.#workflowRuns = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow", options.clock);
    this.#projectIdFactory = options.projectIdFactory ?? (() => createProjectId());
    this.#entityIdFactory = options.entityIdFactory ?? (() => createEntityId());
    this.#faultInjector = options.faultInjector;
  }

  async create(input: unknown): Promise<CreateProjectResult> {
    const command = validateCreateProjectInput(input);
    const projectId = this.#projectIdFactory();
    const briefId = this.#entityIdFactory();
    const workflowRunId = this.#entityIdFactory();
    const briefConstraints = [
      ...(command.constraints ?? []),
      ...(command.keywords?.length ? [`设计关键词：${command.keywords.join("、")}`] : []),
      ...(command.avoid?.length ? [`避免项：${command.avoid.join("、")}`] : []),
    ].filter(Boolean);
    const projectTable = this.#database.table<Project, EntityId>("projects");
    const briefTable = this.#database.table<ProjectBrief, EntityId>("briefs");
    const workflowTable = this.#database.table<ProjectWorkflowRecord, EntityId>("workflowRuns");

    return runWriteTransaction(this.#database, [projectTable, briefTable, workflowTable], async () => {
      await this.#projects.create({
        id: projectId,
        name: command.name,
        description: command.description,
        isDraft: true,
        type: command.projectType,
        status: "draft",
        stage: "brief",
        outputTypes: command.targetOutputs,
        settings: { locale: "zh-CN", timezone: "Asia/Shanghai" },
        schemaVersion: 4,
        originalBrief: {
          schemaVersion: 1,
          projectName: command.name,
          designGoal: command.description,
          audience: command.audience ?? "待补充",
          context: command.context ?? command.description,
          deliverables: command.deliverables ?? command.targetOutputs,
          constraints: briefConstraints.length ? briefConstraints : ["暂无额外限制"],
          keywords: command.keywords ?? [],
          avoid: command.avoid ?? [],
        },
        projectUnderstandingStatus: "idle",
        projectUnderstandingError: null,
        projectUnderstandingSource: "local",
        projectUnderstandingVersion: 0,
        projectUnderstandingCurrentVersionId: null,
        projectUnderstandingVersions: [],
        projectUnderstandingConfirmedAt: null,
      });
      await this.#faultInjector?.("project_created");

      await this.#briefs.create({
        id: briefId,
        projectId,
        goal: command.description,
        audience: command.audience ?? "待补充",
        context: command.context ?? command.references?.join("\n") ?? command.description,
        deliverables: command.deliverables ?? command.targetOutputs,
        constraints: briefConstraints.length ? briefConstraints : ["暂无额外限制"],
        keywords: command.keywords ?? [],
        avoid: command.avoid ?? [],
      });
      await this.#faultInjector?.("brief_created");

      await this.#workflowRuns.create({
        id: workflowRunId,
        projectId,
        entityId: projectId,
        entityType: "Project",
        state: "DRAFT",
      });
      await this.#faultInjector?.("workflow_created");
      return { projectId, briefId, workflowState: "DRAFT" };
    });
  }
}

export function createProjectCreationService(database: MuseDatabase = getDefaultDatabase()): ProjectCreationService {
  return new ProjectCreationService(database);
}
