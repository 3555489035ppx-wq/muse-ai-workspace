import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExplorationGalleryService, IterationService, loadExplorationGallery } from "../../application/exploration/index.js";
import { PhaseOneRuntimeService } from "../../application/runtime/index.js";
import { asProjectId, isEntityId } from "../../domain/shared/id.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, EmptyState, ErrorState, Field, LoadingState, StatusPill, TagList } from "../../components/ui.jsx";
import { ArrowRight, Check, Heart, RefreshCw, Sparkles, X } from "lucide-react";

const explorationPreviews = ["heritage-research", "editorial-series", "cultural-brand", "campaign-key-visual", "museum-digital", "exhibition-identity"] as const;
export function explorationPreview(key: string, index: number): string { const hash = [...key].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), index); return `/assets/templates/${explorationPreviews[hash % explorationPreviews.length]}.webp`; }
const axisLabel = { composition: "构图", photography: "摄影", typography: "字体", color: "色彩", material: "材质", lighting: "光线", imageTreatment: "图像处理" } as const;

export function ExplorationPage({ loader = loadExplorationGallery, service, runtime }: { readonly loader?: typeof loadExplorationGallery; readonly service?: ExplorationGalleryService; readonly runtime?: PhaseOneRuntimeService }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const commands = useMemo(() => service ?? new ExplorationGalleryService(), [service]);
  const workflow = useMemo(() => runtime ?? new PhaseOneRuntimeService(), [runtime]);
  const iteration = useMemo(() => new IterationService(), []);
  const [intent, setIntent] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof loadExplorationGallery>>>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const reload = async () => {
    if (!isEntityId(projectId)) { setError("项目链接无效"); return; }
    setData(await loader(asProjectId(projectId)));
  };
  useEffect(() => { void reload().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "视觉探索加载失败")); }, [loader, projectId]);
  if (error) return <AppShell><main className="exploration-page"><ErrorState title="视觉探索加载失败" description={error} /></main></AppShell>;
  if (!data) return <AppShell><main className="exploration-page"><LoadingState title="正在读取视觉探索" description="正在恢复锁定方向、变体和迭代记录。" /></main></AppShell>;
  if (data.length === 0) return <AppShell><main className="exploration-page"><EmptyState title="围绕锁定方向生成视觉变体" description="所有方案会保持同一核心概念，只改变构图、摄影、字体、色彩、材质和光线。" action={<Button icon={Sparkles} loading={running} disabled={!isEntityId(projectId)} onClick={() => { if (!isEntityId(projectId)) return; setRunning(true); void workflow.generateExploration(asProjectId(projectId)).then(reload).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "视觉探索生成失败")).finally(() => setRunning(false)); }}>生成视觉探索</Button>} /></main></AppShell>;
  const act = async (kind: "select" | "favorite" | "reject", variantId: typeof data[number]["variants"][number]["id"]) => {
    if (!isEntityId(projectId)) return;
    await commands[kind](asProjectId(projectId), variantId);
    await reload();
  };
  return <AppShell><main className="exploration-page" aria-labelledby="exploration-title"><header className="exploration-heading"><div><p>Locked Direction → Visual Exploration</p><h1 id="exploration-title">视觉探索</h1><span>同一核心概念，沿多个视觉表达轴建立可比较的变体。</span></div><StatusPill status="ai">离线确定性视觉探索</StatusPill></header>{data.map((group) => <section className="exploration-group" key={group.exploration.id}><header><div><span>锁定方向下的探索组</span><h2>{group.exploration.title}</h2></div><TagList items={["构图", "摄影", "字体", "色彩", "材质", "光线"]} /></header><div className="exploration-grid">{group.variants.map((variant, index) => { const candidate=group.candidates.find((item)=>item.label===variant.label); return <article key={variant.id} data-status={variant.status}><div className="exploration-card__visual"><img src={explorationPreview(candidate?.preview.fixtureKey ?? variant.label,index)} alt="" /><StatusPill status={variant.status === "kept" ? "success" : variant.status === "discarded" ? "warn" : "ai"}>{variant.status === "kept" ? "已保留" : variant.status === "discarded" ? "已排除" : "待判断"}</StatusPill></div><div className="exploration-card__body"><h3>{variant.label}</h3>{candidate ? <dl>{candidate.axisValues.map((axis)=><div key={axis.axis}><dt>{axisLabel[axis.axis]}</dt><dd>{axis.value.replace(/ · 首轮$/,"")}</dd></div>)}</dl> : <p className="muted">该历史变体缺少轴快照，可继续迭代生成完整记录。</p>}<div className="exploration-card__actions"><Button variant="quiet" icon={Check} onClick={() => void act("select", variant.id)}>选择</Button><Button variant="quiet" icon={Heart} onClick={() => void act("favorite", variant.id)}>收藏</Button><Button variant="quiet" icon={X} onClick={() => void act("reject", variant.id)}>排除</Button></div></div></article>; })}</div><div className="exploration-iteration"><Field label="迭代意图" hint="只调整当前探索的表达轴，不改变锁定方向的核心概念"><input value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="例如：保持档案叙事，增强色彩张力和近景材质" /></Field><Button variant="quiet" icon={RefreshCw} disabled={!intent.trim()} onClick={async () => { if (isEntityId(projectId) && intent.trim()) { await iteration.iterate(asProjectId(projectId), group.exploration.id, { text: intent, focusAxes: ["composition", "color", "lighting"] }, "ui"); await reload(); } }}>迭代当前探索</Button><Button icon={ArrowRight} loading={running} onClick={() => { if (!isEntityId(projectId)) return; setRunning(true); void commands.continue(asProjectId(projectId), group.exploration.id).then(() => workflow.compilePrompt(asProjectId(projectId), group.exploration.id)).then(() => navigate(`/projects/${projectId}/generation`)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "提示词编译失败")).finally(() => setRunning(false)); }}>继续编译提示词</Button></div></section>)}</main></AppShell>;
}
