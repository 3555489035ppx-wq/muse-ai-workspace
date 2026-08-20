import { EntityNotFoundError, ProjectScopeViolationError } from "../../domain/errors/index.js";
import type { EntityId, ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { CanvasRepository } from "../../repositories/CanvasRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { EntityCanvasAdapter } from "./EntityCanvasAdapter.js";

export class CanvasNodeCommandService {
  readonly #database: MuseDatabase; readonly #repository: CanvasRepository; readonly #adapter: EntityCanvasAdapter; readonly #fault?: () => void | Promise<void>;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly faultInjector?: () => void | Promise<void> } = {}) { this.#database = database; this.#repository = new CanvasRepository(database); this.#adapter = new EntityCanvasAdapter(database); this.#fault = options.faultInjector; }
  async deleteViewNode(projectId: ProjectId, nodeId: EntityId) { const node = await this.#repository.getNode(nodeId); if (!node) throw new EntityNotFoundError("CanvasNode", nodeId); if (node.projectId !== projectId) throw new ProjectScopeViolationError(projectId, node.projectId, nodeId); const edges = (await this.#repository.listEdges(node.canvasId)).filter(edge => edge.sourceNodeId === node.id || edge.targetNodeId === node.id); await runWriteTransaction(this.#database, [this.#database.table("canvasNodes"), this.#database.table("canvasEdges")], async () => { for (const edge of edges) await this.#repository.deleteEdge(edge.id); await this.#fault?.(); await this.#repository.deleteNode(node.id); }); return { deletedNodeId: node.id, removedEdgeIds: edges.map(edge => edge.id), businessEntityDeleted: false as const }; }
  async pruneMissingEntityNodes(projectId: ProjectId, canvasId: EntityId) { const removed: EntityId[] = []; for (const node of await this.#repository.listNodes(canvasId)) { try { await this.#adapter.resolve(projectId, node.entityType, node.entityId); } catch (error) { if (!(error instanceof EntityNotFoundError)) throw error; await this.deleteViewNode(projectId, node.id); removed.push(node.id); } } return removed; }
}
