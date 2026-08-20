import type { Direction } from "../../domain/direction/index.js";
import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { ProjectWorkflowService } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { DirectionRepository } from "../../repositories/DirectionRepository.js";
import { VersionRepository } from "../../repositories/VersionRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";

interface WorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
export class DirectionCommandError extends Error { constructor(readonly code: "NOT_FOUND" | "PROJECT_SCOPE" | "LOCKED_IMMUTABLE" | "REJECTED_DIRECTION" | "WORKFLOW_CONFLICT", message: string) { super(message); this.name = "DirectionCommandError"; } }
export class DirectionCommandService {
  readonly #database: MuseDatabase; readonly #directions: DirectionRepository; readonly #versions: VersionRepository; readonly #workflows: BaseRepository<WorkflowRecord>; readonly #workflow = new ProjectWorkflowService(); readonly #idFactory: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly clock?: RepositoryClock; readonly entityIdFactory?: () => EntityId } = {}) { this.#database = database; this.#directions = new DirectionRepository(database, options.clock); this.#versions = new VersionRepository(database, options.clock); this.#workflows = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow", options.clock); this.#idFactory = options.entityIdFactory ?? (() => createEntityId()); }
  async #require(projectId: ProjectId, directionId: EntityId): Promise<Direction> { const direction = await this.#directions.getDirection(directionId); if (!direction) throw new DirectionCommandError("NOT_FOUND", "Direction does not exist."); if (direction.projectId !== projectId) throw new DirectionCommandError("PROJECT_SCOPE", "Direction belongs to another project."); return direction; }
  async select(projectId: ProjectId, directionId: EntityId): Promise<Direction> { const direction = await this.#require(projectId, directionId); if (direction.status === "locked") return direction; return this.#directions.updateDirection(directionId, { status: "candidate" }); }
  async reject(projectId: ProjectId, directionId: EntityId): Promise<Direction> { const direction = await this.#require(projectId, directionId); if (direction.status === "locked") throw new DirectionCommandError("LOCKED_IMMUTABLE", "Unlock or switch direction before rejecting it."); return this.#directions.updateDirection(directionId, { status: "rejected" }); }
  async archive(projectId: ProjectId, directionId: EntityId): Promise<Direction> {
    const direction = await this.#require(projectId, directionId); if (direction.status === "locked") throw new DirectionCommandError("LOCKED_IMMUTABLE", "Locked direction cannot be archived.");
    return runWriteTransaction(this.#database, [this.#database.table("projects"), this.#database.table("moodboards"), this.#database.table("visualDna"), this.#database.table("creativeSeeds"), this.#database.table("researchOpportunities"), this.#database.table("directions"), this.#database.table("versionSnapshots")], async () => {
      await this.#versions.create({ id: this.#idFactory(), projectId, entityType: "direction", entityId: direction.id, schemaVersion: 1, label: "direction:archived", snapshot: { ...direction } }); return this.#directions.updateDirection(directionId, { status: "rejected" });
    });
  }
  async lock(projectId: ProjectId, directionId: EntityId): Promise<Direction> {
    const target = await this.#require(projectId, directionId); if (target.status === "rejected") throw new DirectionCommandError("REJECTED_DIRECTION", "Rejected direction cannot be locked.");
    const workflowRecord = await this.#database.table<WorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(projectId).first(); if (!workflowRecord) throw new DirectionCommandError("WORKFLOW_CONFLICT", "Project workflow is missing.");
    const tables = ["moodboards", "visualDna", "creativeSeeds", "researchOpportunities", "directions", "workflowRuns"].map((name) => this.#database.table(name));
    return runWriteTransaction(this.#database, tables, async () => {
      const current = await this.#directions.listDirectionsByProject(projectId); for (const direction of current) if (direction.status === "locked" && direction.id !== directionId) await this.#directions.updateDirection(direction.id, { status: "candidate" });
      if (workflowRecord.state === "DIRECTIONS_READY") await this.#workflows.update(workflowRecord.id, { state: this.#workflow.transition(workflowRecord.state, "LOCKED") }); else if (workflowRecord.state !== "LOCKED") throw new DirectionCommandError("WORKFLOW_CONFLICT", `Cannot lock direction from ${workflowRecord.state}.`);
      return this.#directions.updateDirection(directionId, { status: "locked" });
    });
  }
}
