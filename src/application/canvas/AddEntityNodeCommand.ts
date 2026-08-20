import type { CanvasNode } from "../../domain/canvas/index.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { CanvasRepository } from "../../repositories/CanvasRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";

export type ResearchCanvasEntityType = "ResearchInsight" | "ResearchOpportunity" | "CreativeSeed";
const tableByType: Readonly<Record<ResearchCanvasEntityType, "researchInsights" | "researchOpportunities" | "creativeSeeds">> = {
  ResearchInsight: "researchInsights", ResearchOpportunity: "researchOpportunities", CreativeSeed: "creativeSeeds",
};

export interface AddEntityNodeInput { readonly projectId: ProjectId; readonly canvasId?: EntityId; readonly entityId: EntityId; readonly entityType: ResearchCanvasEntityType; }
export interface AddEntityNodeResult { readonly canvasId: EntityId; readonly node: CanvasNode; readonly created: boolean; }

export class AddEntityNodeCommand {
  readonly #repository: CanvasRepository;
  readonly #database: MuseDatabase;
  readonly #idFactory: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly idFactory?: () => EntityId; readonly clock?: RepositoryClock } = {}) {
    this.#database = database;
    this.#repository = new CanvasRepository(database, options.clock);
    this.#idFactory = options.idFactory ?? (() => createEntityId());
  }
  async execute(input: AddEntityNodeInput): Promise<AddEntityNodeResult> {
    const entity = await this.resolve(input.entityType, input.entityId);
    if (entity === undefined || entity.projectId !== input.projectId) throw new Error("研究实体不存在或不属于当前项目");
    const existingCanvases = await this.#repository.listCanvases(input.projectId);
    const canvas = input.canvasId === undefined
      ? existingCanvases[0] ?? await this.#repository.createCanvas({ id: this.#idFactory(), projectId: input.projectId, name: "创意决策地图" })
      : await this.#repository.getCanvas(input.canvasId);
    if (canvas === undefined || canvas.projectId !== input.projectId) throw new Error("画布不存在或不属于当前项目");
    const nodes = await this.#repository.listNodes(canvas.id);
    const duplicate = nodes.find((node) => node.entityId === input.entityId);
    if (duplicate !== undefined) return { canvasId: canvas.id, node: duplicate, created: false };
    const index = nodes.length;
    const node = await this.#repository.createNode({
      id: this.#idFactory(), projectId: input.projectId, canvasId: canvas.id, entityId: input.entityId, entityType: "research",
      position: { x: 80 + (index % 3) * 320, y: 100 + Math.floor(index / 3) * 220 },
    });
    return { canvasId: canvas.id, node, created: true };
  }
  resolve(entityType: ResearchCanvasEntityType, entityId: EntityId): Promise<ProjectScopedEntity | undefined> {
    return this.#database.table<ProjectScopedEntity, EntityId>(tableByType[entityType]).get(entityId);
  }
}
