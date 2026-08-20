import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Image, RotateCcw, Sparkles, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type { AiCapabilityView } from "../../../server/contracts/ai.js";
import { GeneratedAssetService, GenerationJobService } from "../../application/generation/index.js";
import { ReviewService } from "../../application/review/index.js";
import { AiProviderStatus } from "../../components/ai/AiProviderStatus.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, ErrorState, LoadingState, StatusPill, TagList } from "../../components/ui.jsx";
import { db, type MuseDatabase } from "../../db/database.js";
import type { GeneratedAsset, GenerationJob } from "../../domain/generation/index.js";
import type { PromptSpec, PromptVersion } from "../../domain/prompt/index.js";
import type { AIReview } from "../../domain/review/index.js";
import { asProjectId, isEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import type { VersionSnapshot } from "../../domain/version/index.js";
import { MuseAiClient, MuseAiClientError } from "../../lib/api/museAiClient.js";
import { MuseBffGenerationProvider } from "../../infrastructure/providers/remote/generation/index.js";

export async function loadPromptGenerationReview(projectId: ProjectId, database: MuseDatabase = db) {
  const [specs, jobs, assets, reviews, versions, snapshots] = await Promise.all([
    database.table<PromptSpec, EntityId>("promptSpecs").where("projectId").equals(projectId).toArray(),
    database.table<GenerationJob, EntityId>("generationJobs").where("projectId").equals(projectId).toArray(),
    database.table<GeneratedAsset, EntityId>("generatedAssets").where("projectId").equals(projectId).toArray(),
    database.table<AIReview, EntityId>("aiReviews").where("projectId").equals(projectId).toArray(),
    database.table<PromptVersion, EntityId>("promptVersions").where("projectId").equals(projectId).toArray(),
    database.table<VersionSnapshot, EntityId>("versionSnapshots").where("projectId").equals(projectId).toArray(),
  ]);
  return { specs, jobs, assets, reviews, versions: versions.sort((a, b) => a.version - b.version), snapshots };
}

const statusLabel = { queued: "等待生成", running: "生成中", succeeded: "已完成", failed: "失败", cancelled: "已取消" } as const;
const reviewLabel: Readonly<Record<string, string>> = { goal_alignment: "目标一致性", visual_coherence: "视觉一致性", distinctiveness: "差异性", audience_fit: "受众适配", feasibility: "可执行性", craft: "完成度", brief_match: "需求匹配", direction: "方向一致", audience: "受众适配", identity: "识别度", composition: "构图", originality: "原创性", cross_media: "跨媒介" };
const generationPreviews = ["cultural-brand", "heritage-research", "editorial-series", "campaign-key-visual", "museum-digital", "exhibition-identity"] as const;
export function generationPreview(asset: GeneratedAsset, index: number): string { if (asset.remoteAssetUrl?.startsWith("/api/ai/assets/")) return asset.remoteAssetUrl; const text = `${asset.seed ?? ""}${asset.id}`; const hash = [...text].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), index); return `/assets/templates/${generationPreviews[hash % generationPreviews.length]}.webp`; }

