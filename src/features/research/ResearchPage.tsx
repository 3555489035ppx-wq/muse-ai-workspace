import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { CreativeSeed, ResearchEvidence, ResearchInsight, ResearchObservation, ResearchOpportunity, ResearchSession, ResearchSource } from "../../domain/research/index.js";
import { asProjectId, isEntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { ResearchRepository } from "../../repositories/ResearchRepository.js";
import { AddEntityNodeCommand, type ResearchCanvasEntityType } from "../../application/canvas/index.js";
import { PhaseOneRuntimeService } from "../../application/runtime/index.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, EmptyState, ErrorState, LoadingState, StatusPill } from "../../components/ui.jsx";
import { ArrowRight, Network, Plus } from "lucide-react";

export interface ResearchViewModel {
  readonly session: ResearchSession;
  readonly sources: readonly ResearchSource[];
  readonly evidence: readonly ResearchEvidence[];
  readonly observations: readonly ResearchObservation[];
  readonly insights: readonly ResearchInsight[];
  readonly opportunities: readonly ResearchOpportunity[];
  readonly seeds: readonly CreativeSeed[];
}

export async function loadResearchView(projectId: ProjectId, database: MuseDatabase = getDefaultDatabase()): Promise<ResearchViewModel | undefined> {
  const repository = new ResearchRepository(database);
  const sessions = await repository.listSessionsByProject(projectId);
  const session = [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (session === undefined) return undefined;
  const [sources, evidence, observations, insights, opportunities, seeds] = await Promise.all([
    repository.listSourcesBySession(session.id), repository.listEvidenceBySession(session.id), repository.listObservationsBySession(session.id),
    repository.listInsightsBySession(session.id), repository.listOpportunitiesBySession(session.id), repository.listSeedsBySession(session.id),
  ]);
  return { session, sources, evidence, observations, insights, opportunities, seeds };
}

const observationGroups = [
  ["目标受众", "受众"], ["核心语境", "语境"], ["竞品观察", "竞品"], ["视觉景观", "视觉"],
  ["文化线索", "文化"], ["趋势判断", "趋势"], ["限制条件", "限制"],
] as const;

export interface ResearchPageProps { readonly loader?: (projectId: ProjectId) => Promise<ResearchViewModel | undefined>; readonly runtime?: PhaseOneRuntimeService; }

export function ResearchPage({ loader = loadResearchView, runtime }: ResearchPageProps) {
  const { projectId } = useParams();
  const workflow = useMemo(() => runtime ?? new PhaseOneRuntimeService(), [runtime]);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<{ readonly status: "loading" | "empty" | "success" | "error"; readonly data?: ResearchViewModel; readonly message?: string }>({ status: "loading" });
  useEffect(() => {
    if (!isEntityId(projectId)) { setState({ status: "error", message: "项目链接无效" }); return; }
    let active = true;
    loader(asProjectId(projectId)).then((data) => { if (active) setState(data === undefined ? { status: "empty" } : { status: "success", data }); }).catch((error: unknown) => { if (active) setState({ status: "error", message: error instanceof Error ? error.message : "研究加载失败" }); });
    return () => { active = false; };
  }, [loader, projectId]);
  if (state.status === "loading") return <AppShell><main className="research-page"><LoadingState title="正在读取研究实体" description="正在恢复来源、证据与洞察关系。" /></main></AppShell>;
  if (state.status === "error") return <AppShell><main className="research-page"><ErrorState title="研究加载失败" description={state.message} /></main></AppShell>;
  if (state.status === "empty" || state.data === undefined) return <AppShell><main className="research-page"><EmptyState title="从项目简报生成第一轮研究" description="Muse 将基于已确认的目标建立来源、证据、观察、洞察和机会链。" action={<Button icon={Network} loading={running} disabled={!isEntityId(projectId)} onClick={() => { if (!isEntityId(projectId)) return; setRunning(true); void workflow.runResearch(asProjectId(projectId)).then(() => loader(asProjectId(projectId))).then((data) => setState(data ? { status: "success", data } : { status: "empty" })).catch((reason: unknown) => setState({ status: "error", message: reason instanceof Error ? reason.message : "研究生成失败" })).finally(() => setRunning(false)); }}>生成研究</Button>} /></main></AppShell>;
  const data = state.data;
  const addToCanvas = (entityType: ResearchCanvasEntityType, entityId: ResearchInsight["id"]) => {
    if (!isEntityId(projectId)) return;
    void new AddEntityNodeCommand().execute({ projectId: asProjectId(projectId), entityType, entityId });
  };
  return (
    <AppShell>
      <main className="research-page" aria-labelledby="research-title">
        <header className="research-heading"><div><p>Research · 可追溯研究链</p><h1 id="research-title">研究</h1></div><StatusPill status="ai">离线确定性研究</StatusPill><span>{data.session.query}</span></header>
        <section className="research-understanding"><span>01 · 项目理解</span><h2>研究命题</h2><p>{data.session.query}</p></section>
        <section className="research-block"><div className="research-block__heading"><span>02</span><div><h2>观察图谱</h2><p>从受众、文化、语境和视觉景观中识别可行动证据。</p></div></div><div className="research-observation-grid">{observationGroups.map(([title, category]) => {
          const items = data.observations.filter((item) => item.statement.startsWith(`${category}｜`));
          return <article key={category}><h3>{title}</h3>{items.length ? items.map((item) => <div key={item.id} data-entity-id={item.id}><p>{item.statement.replace(`${category}｜`, "")}</p><details><summary>查看证据链</summary>{data.evidence.filter((evidence) => item.evidenceIds.includes(evidence.id)).map((evidence) => <p key={evidence.id}>{evidence.excerpt}</p>)}</details></div>) : <p className="muted">本轮暂无该类观察</p>}</article>;
        })}</div></section>
        <section className="research-block research-block--priority"><div className="research-block__heading"><span>03</span><div><h2>洞察与机会</h2><p>将观察转化为可进入设计决策的判断。</p></div></div><div className="research-decision-grid"><div><h3>设计洞察</h3>{data.insights.map((item) => <article key={item.id} data-entity-id={item.id}><p>{item.statement}</p><details><summary>查看观察依据</summary>{data.observations.filter((observation) => item.observationIds.includes(observation.id)).map((observation) => <p key={observation.id}>{observation.statement.replace(/^.+?｜/, "")}</p>)}</details><Button variant="quiet" icon={Plus} onClick={() => addToCanvas("ResearchInsight", item.id)}>添加到画布</Button></article>)}</div><div><h3>机会点</h3>{data.opportunities.map((item) => <article key={item.id} data-entity-id={item.id}><p>{item.statement}</p><details><summary>查看洞察依据</summary>{data.insights.filter((insight) => item.insightIds.includes(insight.id)).map((insight) => <p key={insight.id}>{insight.statement}</p>)}</details><Button variant="quiet" icon={Plus} onClick={() => addToCanvas("ResearchOpportunity", item.id)}>添加到画布</Button></article>)}</div></div></section>
        <section className="research-block"><div className="research-block__heading"><span>04</span><div><h2>创意种子</h2><p>可以继续转译为情绪板与创意方向的起点。</p></div></div><div className="research-seed-grid">{data.seeds.map((item) => <article key={item.id} data-entity-id={item.id}><StatusPill status="ai">Creative Seed</StatusPill><h3>{item.title}</h3><p>{item.premise}</p><Button icon={ArrowRight} onClick={() => addToCanvas("CreativeSeed", item.id)}>添加到决策地图</Button></article>)}</div></section>
        <section className="research-block"><div className="research-block__heading"><span>05</span><div><h2>来源与证据</h2><p>离线假设均明确标注，等待后续真实研究核验。</p></div></div><div className="research-source-grid">{data.sources.map((source) => <article key={source.id}><h3>{source.title}</h3>{data.evidence.filter((item) => item.sourceId === source.id).map((item) => <p key={item.id}>{item.excerpt}<small>{item.locator ?? "待核验"}</small></p>)}</article>)}</div></section>
      </main>
    </AppShell>
  );
}
