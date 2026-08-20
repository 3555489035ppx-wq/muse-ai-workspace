import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { asProjectId, isEntityId } from "../../domain/shared/id.js";
import { db, type MuseDatabase } from "../../db/database.js";
import { CreativeDecisionMapShell, type DecisionMapNodeData } from "../../infrastructure/canvas/CreativeDecisionMapShell.js";
import { CanvasRepository } from "../../repositories/CanvasRepository.js";
import { DecisionNodeInspector } from "./DecisionNodeInspector.js";
import { ensureDecisionMap, loadDecisionMap } from "../../application/canvas/index.js";
import { PhaseOneRuntimeService } from "../../application/runtime/index.js";
import { AppShell } from "../../components/shell.jsx";
import { ErrorState, LoadingState, StatusPill } from "../../components/ui.jsx";
export { ensureDecisionMap, loadDecisionMap };

export function CreativeDecisionMapPage({ database = db }: { readonly database?: MuseDatabase }) {
  const { projectId } = useParams(); const [data, setData] = useState<Awaited<ReturnType<typeof loadDecisionMap>>>(); const [selected, setSelected] = useState<DecisionMapNodeData>(); const [error, setError] = useState(""); const repository = useMemo(() => new CanvasRepository(database), [database]); const workflow = useMemo(() => new PhaseOneRuntimeService(database), [database]); const project = isEntityId(projectId) ? asProjectId(projectId) : undefined;
  useEffect(() => { if (!project) { setError("项目链接无效"); return; } void workflow.populateDecisionMap(project).then(() => loadDecisionMap(project, database)).then(setData).catch(reason => setError(reason instanceof Error ? reason.message : "决策地图加载失败")); }, [projectId, database, workflow]);
  if (error) return <AppShell><main className="decision-map-page"><ErrorState title="创意决策地图加载失败" description={error} /></main></AppShell>; if (!project || !data?.canvas) return <AppShell><main className="decision-map-page"><LoadingState title="正在加载创意决策地图" description="正在读取真实实体、关系边和画布视口。" /></main></AppShell>;
  return <AppShell><main className="decision-map-page" aria-labelledby="decision-map-title"><header className="decision-map-heading"><div><p>Creative Decision Map</p><h1 id="decision-map-title">创意决策地图</h1><span>从简报到评审，查看每个关键判断如何连接到下一步。</span></div><StatusPill status="ai">{data.nodes.length} 个真实实体节点</StatusPill><p>画布只保存实体引用与坐标，内容始终读取当前业务数据。</p></header><div className="decision-map-layout"><section className="decision-map-canvas" aria-label="创意决策地图画布"><CreativeDecisionMapShell projectId={project} repository={repository} nodes={data.nodes} edges={data.edges} viewport={data.viewport} nodeViews={data.nodeViews} onNodeSelect={setSelected} onPersistenceError={reason => setError(reason instanceof Error ? reason.message : "画布保存失败")} /></section><aside aria-label="节点检查器"><DecisionNodeInspector database={database} projectId={project} selection={selected} /></aside></div></main></AppShell>;
}