export function PromptGenerationReviewPage({ database = db }: { readonly database?: MuseDatabase }) {
  const { projectId } = useParams(); const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPromptGenerationReview>>>();
  const [error, setError] = useState(""); const [capabilities, setCapabilities] = useState<AiCapabilityView>();
  const [liveState, setLiveState] = useState<"idle" | "running" | "succeeded" | "failed">("idle"); const [liveMessage, setLiveMessage] = useState("");
  const jobs = useMemo(() => new GenerationJobService(database), [database]); const aiClient = useMemo(() => new MuseAiClient(), []);
  const project = isEntityId(projectId) ? asProjectId(projectId) : undefined;
  const reload = useCallback(async () => { if (!project) { setError("项目链接无效"); return; } setData(await loadPromptGenerationReview(project, database)); }, [database, project]);
  useEffect(() => { void reload().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "工作流加载失败")); }, [reload]);
  const providerChanged = useCallback((value?: AiCapabilityView) => setCapabilities(value), []);
  if (error) return <AppShell><main className="generation-workflow"><ErrorState title="生成工作流加载失败" description={error} /></main></AppShell>;
  if (!data || !project) return <AppShell><main className="generation-workflow"><LoadingState title="正在读取真实数据链" description="正在恢复 PromptVersion、GenerationJob、GeneratedAsset 与 AIReview。" /></main></AppShell>;
  const latestVersion = data.versions.at(-1); const latestAsset = data.assets.at(-1); const latestReview = data.reviews.at(-1);
  const liveReady = Boolean(capabilities?.liveEnabled && capabilities.providerConfigured && !capabilities.killSwitchActive);
  const generate = async () => { if (!latestVersion) return; const queued = await jobs.queue({ projectId: project, promptVersionId: latestVersion.id, seed: `ui-${latestVersion.version}` }); const completed = await jobs.run(queued.jobId); if (completed.result) await new GeneratedAssetService(database).persist({ projectId: project, jobId: queued.jobId, result: completed.result }); await reload(); };
  const generateLive = async () => { if (!latestVersion) return; setLiveState("running"); setLiveMessage("正在通过 Muse 安全服务生成真实视觉，请保持此页面打开。"); try { const liveJobs = new GenerationJobService(database, { provider: new MuseBffGenerationProvider(aiClient) }); const queued = await liveJobs.queue({ projectId: project, promptVersionId: latestVersion.id, seed: `live-${latestVersion.version}` }); const completed = await liveJobs.run(queued.jobId); if (!completed.result) throw new MuseAiClientError("NO_RESULT", "真实 AI 未返回可保存的结果。", true); await new GeneratedAssetService(database).persist({ projectId: project, jobId: queued.jobId, result: completed.result }); setLiveState("succeeded"); setLiveMessage(`真实生成已完成 · ${completed.result.model ?? "AI Provider"} · 预计 ¥${(completed.result.estimatedCostCny ?? 0).toFixed(2)}`); await reload(); } catch (reason) { setLiveState("failed"); setLiveMessage(reason instanceof Error ? reason.message : "真实 AI 暂时不可用，离线工作流未受影响。"); } };
  const review = async () => { if (!latestAsset) return; await new ReviewService(database).review(project, latestAsset.id); await reload(); };

  return <AppShell><main className="generation-workflow" aria-labelledby="generation-title">
    <header className="generation-heading"><div><p>Prompt → Generation → Review</p><h1 id="generation-title">生成与 AI 评审</h1><span>提示词、生成任务、资产和评审都保留可追溯关系。</span></div><AiProviderStatus client={aiClient} onChange={providerChanged} /><p>离线工作流始终可用；真实 AI 仅在服务端密钥、预算和总开关同时通过时启用。</p></header>
    <div className="generation-layout">
      <section className="prompt-panel"><header><div><span>01 · Prompt Compiler</span><h2>结构化提示词</h2></div>{latestVersion ? <StatusPill status="ai">V{latestVersion.version}</StatusPill> : null}</header>
        {latestVersion ? <><article className="prompt-version"><div><strong>创意意图</strong><p>{data.specs.find((item) => item.id === latestVersion.promptSpecId)?.objective ?? "基于已选视觉探索建立可执行视觉方向"}</p></div><div><strong>视觉提示词</strong><p>{latestVersion.promptText}</p></div>{latestVersion.negativePrompt ? <div><strong>避免项</strong><p>{latestVersion.negativePrompt}</p></div> : null}<div><strong>模型目标</strong><TagList items={[latestVersion.adapterTarget, `PromptVersion V${latestVersion.version}`]} /></div></article><div className="prompt-history" aria-label="提示词版本历史">{data.versions.map((version) => <button key={version.id} data-active={version.id === latestVersion.id}><strong>V{version.version}</strong><span>{version.id === latestVersion.id ? "当前版本" : "历史版本"}</span></button>)}</div></> : <p className="muted">请先在视觉探索中选择方案并编译提示词。</p>}
      </section>
      <section className="generation-panel"><header><div><span>02 · Generation Job</span><h2>生成任务</h2></div><div className="generation-actions"><Button icon={Sparkles} disabled={!latestVersion} onClick={() => void generate()}>生成离线视觉</Button><Button variant="secondary" icon={Sparkles} disabled={!latestVersion || !liveReady || liveState === "running"} loading={liveState === "running"} onClick={() => void generateLive()}>真实 AI 生成</Button></div></header>
        {liveState !== "idle" ? <div className={`ai-live-state ai-live-state--${liveState}`} role="status" aria-live="polite"><strong>{liveState === "running" ? "生成中" : liveState === "succeeded" ? "已完成" : "未完成"}</strong><span>{liveMessage}</span>{liveState === "failed" ? <Button variant="quiet" disabled={!liveReady} onClick={() => void generateLive()}>重试</Button> : null}</div> : null}
        <div className="generation-job-list">{data.jobs.length ? data.jobs.map((job) => <article key={job.id} data-status={job.status}><div><StatusPill status={job.status === "succeeded" ? "success" : job.status === "failed" ? "warn" : "ai"}>{statusLabel[job.status]}</StatusPill><span>Prompt V{data.versions.find((version) => version.id === job.promptVersionId)?.version ?? "—"}</span></div>{job.status === "queued" ? <Button variant="quiet" icon={X} onClick={() => void jobs.cancel(job.id).then(reload)}>取消</Button> : null}{job.status === "failed" ? <Button variant="quiet" icon={RotateCcw} onClick={() => void jobs.retry(job.id).then(reload)}>重试</Button> : null}</article>) : <p className="muted">尚未创建生成任务。</p>}</div>
      </section>
      <section className="asset-panel"><header><div><span>03 · Generated Asset</span><h2>生成资产</h2></div><span>{data.assets.length} 个结果</span></header>{data.assets.length ? <div className="generated-asset-grid">{data.assets.map((asset, index) => <article key={asset.id}><img src={generationPreview(asset, index)} alt={`生成资产 ${index + 1}`} /><div><StatusPill status={asset.providerId ? "success" : "warn"}>{asset.providerId ? "真实 AI" : "离线资产"}</StatusPill><strong>{asset.width} × {asset.height}</strong><p>源自 Prompt V{data.versions.find((version) => version.id === asset.promptVersionId)?.version ?? "—"}{asset.model ? ` · ${asset.model}` : ""}</p></div></article>)}</div> : <p className="muted">生成任务完成后，结果会在此保留来源关系。</p>}</section>
      <section className="review-panel"><header><div><span>04 · Evidence Review</span><h2>AI 评审</h2></div><Button icon={Image} disabled={!latestAsset || Boolean(latestReview)} onClick={() => void review()}>评审当前资产</Button></header>{latestReview ? <><blockquote>{latestReview.summary}</blockquote><div className="review-grid">{latestReview.dimensions.map((item, index) => <article key={`${item.dimension}-${String(index)}`}><header><strong>{reviewLabel[item.dimension] ?? item.dimension}</strong><b>{item.score}<small>/100</small></b></header><dl><dt>证据</dt><dd>{item.evidence.replace(/^\[[^\]]+\]\s*/, "")}</dd><dt>问题</dt><dd>{item.problem}</dd><dt>原因</dt><dd>{item.reason}</dd><dt>影响</dt><dd>{item.impact}</dd><dt>建议</dt><dd>{item.recommendation}</dd></dl></article>)}</div><Button icon={ArrowRight} onClick={() => navigate(`/projects/${projectId}/decision-map`)}>打开创意决策地图</Button></> : <p className="muted">生成资产后可执行确定性证据评审。</p>}</section>
    </div>
  </main></AppShell>;
}

export function generationEntityNavigationCandidates(data: Awaited<ReturnType<typeof loadPromptGenerationReview>>): readonly EntityId[] { return [...data.versions.map((item) => item.id), ...data.assets.map((item) => item.id), ...data.reviews.map((item) => item.id)]; }
