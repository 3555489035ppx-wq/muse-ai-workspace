import type { Table } from "dexie";
import type { Canvas, CanvasEdge, CanvasNode, CanvasNodeEntityType, CanvasViewport } from "../domain/canvas/index.js";
import { EntityNotFoundError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { Project } from "../domain/project/index.js";
import type { ProjectScopedEntity } from "../domain/shared/entity.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

const NODE_ENTITY_TABLES: Readonly<Record<CanvasNodeEntityType, string>> = {
  brief: "briefs",
  research: "researchSessions",
  insight: "researchInsights",
  opportunity: "researchOpportunities",
  moodboard: "moodboards",
  direction: "directions",
  exploration: "explorations",
  prompt: "promptVersions",
  asset: "assets",
  generated_asset: "generatedAssets",
  review: "aiReviews",
  version: "versionSnapshots",
};

export class CanvasRepository {
  readonly #database: MuseDatabase;
  readonly #projects: Table<Project, EntityId>;
  readonly #canvasesTable: Table<Canvas, EntityId>;
  readonly #nodesTable: Table<CanvasNode, EntityId>;
  readonly #canvases: BaseRepository<Canvas>;
  readonly #nodes: BaseRepository<CanvasNode>;
  readonly #edges: BaseRepository<CanvasEdge>;
  readonly #viewports: BaseRepository<CanvasViewport>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#database = database;
    this.#projects = database.table("projects");
    this.#canvasesTable = database.table("canvases");
    this.#nodesTable = database.table("canvasNodes");
    this.#canvases = new BaseRepository(this.#canvasesTable, "Canvas", clock);
    this.#nodes = new BaseRepository(this.#nodesTable, "CanvasNode", clock);
    this.#edges = new BaseRepository(database.table("canvasEdges"), "CanvasEdge", clock);
    this.#viewports = new BaseRepository(database.table("canvasViewports"), "CanvasViewport", clock);
  }

  async createCanvas(input: CreateEntityInput<Canvas>): Promise<Canvas> { if ((await this.#projects.get(input.projectId)) === undefined) throw new EntityNotFoundError("Project", input.projectId); return this.#canvases.create(input); }
  updateCanvas(id: EntityId, patch: UpdateEntityInput<Canvas>) { return this.#canvases.update(id, patch); }
  getCanvas(id: EntityId) { return this.#canvases.get(id); }
  deleteCanvas(id: EntityId) { return this.#canvases.delete(id); }
  listCanvases(projectId: ProjectId) { return this.#canvases.query((item) => item.projectId === projectId); }

  async #validateNode(entity: Pick<CanvasNode, "projectId" | "canvasId" | "entityType" | "entityId">): Promise<void> {
    await requireParent(this.#canvasesTable, entity.canvasId, entity.projectId, "Canvas");
    if (entity.entityType === "research") {
      const researchTables = ["researchSessions", "researchInsights", "researchOpportunities", "creativeSeeds"] as const;
      for (const tableName of researchTables) {
        const candidate = await this.#database.table<ProjectScopedEntity, EntityId>(tableName).get(entity.entityId);
        if (candidate !== undefined) { if (candidate.projectId !== entity.projectId) throw new ParentEntityMismatchError("research", entity.entityId, entity.projectId); return; }
      }
      throw new EntityNotFoundError("research", entity.entityId);
    }
    if (entity.entityType === "asset") {
      if ((await this.#database.table("assets").get(entity.entityId)) === undefined) throw new EntityNotFoundError("asset", entity.entityId);
      const source = await this.#database.table<ProjectScopedEntity, EntityId>("assetSources").where("assetId").equals(entity.entityId).and(item => item.projectId === entity.projectId).first();
      if (!source) throw new ParentEntityMismatchError("asset", entity.entityId, entity.projectId);
      return;
    }
    const entityTable = this.#database.table<ProjectScopedEntity, EntityId>(NODE_ENTITY_TABLES[entity.entityType]);
    await requireParent(entityTable, entity.entityId, entity.projectId, entity.entityType);
  }
  async createNode(input: CreateEntityInput<CanvasNode>): Promise<CanvasNode> { await this.#validateNode(input); return this.#nodes.create(input); }
  async updateNode(id: EntityId, patch: UpdateEntityInput<CanvasNode>): Promise<CanvasNode> { const current = await this.#nodes.require(id); await this.#validateNode({ ...current, ...patch }); return this.#nodes.update(id, patch); }
  getNode(id: EntityId) { return this.#nodes.get(id); }
  deleteNode(id: EntityId) { return this.#nodes.delete(id); }
  listNodes(canvasId: EntityId) { return this.#nodes.query((item) => item.canvasId === canvasId); }

  async #validateEdge(entity: Pick<CanvasEdge, "projectId" | "canvasId" | "sourceNodeId" | "targetNodeId">): Promise<void> {
    await requireParent(this.#canvasesTable, entity.canvasId, entity.projectId, "Canvas");
    const source = await requireParent(this.#nodesTable, entity.sourceNodeId, entity.projectId, "CanvasNode");
    const target = await requireParent(this.#nodesTable, entity.targetNodeId, entity.projectId, "CanvasNode");
    if (source.canvasId !== entity.canvasId || target.canvasId !== entity.canvasId || source.id === target.id) throw new ParentEntityMismatchError("CanvasEdge", entity.canvasId, entity.projectId);
  }
  async createEdge(input: CreateEntityInput<CanvasEdge>): Promise<CanvasEdge> { await this.#validateEdge(input); return this.#edges.create(input); }
  async updateEdge(id: EntityId, patch: UpdateEntityInput<CanvasEdge>): Promise<CanvasEdge> { const current = await this.#edges.require(id); await this.#validateEdge({ ...current, ...patch }); return this.#edges.update(id, patch); }
  getEdge(id: EntityId) { return this.#edges.get(id); }
  deleteEdge(id: EntityId) { return this.#edges.delete(id); }
  listEdges(canvasId: EntityId) { return this.#edges.query((item) => item.canvasId === canvasId); }

  async createViewport(input: CreateEntityInput<CanvasViewport>): Promise<CanvasViewport> { await requireParent(this.#canvasesTable, input.canvasId, input.projectId, "Canvas"); return this.#viewports.create(input); }
  async updateViewport(id: EntityId, patch: UpdateEntityInput<CanvasViewport>): Promise<CanvasViewport> { const current = await this.#viewports.require(id); const next = { ...current, ...patch }; await requireParent(this.#canvasesTable, next.canvasId, next.projectId, "Canvas"); return this.#viewports.update(id, patch); }
  getViewport(id: EntityId) { return this.#viewports.get(id); }
  deleteViewport(id: EntityId) { return this.#viewports.delete(id); }
}
