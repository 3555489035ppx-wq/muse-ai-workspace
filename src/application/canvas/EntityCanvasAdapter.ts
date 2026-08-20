import type { CanvasNode, CanvasNodeEntityType, CanvasPosition } from "../../domain/canvas/index.js";
import { EntityNotFoundError, ProjectScopeViolationError } from "../../domain/errors/index.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { CanvasRepository } from "../../repositories/CanvasRepository.js";

const ENTITY_TABLE: Readonly<Record<CanvasNodeEntityType, string>> = { brief: "briefs", research: "researchSessions", insight: "researchInsights", opportunity: "researchOpportunities", moodboard: "moodboards", direction: "directions", exploration: "explorations", prompt: "promptVersions", asset: "assets", generated_asset: "generatedAssets", review: "aiReviews", version: "versionSnapshots" };
export class EntityCanvasAdapter {
  readonly #database: MuseDatabase; readonly #repository: CanvasRepository; readonly #ids: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly entityIdFactory?: () => EntityId } = {}) { this.#database = database; this.#repository = new CanvasRepository(database); this.#ids = options.entityIdFactory ?? createEntityId; }
  async add(projectId: ProjectId, canvasId: EntityId, entityType: CanvasNodeEntityType, entityId: EntityId, position: CanvasPosition): Promise<CanvasNode> {
    await this.resolve(projectId, entityType, entityId); const existing = (await this.#repository.listNodes(canvasId)).find(item => item.entityType === entityType && item.entityId === entityId); if (existing) return this.#repository.updateNode(existing.id, { position });
    return this.#repository.createNode({ id: this.#ids(), projectId, canvasId, entityType, entityId, position });
  }
  async resolve(projectId: ProjectId, entityType: CanvasNodeEntityType, entityId: EntityId): Promise<Record<string, unknown>> {
    if (entityType === "asset") { const entity = await this.#database.table<Record<string, unknown>, EntityId>("assets").get(entityId); if (!entity) throw new EntityNotFoundError("asset", entityId); const source = await this.#database.table<ProjectScopedEntity, EntityId>("assetSources").where("assetId").equals(entityId).and(item => item.projectId === projectId).first(); if (!source) throw new ProjectScopeViolationError(projectId, "unreferenced", entityId); return entity; }
    const entity = await this.#database.table<ProjectScopedEntity & Record<string, unknown>, EntityId>(ENTITY_TABLE[entityType]).get(entityId); if (!entity) throw new EntityNotFoundError(entityType, entityId); if (entity.projectId !== projectId) throw new ProjectScopeViolationError(projectId, entity.projectId, entityId); return entity;
  }
}
