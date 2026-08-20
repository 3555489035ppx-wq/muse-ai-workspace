import { Background, Controls, Handle, Position, ReactFlow, useEdgesState, useNodesState, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CanvasEdge, CanvasNode, CanvasPosition, CanvasViewport } from "../../domain/canvas/index.js";
import { EntityNotFoundError, ProjectScopeViolationError } from "../../domain/errors/index.js";
import type { EntityId, ProjectId } from "../../domain/shared/id.js";
import type { CanvasRepository } from "../../repositories/CanvasRepository.js";
import styles from "./CreativeDecisionMapShell.module.css";
import type { DecisionMapNodeView } from "../../application/canvas/DecisionMapQueryService.js";

const entityLabel: Readonly<Record<CanvasNode["entityType"], string>> = { brief:"简报",research:"研究",insight:"洞察",opportunity:"机会",moodboard:"情绪板",direction:"创意方向",exploration:"视觉探索",prompt:"提示词",asset:"素材",generated_asset:"生成资产",review:"AI 评审",version:"版本" };

export interface DecisionMapNodeData extends Record<string, unknown> {
  readonly entityId: EntityId;
  readonly entityType: CanvasNode["entityType"];
  readonly title?: string;
  readonly summary?: string;
  readonly status?: string;
}

export type DecisionMapFlowNode = Node<DecisionMapNodeData>;

export function toFlowNodes(nodes: readonly CanvasNode[], views?: Readonly<Record<string, DecisionMapNodeView>>): readonly DecisionMapFlowNode[] {
  return nodes.map((node) => views === undefined ? ({ id: node.id, position: node.position, data: { entityId: node.entityId, entityType: node.entityType } }) : ({ id: node.id, type: "decision", position: node.position, data: { entityId: node.entityId, entityType: node.entityType, ...views[node.id] } }));
}

export function toFlowEdges(edges: readonly CanvasEdge[]): readonly Edge[] {
  return edges.map((edge) => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId, label: edge.label }));
}

export async function persistCanvasNodePosition(repository: CanvasRepository, projectId: ProjectId, nodeId: EntityId, position: CanvasPosition): Promise<void> {
  const node = await repository.getNode(nodeId);
  if (node === undefined) throw new EntityNotFoundError("CanvasNode", nodeId);
  if (node.projectId !== projectId) throw new ProjectScopeViolationError(projectId, node.projectId, node.id);
  await repository.updateNode(nodeId, { position });
}

export async function persistCanvasViewport(repository: CanvasRepository, projectId: ProjectId, viewportId: EntityId, viewport: Pick<CanvasViewport, "x" | "y" | "zoom">): Promise<void> {
  const current = await repository.getViewport(viewportId);
  if (current === undefined) throw new EntityNotFoundError("CanvasViewport", viewportId);
  if (current.projectId !== projectId) throw new ProjectScopeViolationError(projectId, current.projectId, current.id);
  await repository.updateViewport(viewportId, viewport);
}

export interface CreativeDecisionMapShellProps {
  readonly projectId: ProjectId;
  readonly repository: CanvasRepository;
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly viewport?: CanvasViewport;
  readonly nodeViews?: Readonly<Record<string, DecisionMapNodeView>>;
  readonly onPersistenceError?: (error: unknown) => void;
  readonly onNodeSelect?: (node: DecisionMapNodeData) => void;
}

function DecisionNode({ data }: NodeProps<DecisionMapFlowNode>) {
  return <article className={styles.node} data-entity-type={data.entityType}><Handle type="target" position={Position.Left} /><span>{entityLabel[data.entityType]}</span><strong>{data.title ?? entityLabel[data.entityType]}</strong><p>{data.summary ?? "已连接到项目实体"}</p><small>{data.status ?? "已连接"}</small><Handle type="source" position={Position.Right} /></article>;
}
const nodeTypes = { decision: DecisionNode };

export function CreativeDecisionMapShell({ projectId, repository, nodes: sourceNodes, edges: sourceEdges, viewport, nodeViews, onPersistenceError, onNodeSelect }: CreativeDecisionMapShellProps) {
  const [nodes, , onNodesChange] = useNodesState<DecisionMapFlowNode>([...toFlowNodes(sourceNodes, nodeViews)]);
  const [edges, , onEdgesChange] = useEdgesState([...toFlowEdges(sourceEdges)]);
  const shouldFitInitialGraph = viewport === undefined || (sourceNodes.length > 8 && viewport.x === 0 && viewport.y === 0 && viewport.zoom === 0.8);

  return (
    <div className={styles.shell} data-testid="creative-decision-map-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_event, node) => onNodeSelect?.(node.data)}
        onNodeDragStop={(_event, node) => { void persistCanvasNodePosition(repository, projectId, node.id as EntityId, node.position).catch(onPersistenceError); }}
        onMoveEnd={(_event, nextViewport) => { if (viewport !== undefined) void persistCanvasViewport(repository, projectId, viewport.id, nextViewport).catch(onPersistenceError); }}
        defaultViewport={viewport}
        fitView={shouldFitInitialGraph}
        fitViewOptions={{ padding: 0.18, maxZoom: 0.72 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
