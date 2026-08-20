import type { CanvasEdge, CanvasNode } from "../../domain/canvas/index.js";
import { asEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { CanvasRepository } from "../../repositories/CanvasRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { EntityCanvasAdapter } from "./EntityCanvasAdapter.js";

function stableId(canvasId: EntityId, source: EntityId, target: EntityId): EntityId { const text = `${canvasId}:${source}:${target}`; const hash = (salt: number) => { let value = 2166136261 ^ salt; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return (value >>> 0).toString(16).padStart(8, "0"); }; const hex = `${hash(1)}${hash(2)}${hash(3)}${hash(4)}`; return asEntityId(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`); }
function ids(value: unknown): readonly EntityId[] { return Array.isArray(value) ? value.filter(item => typeof item === "string") as EntityId[] : []; }
function parentIds(node: CanvasNode, entity: Record<string, unknown>): readonly EntityId[] { switch (node.entityType) { case "research": return ids([entity.briefId]); case "insight": return ids([entity.researchSessionId]); case "opportunity": return [...ids(entity.insightIds), ...ids([entity.researchSessionId])]; case "moodboard": return ids([entity.researchSessionId]); case "direction": return [...ids([entity.moodboardId, entity.researchSessionId]), ...ids(entity.opportunityIds)]; case "exploration": return ids([entity.directionId]); case "prompt": return ids([entity.explorationId, entity.directionId]); case "generated_asset": return ids([entity.promptVersionId]); case "review": return ids([entity.generatedAssetId, entity.directionId]); default: return []; } }

export class LineageEdgeService {
  readonly #database: MuseDatabase; readonly #repository: CanvasRepository; readonly #adapter: EntityCanvasAdapter;
  constructor(database: MuseDatabase = getDefaultDatabase()) { this.#database = database; this.#repository = new CanvasRepository(database); this.#adapter = new EntityCanvasAdapter(database); }
  async rebuild(projectId: ProjectId, canvasId: EntityId): Promise<readonly CanvasEdge[]> {
    const canvas = await this.#repository.getCanvas(canvasId); if (!canvas || canvas.projectId !== projectId) throw new Error("Canvas is missing or outside the project."); const nodes = await this.#repository.listNodes(canvasId); const byEntity = new Map(nodes.map(node => [node.entityId, node])); const desired = new Map<EntityId, { source: CanvasNode; target: CanvasNode }>();
    for (const target of nodes) { const entity = await this.#adapter.resolve(projectId, target.entityType, target.entityId); for (const parentId of parentIds(target, entity)) { const source = byEntity.get(parentId); if (source && source.id !== target.id) desired.set(stableId(canvasId, source.id, target.id), { source, target }); } }
    for (const assetNode of nodes.filter(node => node.entityType === "asset")) { const generated = nodes.find(node => node.entityType === "generated_asset" && byEntity.has(node.entityId)); if (generated) { const entity = await this.#adapter.resolve(projectId, "generated_asset", generated.entityId); if (entity.assetId === assetNode.entityId) desired.set(stableId(canvasId, generated.id, assetNode.id), { source: generated, target: assetNode }); } }
    const existing = await this.#repository.listEdges(canvasId); await runWriteTransaction(this.#database, [this.#database.table("canvases"), this.#database.table("canvasNodes"), this.#database.table("canvasEdges")], async () => { for (const edge of existing) if (edge.label === "lineage" && !desired.has(edge.id)) await this.#repository.deleteEdge(edge.id); for (const [id, relation] of desired) if (!existing.some(edge => edge.id === id)) await this.#repository.createEdge({ id, projectId, canvasId, sourceNodeId: relation.source.id, targetNodeId: relation.target.id, label: "lineage" }); }); return this.#repository.listEdges(canvasId);
  }
}
