import type { CanvasViewport } from "../../domain/canvas/index.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { db, type MuseDatabase } from "../../db/database.js";
import { CanvasRepository } from "../../repositories/CanvasRepository.js";
import { EntityCanvasAdapter } from "./EntityCanvasAdapter.js";

export interface DecisionMapNodeView { readonly title: string; readonly summary: string; readonly status: string; }
const entityLabels: Readonly<Record<string, string>> = { brief: "项目简报", research: "研究结论", insight: "设计洞察", opportunity: "设计机会", moodboard: "情绪板", direction: "创意方向", exploration: "视觉探索", prompt: "结构化提示词", generated_asset: "生成资产", asset: "视觉素材", review: "AI 评审" };
function nodeView(entityType: string, entity: Record<string, unknown>): DecisionMapNodeView {
  const fallback = entityLabels[entityType] ?? "项目实体";
  const generatedTitle = entityType === "generated_asset" && typeof entity.width === "number" && typeof entity.height === "number" ? `生成视觉 · ${String(entity.width)} × ${String(entity.height)}` : undefined;
  const reviewTitle = entityType === "review" ? "当前方案证据评审" : undefined;
  const title = entity.name ?? entity.title ?? entity.goal ?? entity.query ?? entity.statement ?? entity.promptText ?? generatedTitle ?? reviewTitle ?? fallback;
  const summary = entity.summary ?? entity.concept ?? entity.premise ?? entity.objective ?? entity.narrative ?? entity.status ?? "已连接到项目实体";
  const status = entity.status ?? entity.state ?? (typeof entity.version === "number" ? `V${String(entity.version)}` : "已连接");
  return { title: String(title), summary: String(summary), status: String(status) };
}
export async function loadDecisionMap(projectId: ProjectId, database: MuseDatabase = db) { const repository = new CanvasRepository(database); const canvas = (await repository.listCanvases(projectId))[0]; if (!canvas) return { canvas: undefined, nodes: [], edges: [], viewport: undefined, nodeViews: {} as Readonly<Record<string,DecisionMapNodeView>> }; const [nodes, edges, viewport] = await Promise.all([repository.listNodes(canvas.id), repository.listEdges(canvas.id), database.table<CanvasViewport, EntityId>("canvasViewports").where("canvasId").equals(canvas.id).first()]); const adapter=new EntityCanvasAdapter(database); const entries=await Promise.all(nodes.map(async(node)=>{try{return[node.id,nodeView(node.entityType,await adapter.resolve(projectId,node.entityType,node.entityId))]as const;}catch{return[node.id,{title:`${node.entityType} 节点`,summary:"实体暂时不可读取",status:"缺失"}]as const;}})); return { canvas, nodes, edges, viewport, nodeViews: Object.fromEntries(entries) as Readonly<Record<string,DecisionMapNodeView>> }; }
export async function ensureDecisionMap(projectId: ProjectId, database: MuseDatabase = db, idFactory: () => EntityId = createEntityId) { const existing = await loadDecisionMap(projectId, database); if (existing.canvas) return existing; const repository = new CanvasRepository(database); const canvas = await repository.createCanvas({ id: idFactory(), projectId, name: "创意决策地图" }); const viewport = await repository.createViewport({ id: idFactory(), projectId, canvasId: canvas.id, x: 0, y: 0, zoom: 0.8 }); return { canvas, nodes: [], edges: [], viewport }; }
