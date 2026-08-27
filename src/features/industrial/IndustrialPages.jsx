import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, CheckCircle2, ChevronRight, CircleAlert, Edit3, ExternalLink, FileText, Link2, LockKeyhole, RefreshCw, Save, Search, Sparkles, Upload, X } from "lucide-react";
import { AppShell } from "../../components/shell";
import { StatusPill } from "../../components/ui.jsx";
import { AiProviderStatus } from "../../components/ai/AiProviderStatus";
import { JINGANBAO_PROJECT_ID } from "../../data/jinganbao";
import { MuseAiClient } from "../../lib/api/museAiClient";
import { researchSourceTypeLabel } from "../../lib/ai/researchEvidenceProvider";
import { isDemoPortfolioProject } from "../../data/demoVisuals";
import { buildProjectBrain } from "../../services/ai/projectBrain";
import { originLabel } from "../../services/ai/contentOrigin";
import { useMuseStore } from "../../stores/useMuseStore";

const stageRoutes = {
  brief: "brief", research: "research", insight: "insight", direction: "direction",
  concept: "concept", cmf: "cmf", review: "review", versions: "versions",
};

const aiClient = new MuseAiClient();

function assetSrc(url) {
  if (!url || /^(data|blob):/i.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=2`;
}

const stageNames = {
  brief: "设计简报", research: "研究证据", insight: "设计洞察", direction: "设计方向",
  concept: "产品概念", cmf: "材料与色彩", review: "设计评审", versions: "版本记录",
  "decision-map": "决策地图",
};

function materialLanguageFor(project) {
  const signature = `${project?.projectType ?? ""} ${project?.category ?? ""} ${project?.name ?? ""}`.toLowerCase();
  if (/(brand|space|spatial|品牌|空间|快闪|展陈)/.test(signature)) return { eyebrow: "06 · 色彩与材质语言", title: "让品牌、空间与材质形成同一套感知规则", noun: "色彩与材质语言" };
  if (/(digital|app|web|service|数字|软件|界面)/.test(signature)) return { eyebrow: "06 · 视觉系统", title: "让界面色彩、字体与状态反馈形成可执行系统", noun: "视觉系统" };
  return { eyebrow: "06 · CMF", title: "让材料、颜色与表面处理回应结构与使用风险", noun: "CMF" };
}

function materialSwatch(color) {
  const value = String(color ?? "");
  if (/蓝|雾|青|水/i.test(value)) return "#7898b6";
  if (/绿|苔|叶|松针/i.test(value)) return "#7f9f8d";
  if (/橙|陶土|琥珀/i.test(value)) return "#b88758";
  if (/黑|炭|深灰|石墨/i.test(value)) return "#343a3e";
  if (/白|奶油|冷白|浅灰/i.test(value)) return "#d6d4ca";
  if (/棕|木|温灰|沙砾/i.test(value)) return "#8d7864";
  return "#a7b8b7";
}

function materialValidationLabel(part) {
  const explicit = String(part?.validation ?? "").trim();
  if (explicit) return explicit;
  const state = String(part?.validationState ?? "").trim().replaceAll("_", " ");
  return state && state !== "TO BE VALIDATED" && state !== "AI RECOMMENDATION" ? state : "验证目标";
}

function useIndustrialProject() {
  const { projectId = JINGANBAO_PROJECT_ID } = useParams();
  const project = useMuseStore((state) => state.projects.find((item) => item.id === projectId));
  return { projectId, project, industrial: project?.industrial };
}

function StateBoundary({ project, children }) {
  if (!project) return <div className="industrial-loading">正在载入项目…</div>;
  if (!project.industrial) return <div className="industrial-loading">该项目还没有工业设计工作流。</div>;
  return children;
}

function IndustrialContextRail({ project, industrial, brain, stage }) {
  const navigate = useNavigate();
  const currentStage = stageNames[stage] ? stage : "overview";
  const currentLabel = currentStage === "overview" ? "项目概览" : stageNames[currentStage];
  const stageOrder = ["brief", "research", "insight", "direction", "concept", "cmf", "review", "versions", "decision-map"];
  const completedStages = new Set(industrial?.completedStages ?? []);
  const currentIndex = stageOrder.indexOf(currentStage);
  const conversion = workflowConversions[currentStage];
  const nextReady = conversion?.ready?.(industrial, brain) ?? false;
  const metrics = [
    ["已采纳证据", brain?.acceptedEvidence?.length ?? 0],
    ["已确认洞察", brain?.confirmedInsights?.length ?? 0],
    ["已形成决策", brain?.decisions?.length ?? 0],
  ];

  return <div className="industrial-context-rail" data-context-rail>
    <div className="industrial-context-rail__intro">
      <p className="industrial-context-rail__eyebrow">PROJECT CONTEXT</p>
      <h2>{project.name}</h2>
      <p>围绕当前项目，把已经确认的依据、正在处理的阶段与下一步动作放在同一条工作线上。</p>
    </div>

    <section className="industrial-context-rail__current" aria-label="当前工作阶段">
      <div className="industrial-context-rail__section-label">当前工作</div>
      <div className="industrial-context-rail__current-title">
        <span>{currentLabel}</span>
        {currentIndex >= 0 ? <small>{String(currentIndex + 1).padStart(2, "0")} / {stageOrder.length}</small> : <small>主线入口</small>}
      </div>
      <p>{conversion?.body ?? "先确认项目上下文，再进入下一轮设计判断。"}</p>
      <div className="industrial-context-rail__progress" aria-label={`已完成 ${completedStages.size} 个阶段`}>
        <span style={{ width: `${Math.max(8, Math.min(100, completedStages.size / stageOrder.length * 100))}%` }}/>
      </div>
      <small className="industrial-context-rail__progress-label">{completedStages.size} / {stageOrder.length} 个工作阶段已形成记录</small>
    </section>

    <section className="industrial-context-rail__metrics" aria-label="项目决策摘要">
      <div className="industrial-context-rail__section-label">决策摘要</div>
      <div className="industrial-context-rail__metric-grid">
        {metrics.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
    </section>

    <section className="industrial-context-rail__stages" aria-label="项目工作阶段">
      <div className="industrial-context-rail__section-label">工作路径</div>
      <ol>
        {stageOrder.map((item, index) => <li key={item} className={`${item === currentStage ? "is-current" : ""} ${completedStages.has(item) ? "is-complete" : ""}`}>
          <span className="industrial-context-rail__stage-mark">{completedStages.has(item) ? <Check size={12}/> : String(index + 1).padStart(2, "0")}</span>
          <span>{stageNames[item]}</span>
          {item === currentStage ? <span className="industrial-context-rail__stage-state">当前</span> : null}
        </li>)}
      </ol>
    </section>

    {conversion ? <section className="industrial-context-rail__next" aria-label="下一步工作">
      <div className="industrial-context-rail__section-label">下一步</div>
      <h3>{conversion.title}</h3>
      <button disabled={!nextReady} onClick={() => navigate(`/projects/${project.id}/${conversion.target}`)}>
        {nextReady ? conversion.label : "完成当前确认后解锁"}<ArrowRight size={15}/>
      </button>
    </section> : null}
  </div>;
}

function Page({ project, eyebrow, title, description, children, actions, showWorkflowConversion = true, showAiToolbar = true }) {
  const { pathname } = useLocation();
  const stage = pathname.split("/").filter(Boolean).at(-1);
  const aiJob = useMuseStore((state) => state.aiJob);
  const generateBrief = useMuseStore((state) => state.generateIndustrialBrief);
  const generateDirections = useMuseStore((state) => state.generateIndustrialDirections);
  const generateConcepts = useMuseStore((state) => state.generateIndustrialConcepts);
  const generateCmf = useMuseStore((state) => state.generateIndustrialCmf);
  const generateResearch = useMuseStore((state) => state.generateIndustrialResearch);
  const generateInsights = useMuseStore((state) => state.generateIndustrialInsights);
  const [aiCapabilities, setAiCapabilities] = useState(null);
  const brain = useMemo(() => project ? buildProjectBrain(project) : null, [project]);
  const aiAction = stage === "brief" ? generateBrief : stage === "research" ? generateResearch : stage === "insight" ? generateInsights : stage === "direction" ? generateDirections : stage === "concept" ? generateConcepts : stage === "cmf" ? generateCmf : null;
  const aiLabel = stage === "brief" ? "整理 Brief" : stage === "research" ? "重新解读证据" : stage === "insight" ? "重新生成洞察" : stage === "direction" ? "重新生成方向" : stage === "concept" ? "重新生成概念" : stage === "cmf" ? "重新生成 CMF" : "";
  const textAiReady = Boolean(aiCapabilities?.providers?.text?.ready);
  return <AppShell project={project} mode="industrial" context={<IndustrialContextRail project={project} industrial={project.industrial} brain={brain} stage={stage}/> }>
    <div className="industrial-page">
      <header className="industrial-page__header">
        <div><p className="industrial-kicker">{eyebrow} {import.meta.env.DEV && brain?.contentOrigin ? <span className="industrial-origin-badge">DEV · {originLabel(brain.contentOrigin)}</span> : null}</p><h1>{title}</h1><p>{description}</p></div>
        {actions ? <div className="industrial-actions">{actions}</div> : null}
      </header>
      {aiAction && showAiToolbar ? <div className="industrial-ai-toolbar"><span>{aiJob.message || "内容会根据当前项目上下文生成，并保留人工确认"}</span><AiProviderStatus client={aiClient} onChange={setAiCapabilities}/><button title={textAiReady ? undefined : "请先在设置中连接 DeepSeek Text AI"} disabled={aiJob.status === "processing" || !textAiReady} onClick={() => void aiAction(project.id)}><Sparkles size={15}/>{textAiReady ? aiLabel : "文字 AI 未连接"}</button></div> : null}
      {children}
      {showWorkflowConversion ? <WorkflowConversion project={project} industrial={project.industrial}/> : null}
    </div>
  </AppShell>;
}

function PrimaryButton({ children, ...props }) {
  return <button className="industrial-button industrial-button--primary" {...props}>{children}<ArrowRight size={16}/></button>;
}

function SecondaryButton({ children, ...props }) {
  return <button className="industrial-button" {...props}>{children}</button>;
}

function ConceptImageButton({ projectId, conceptId, count = 0, demoMode = false }) {
  const aiJob = useMuseStore((state) => state.aiJob);
  const generate = useMuseStore((state) => state.generateIndustrialConceptImage);
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    void aiClient.capabilities(controller.signal).then(setCapabilities).catch((error) => {
      if (error?.name !== "AbortError") setCapabilities(null);
    });
    return () => controller.abort();
  }, []);
  const isGenerating = aiJob.status === "processing";
  const ready = demoMode || Boolean(capabilities?.providers?.text?.ready && capabilities?.providers?.image?.ready);
  return <button className="industrial-button--quiet" disabled={isGenerating} onClick={() => ready ? void generate(projectId, conceptId) : navigate("/settings?tab=provider")}>
    {isGenerating ? (demoMode ? "准备视觉探索…" : "真实生成中…") : !ready ? "连接真实 AI 后生成" : demoMode ? (count ? "查看视觉探索" : "准备视觉探索") : count >= 4 ? "重新检查视觉" : count ? `继续补齐 ${count}/4` : "生成 4 张真实产品图"}
  </button>;
}

function ChoiceMark({ selected }) {
  return <span className={`industrial-choice ${selected ? "is-selected" : ""}`}>{selected ? <Check size={14}/> : null}</span>;
}

const workflowConversions = {
  overview: {
    target: "brief", eyebrow: "下一步工作", title: "先把设计意图冻结成简报",
    body: "明确目标用户、核心场景与验证边界，后续研究才不会变成素材堆积。",
    label: "进入设计简报", ready: () => true,
  },
  brief: {
    target: "research", eyebrow: "下一步工作", title: "把简报变成可追溯的研究证据",
    body: "确认设计问题后，研究证据才会有筛选标准，并能真正影响后续洞察。",
    label: "进入研究证据", ready: (industrial) => industrial.briefConfirmed,
  },
  research: {
    target: "insight", eyebrow: "下一步工作", title: "从证据中提炼值得验证的洞察",
    body: "把观察与来源收敛成少量机会点，帮助团队停止堆素材，开始做设计判断。",
    label: "进入设计洞察", ready: (industrial) => industrial.briefConfirmed,
  },
  insight: {
    target: "direction", eyebrow: "下一步工作", title: "用已确认的洞察锁定设计方向",
    body: "选中的洞察会成为方向比较的依据，避免概念选择退化成单纯的视觉偏好。",
    label: "进入设计方向", ready: (_industrial, brain) => brain.confirmedInsights.length > 0,
  },
  direction: {
    target: "concept", eyebrow: "下一步工作", title: "将已选方向发展为具体概念",
    body: "下一阶段将沿用当前方向的设计逻辑继续展开，而不是重新生成一套无关方案。",
    label: "进入概念探索", ready: (industrial) => Boolean(industrial.selectedDirectionId),
  },
  concept: {
    target: "cmf", eyebrow: "下一步工作", title: "为概念补齐材料、色彩与触感",
    body: "CMF 不是换皮，而是把握持、洁净感与耐用性这些产品承诺落到可评审的材料语言。",
    label: "进入材料与色彩", ready: (industrial) => Boolean(industrial.selectedConceptId),
  },
  cmf: {
    target: "review", eyebrow: "下一步工作", title: "带着完整方案进入设计评审",
    body: "将概念与 CMF 组合成一份可追问的方案，再用评审记录决定是否进入版本沉淀。",
    label: "进入设计评审", ready: (industrial) => Boolean(industrial.selectedCMFId),
  },
  review: {
    target: "versions", eyebrow: "下一步工作", title: "把评审结论沉淀成下一版决策",
    body: "完成评审后再记录版本变化，让每次采纳、保留与否决都能回到证据和设计取舍。",
    label: "查看版本记录", ready: (industrial) => Boolean(industrial.currentReviewId),
  },
  versions: {
    target: "decision-map", eyebrow: "下一步工作", title: "查看这轮决策如何改变项目",
    body: "在决策地图中回看证据、洞察、方向与版本之间的因果链，准备下一轮验证。",
    label: "查看决策地图", ready: () => true,
  },
  "decision-map": {
    target: "overview", eyebrow: "回到项目主线", title: "重新开始下一轮设计决策",
    body: "回到项目概览，确认当前阶段和最近一次改变，再决定下一步要验证什么。",
    label: "回到项目概览", ready: () => true,
  },
};

function WorkflowConversion({ project, industrial }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentStage = pathname.split("/").filter(Boolean).at(-1);
  const conversion = workflowConversions[currentStage];
  if (!conversion) return null;
  const brain = useMemo(() => buildProjectBrain(project), [project]);
  const ready = conversion.ready(industrial, brain);
  return <section className={`industrial-next-step ${ready ? "" : "is-locked"}`} data-cta="workflow-next-step">
    <div>
      <p className="industrial-next-step__eyebrow">{conversion.eyebrow}</p>
      <h2>{conversion.title}</h2>
      <p>{conversion.body}</p>
      {!ready ? <small>完成本页确认后解锁下一步。</small> : null}
    </div>
    <button disabled={!ready} onClick={() => navigate(`/projects/${project.id}/${conversion.target}`)}>
      {conversion.label}<ArrowRight size={17}/>
    </button>
  </section>;
}

export function IndustrialProjectsPage() {
  const navigate = useNavigate();
  const allProjects = useMuseStore((state) => state.projects);
  const projects = useMemo(
    () => allProjects.filter((item) => item.productDiscipline === "industrial"),
    [allProjects],
  );
  return <AppShell mode="industrial">
    <div className="industrial-page industrial-projects">
      <header className="industrial-page__header"><div><p className="industrial-kicker">MUSE INDUSTRIAL V2</p><h1>工业设计项目</h1><p>项目完成度以“已形成并改变后续工作的决策”计算，而不是页面数量。</p></div></header>
      <div className="industrial-project-grid">
        {projects.map((project) => {
          const state = project.industrial;
          const completed = state.completedStages?.length ?? 0;
          return <article className="industrial-project-card" key={project.id}>
            <img src={assetSrc(project.coverImage || "/assets/projects/project-flow-horizon-v1.png")} alt={`${project.name}产品概念`}/>
            <div><p className="industrial-kicker">完整流程 · {completed}/9 个关键决策</p><h2>{project.name}</h2><p>{project.description}</p>
              <div className="industrial-progress"><span style={{ width: `${Math.max(8, completed / 9 * 100)}%` }}/></div>
              <button onClick={() => navigate(`/projects/${project.id}/overview`)}>继续当前决策 <ChevronRight size={17}/></button>
            </div>
          </article>;
        })}
      </div>
    </div>
  </AppShell>;
}

function splitOverviewList(value) {
  return [...new Set(String(value ?? "").split(/[，,、;；\n]/).map((item) => item.trim()).filter(Boolean))];
}

function joinOverviewList(value) {
  return Array.isArray(value) ? value.join("、") : "";
}

function OverviewSection({ eyebrow, title, className = "", children }) {
  return <section className={`project-overview__section ${className}`.trim()}>
    <div className="project-overview__section-heading"><p className="industrial-kicker">{eyebrow}</p><h2>{title}</h2></div>
    {children}
  </section>;
}

function OverviewList({ items, empty = "原始需求未提供" }) {
  if (!items?.length) return <p className="project-overview__empty">{empty}</p>;
  return <ul className="project-overview__list">{items.map((item, index) => <li key={`${item?.id ?? item}-${index}`}>{item?.label ?? item}</li>)}</ul>;
}

function overviewLabels(items = []) { return items.map((item) => item?.label ?? item).filter(Boolean); }

function OriginBadge({ origin }) {
  if (!origin) return null;
  const labels = { explicit: "用户定义", inferred: "Muse 理解", suggested: "Muse 建议" };
  return <span className={`project-overview__origin project-overview__origin--${origin}`}>{labels[origin] ?? origin}</span>;
}

function OverviewProgressStrip({ industrial }) {
  const stages = ["brief", "research", "insight", "direction", "concept", "cmf", "review", "versions", "decision-map"];
  return <section className="project-overview__progress" aria-label="项目工作区进度">
    <div className="project-overview__progress-header"><span>项目工作区</span><strong>{industrial.completedStages?.length ?? 0} / 9 个决策节点已形成</strong></div>
    <div className="project-overview__progress-line">{stages.map((stage, index) => <div className={industrial.completedStages?.includes(stage) ? "is-complete" : industrial.currentStage === stage ? "is-current" : ""} key={stage}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stageNames[stage]}</strong></div>)}</div>
  </section>;
}

function OriginalBriefDrawer({ project, sourceBrief, onClose, onSave }) {
  const snapshot = project.originalBrief ?? {};
  const [form, setForm] = useState({
    projectName: project.name ?? snapshot.projectName ?? "",
    designGoal: snapshot.designGoal ?? sourceBrief?.goal ?? project.description ?? "",
    audience: snapshot.audience ?? sourceBrief?.audience ?? "",
    context: snapshot.context ?? sourceBrief?.context ?? "",
    deliverables: joinOverviewList(snapshot.deliverables ?? sourceBrief?.deliverables),
    constraints: joinOverviewList(snapshot.constraints ?? sourceBrief?.constraints),
    keywords: joinOverviewList(snapshot.keywords ?? sourceBrief?.keywords),
    avoid: joinOverviewList(snapshot.avoid ?? sourceBrief?.avoid),
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="project-overview__drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="project-overview__drawer" aria-label="原始需求">
      <header><div><p className="industrial-kicker">Original Brief</p><h2>原始需求</h2><p>这里保留用户真正输入的内容。修改后不会自动覆盖项目概览。</p></div><button className="project-overview__icon-button" onClick={onClose} aria-label="关闭原始需求"><X size={19}/></button></header>
      <div className="project-overview__drawer-form">
        <label>项目名称<input value={form.projectName} onChange={(event) => update("projectName", event.target.value)}/></label>
        <label>设计目标<textarea rows={5} value={form.designGoal} onChange={(event) => update("designGoal", event.target.value)}/></label>
        <label>目标用户<input value={form.audience} onChange={(event) => update("audience", event.target.value)}/></label>
        <label>项目背景 / 使用场景<textarea rows={3} value={form.context} onChange={(event) => update("context", event.target.value)}/></label>
        <label>预期交付物<textarea rows={2} value={form.deliverables} onChange={(event) => update("deliverables", event.target.value)} placeholder="用顿号、逗号或换行分隔"/></label>
        <label>限制条件<textarea rows={2} value={form.constraints} onChange={(event) => update("constraints", event.target.value)} placeholder="用顿号、逗号或换行分隔"/></label>
        <label>设计关键词<input value={form.keywords} onChange={(event) => update("keywords", event.target.value)}/></label>
        <label>避免项<input value={form.avoid} onChange={(event) => update("avoid", event.target.value)}/></label>
      </div>
      <footer><button className="industrial-button" onClick={onClose}>暂不修改</button><button className="industrial-button industrial-button--primary" onClick={() => onSave({ ...form, deliverables: splitOverviewList(form.deliverables), constraints: splitOverviewList(form.constraints), keywords: splitOverviewList(form.keywords), avoid: splitOverviewList(form.avoid) })}><Save size={16}/>保存原始需求</button></footer>
    </aside>
  </div>;
}

function OverviewEditorDrawer({ overview, onClose, onSave }) {
  const [form, setForm] = useState({
    projectSummary: overview.projectSummary,
    designGoal: overview.designGoal,
    conflictTitle: overview.coreConflict.title,
    conflictExplanation: overview.coreConflict.explanation,
    targetPrimary: overview.targetUser.primary,
    targetTraits: joinOverviewList(overview.targetUser.traits),
    keywords: joinOverviewList(overview.keywords),
    mustKeep: joinOverviewList(overviewLabels(overview.designConstants?.length ? overview.designConstants : overview.mustKeep)),
    mustAvoid: joinOverviewList(overviewLabels(overview.designExclusions?.length ? overview.designExclusions : overview.mustAvoid)),
    deliverables: joinOverviewList(overview.deliverables),
    successCriteria: joinOverviewList(overview.successCriteria),
    openQuestions: joinOverviewList(overview.openQuestions),
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const listFields = new Set(["targetTraits", "keywords", "mustKeep", "mustAvoid", "deliverables", "successCriteria", "openQuestions"]);
  return <div className="project-overview__drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="project-overview__drawer project-overview__drawer--wide" aria-label="编辑项目概览">
      <header><div><p className="industrial-kicker">Project Overview</p><h2>编辑项目概览</h2><p>人工修改会被保留；之后点击重新生成时，已编辑字段不会被自动覆盖。</p></div><button className="project-overview__icon-button" onClick={onClose} aria-label="关闭编辑"><X size={19}/></button></header>
      <div className="project-overview__drawer-form">
        <label>项目摘要<textarea rows={3} value={form.projectSummary} onChange={(event) => update("projectSummary", event.target.value)}/></label>
        <label>设计目标<textarea rows={4} value={form.designGoal} onChange={(event) => update("designGoal", event.target.value)}/></label>
        <div className="project-overview__drawer-grid"><label>核心冲突标题<input value={form.conflictTitle} onChange={(event) => update("conflictTitle", event.target.value)}/></label><label>核心用户<input value={form.targetPrimary} onChange={(event) => update("targetPrimary", event.target.value)}/></label></div>
        <label>核心冲突解释<textarea rows={3} value={form.conflictExplanation} onChange={(event) => update("conflictExplanation", event.target.value)}/></label>
        {[["targetTraits", "用户特征"], ["keywords", "关键词"], ["mustKeep", "设计常量"], ["mustAvoid", "设计排除项"], ["deliverables", "预期成果"], ["successCriteria", "成功标准"], ["openQuestions", "待确认问题"]].map(([key, label]) => <label key={key}>{label}<textarea rows={2} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder="用顿号、逗号或换行分隔"/></label>)}
      </div>
      <footer><button className="industrial-button" onClick={onClose}>取消</button><button className="industrial-button industrial-button--primary" onClick={() => onSave({ projectSummary: form.projectSummary, designGoal: form.designGoal, coreConflict: { title: form.conflictTitle, explanation: form.conflictExplanation }, targetUser: { primary: form.targetPrimary, traits: splitOverviewList(form.targetTraits) }, ...Object.fromEntries([...listFields].filter((key) => !["targetTraits"].includes(key)).map((key) => [key, splitOverviewList(form[key])])) })}><Save size={16}/>保存概览</button></footer>
    </aside>
  </div>;
}

export function IndustrialOverviewPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const sourceBrief = useMuseStore((state) => state.briefs.find((item) => item.projectId === projectId));
  const generateOverview = useMuseStore((state) => state.generateProjectOverview);
  const updateOverview = useMuseStore((state) => state.updateProjectOverview);
  const dismissOverviewStale = useMuseStore((state) => state.dismissProjectOverviewStale);
  const updateOriginalBrief = useMuseStore((state) => state.updateOriginalBrief);
  const confirmUnderstanding = useMuseStore((state) => state.confirmProjectUnderstanding);
  const selectUnderstandingVersion = useMuseStore((state) => state.selectProjectUnderstandingVersion);
  const acceptOutcome = useMuseStore((state) => state.acceptProjectOutcomeSuggestion);
  const ensureProject = useMuseStore((state) => state.ensureIndustrialProject);
  const aiJob = useMuseStore((state) => state.aiJob);
  const [drawer, setDrawer] = useState(null);
  const autoGenerationAttempted = useRef(false);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (!project || !industrial || project.projectOverview || project.projectUnderstandingStatus === "error" || autoGenerationAttempted.current) return;
    autoGenerationAttempted.current = true;
    void generateOverview(projectId).catch(() => undefined);
  }, [generateOverview, industrial, project, projectId]);

  useEffect(() => {
    if (!project || !industrial || migrationAttempted.current) return;
    migrationAttempted.current = true;
    void ensureProject(projectId).catch(() => undefined);
  }, [ensureProject, industrial, project, projectId]);

  if (!project) return <StateBoundary project={project}/>;
  if (!industrial) return <StateBoundary project={project}/>;
  const overview = project.projectOverview;
  if (!overview) return <Page project={project} eyebrow="项目概览" title="正在形成项目理解" description="正在从原始需求中提取目标、用户、核心冲突与交付边界。" showWorkflowConversion={false}><div className="project-overview__loading"><Sparkles size={20}/><strong>{project.projectUnderstandingStatus === "error" ? "项目已创建，但 AI 项目理解暂时生成失败" : "正在理解项目"}</strong><p>{project.projectUnderstandingError || (aiJob.status === "failed" ? aiJob.message : "概览生成完成前不会创建图片，也不会改变其他工作区内容。")}</p>{project.projectUnderstandingStatus === "error" || aiJob.status === "failed" ? <button className="industrial-button" onClick={() => void generateOverview(projectId)}><RefreshCw size={16}/>重新生成理解</button> : null}</div></Page>;

  const requiresUnderstandingGate = Boolean(project.isDraft || project.projectUnderstandingStatus || project.projectUnderstandingVersions?.length);
  const understandingConfirmed = !requiresUnderstandingGate || Boolean(project.projectUnderstandingConfirmedAt);
  const currentConversion = !understandingConfirmed
    ? { target: "brief", label: "确认并继续" }
    : industrial.currentStage === "brief" && !industrial.briefConfirmed
    ? { target: "brief", label: "开始设计简报" }
    : workflowConversions[industrial.currentStage] ?? workflowConversions.overview;
  const targetPath = currentConversion.target === "overview" ? "overview" : (stageRoutes[currentConversion.target] ?? currentConversion.target);
  const metadata = [overview.location, overview.timeContext].filter(Boolean).join(" · ");
  const saveOverview = async (patch) => { await updateOverview(projectId, patch); setDrawer(null); };
  const saveOriginalBrief = async (patch) => { await updateOriginalBrief(projectId, patch); setDrawer(null); };
  const continueFromUnderstanding = async () => {
    try {
      await confirmUnderstanding(projectId);
      navigate(`/projects/${projectId}/brief`);
    } catch (error) {
      useMuseStore.getState().pushToast(error?.message === "PROJECT_UNDERSTANDING_NOT_READY" ? "项目理解还没有生成完成" : "项目理解暂时无法确认，请重试", "warning");
    }
  };
  const currentVersions = project.projectUnderstandingVersions ?? [];
  const understandingFailed = project.projectUnderstandingStatus === "error";
  if (understandingFailed) {
    return <Page project={project} eyebrow="项目概览 · Project Overview" title="项目理解尚未生成" description="原始需求已保存；在获得真实 AI 结果或由你手动完成项目理解前，Muse 不会进入设计简报。" showWorkflowConversion={false} actions={<><SecondaryButton onClick={() => void generateOverview(projectId)}><RefreshCw size={15}/>重新生成理解</SecondaryButton><PrimaryButton onClick={() => setDrawer("edit")}>手动完善项目理解</PrimaryButton></>}>
      <main className="project-overview" aria-label="项目理解失败">
        <div className="project-overview__error" role="alert"><CircleAlert size={17}/><div><strong>AI 项目理解暂时生成失败。</strong><span>{project.projectUnderstandingError || "AI 服务暂时不可用，原始需求已安全保存。"}</span></div><button onClick={() => void generateOverview(projectId)}>重新生成</button></div>
        <section className="project-overview__identity"><div><p className="industrial-kicker">原始输入仍可编辑</p><h2>{project.originalBrief?.projectName || project.name}</h2><p>{project.originalBrief?.designGoal || project.description || "请补充设计目标后重新生成项目理解。"}</p></div></section>
        <footer className="project-overview__footer"><div><FileText size={18}/><div><strong>尚未生成可确认的 AI 建议</strong><p>不会展示本地模板或历史推断为 AI 结果，也不能继续进入研究与方向。</p></div></div><div><button className="industrial-button" onClick={() => setDrawer("original")}><FileText size={15}/>查看原始需求</button><button className="industrial-button" onClick={() => setDrawer("edit")}><Edit3 size={15}/>手动填写</button></div></footer>
      </main>
      {drawer === "original" ? <OriginalBriefDrawer project={project} sourceBrief={sourceBrief} onClose={() => setDrawer(null)} onSave={saveOriginalBrief}/> : null}
      {drawer === "edit" ? <OverviewEditorDrawer overview={overview} onClose={() => setDrawer(null)} onSave={saveOverview}/> : null}
    </Page>;
  }
  return <Page project={project} eyebrow="项目概览 · Project Overview" title={overview.projectName} description={`${overview.projectType.join(" · ")}${metadata ? `  ·  ${metadata}` : ""}  ·  ${understandingConfirmed ? "项目理解已确认" : "等待人工确认"}`} showWorkflowConversion={false} actions={<><SecondaryButton disabled={project.projectUnderstandingStatus === "running" || aiJob.status === "processing"} onClick={() => void generateOverview(projectId)}><RefreshCw size={15}/>重新生成理解</SecondaryButton>{understandingConfirmed ? <PrimaryButton onClick={() => navigate(`/projects/${projectId}/${targetPath}`)}>{currentConversion.label}</PrimaryButton> : <PrimaryButton onClick={() => void continueFromUnderstanding()}>确认并继续</PrimaryButton>}</>}>
    <main className="project-overview" aria-label="结构化项目概览">
      {project.overviewStale ? <div className="project-overview__notice"><CircleAlert size={17}/><span>原始需求已更新，当前项目概览尚未同步。</span><button onClick={() => void generateOverview(projectId)}>更新概览</button><button className="project-overview__notice-dismiss" onClick={() => void dismissOverviewStale(projectId)}>暂不更新</button></div> : null}
      {project.projectUnderstandingStatus === "error" ? <div className="project-overview__error" role="alert"><CircleAlert size={17}/><div><strong>项目已创建，但 AI 项目理解暂时生成失败。</strong><span>{project.projectUnderstandingError || "AI 服务暂时不可用，当前项目内容已保存。"}</span></div><button onClick={() => void generateOverview(projectId)}>重新生成</button><button onClick={() => setDrawer("edit")}>手动完善</button></div> : null}
      {!understandingConfirmed ? <div className="project-understanding-gate" role="status"><div><p className="industrial-kicker">HUMAN CONFIRMATION GATE</p><strong>请确认这一轮项目理解</strong><span>你可以编辑、删除或修改任意字段。只有点击“确认并继续”，Muse 才会读取它生成设计简报之后的阶段。</span></div><button className="industrial-button industrial-button--primary" onClick={() => void continueFromUnderstanding()}>确认并继续<ArrowRight size={16}/></button></div> : null}
      <section className="project-overview__identity">
        <div><p className="industrial-kicker">项目身份</p><h2>{overview.projectName}</h2><p>{overview.projectSummary}</p></div>
        <div className="project-overview__identity-meta">{overview.projectType.map((item) => <span key={item}>{item}</span>)}{metadata ? <small>{metadata}</small> : null}</div>
      </section>
      {currentVersions.length ? <section className="project-understanding-versions" aria-label="项目理解版本"><header><div><p className="industrial-kicker">AI GENERATE → HUMAN REVIEW</p><h2>理解版本</h2></div><span>当前 {currentVersions.find((item) => item.id === project.projectUnderstandingCurrentVersionId)?.version ? `V${currentVersions.find((item) => item.id === project.projectUnderstandingCurrentVersionId).version}` : "手动编辑"}</span></header><div>{currentVersions.slice().reverse().map((item) => <article key={item.id} className={item.id === project.projectUnderstandingCurrentVersionId ? "is-current" : ""}><div><strong>V{item.version}</strong><span>{item.source === "live" ? "Text AI" : "人工编辑"} · {new Date(item.createdAt).toLocaleString("zh-CN")}</span></div><button type="button" disabled={item.id === project.projectUnderstandingCurrentVersionId} onClick={() => void selectUnderstandingVersion(projectId, item.id)}>{item.id === project.projectUnderstandingCurrentVersionId ? "当前版本" : "设为当前版本"}</button></article>)}</div></section> : null}
      <section className="project-overview__goal-row">
        <OverviewSection eyebrow="设计目标" title="这次项目要改变什么"><p className="project-overview__lead">{overview.designGoal}</p></OverviewSection>
        <OverviewSection eyebrow="核心冲突" title={overview.coreConflict.title}><p>{overview.coreConflict.explanation}</p></OverviewSection>
      </section>
      <section className="project-overview__user-row">
        <OverviewSection eyebrow="目标用户" title="主要服务谁"><h3>{overview.targetUser.primary}</h3><div className="project-overview__chips">{overview.targetUser.traits.map((item) => <span key={item}>{item}</span>)}</div></OverviewSection>
        <OverviewSection eyebrow="关键词" title="需要被保留的气质"><div className="project-overview__chips project-overview__chips--large">{overview.keywords.map((item) => <span key={item}>{item}</span>)}</div></OverviewSection>
      </section>
      <section className="project-overview__keep-row">
        <OverviewSection eyebrow="设计常量 · Design Constants" title="设计判断的边界"><OverviewList items={overview.designConstants?.length ? overview.designConstants : overview.mustKeep}/></OverviewSection>
        <OverviewSection eyebrow="设计排除项 · Design Exclusions" title="已明确不采用的方向"><OverviewList items={overview.designExclusions?.length ? overview.designExclusions : overview.mustAvoid} empty="原始需求未提供明确排除项"/></OverviewSection>
      </section>
      <OverviewSection eyebrow="预期成果 · Expected Outcomes" title="项目完成后应该留下什么" className="project-overview__deliverables">
        <div className="project-overview__outcome-group"><div className="project-overview__subheading"><strong>用户已定义</strong><span>明确来自原始需求</span></div><div className="project-overview__deliverable-grid">{(overview.expectedOutcomes?.explicit ?? overview.deliverables.map((label, index) => ({ id: `fallback-${index}`, label, origin: "explicit" }))).map((item, index) => <div key={item.id ?? item.label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label ?? item}</strong><OriginBadge origin={item.origin}/></div>)}</div></div>
        {overview.expectedOutcomes?.suggested?.length ? <div className="project-overview__outcome-group project-overview__outcome-group--suggested"><div className="project-overview__subheading"><strong>Muse 建议补充</strong><span>需要你确认后才会进入项目</span></div><div className="project-overview__suggested-outcomes">{overview.expectedOutcomes.suggested.map((item) => <article key={item.id}><div><strong>{item.label}</strong><OriginBadge origin={item.origin}/><p>{item.rationale}</p></div><button className={item.accepted ? "is-accepted" : ""} onClick={() => void acceptOutcome(item.id, !item.accepted)}>{item.accepted ? "已加入项目" : "+ 加入项目"}</button></article>)}</div></div> : null}
      </OverviewSection>
      {overview.outcomeDefinition ? <OverviewSection eyebrow="项目完成定义 · Definition of Outcome" title="什么状态下可以认为结果完整" className="project-overview__outcome-definition"><p className="project-overview__lead">{overview.outcomeDefinition}</p></OverviewSection> : null}
      <section className="project-overview__criteria-row">
        <OverviewSection eyebrow="成功标准" title="如何判断方向成立"><OverviewList items={overview.successCriteria}/></OverviewSection>
        {overview.openQuestions.length ? <OverviewSection eyebrow="待确认问题" title="仍然不能被当作事实"><OverviewList items={overview.openQuestions}/></OverviewSection> : null}
      </section>
      <OverviewProgressStrip industrial={industrial}/>
      <section className="project-overview__decisions"><div className="project-overview__section-heading"><p className="industrial-kicker">最近的决策</p><h2>{industrial.decisions.length ? "已经改变项目的选择" : "项目还没有决策记录"}</h2></div>{industrial.decisions.length ? industrial.decisions.slice(-4).reverse().map((item) => <article key={item.id}><Check size={16}/><div><strong>{item.label}</strong><small>{new Date(item.at).toLocaleString("zh-CN")}</small></div></article>) : <p>先从设计简报确认第一条可追踪判断。</p>}</section>
      <footer className="project-overview__footer"><div><FileText size={18}/><div><strong>原始需求始终保留</strong><p>AI 概览是可编辑的理解层，不会替换你真正输入的目标、场景和限制。</p></div></div><div><button className="industrial-button" onClick={() => setDrawer("original")}><FileText size={15}/>查看原始需求</button><button className="industrial-button" onClick={() => setDrawer("edit")}><Edit3 size={15}/>编辑项目概览</button></div></footer>
    </main>
    {drawer === "original" ? <OriginalBriefDrawer project={project} sourceBrief={sourceBrief} onClose={() => setDrawer(null)} onSave={saveOriginalBrief}/> : null}
    {drawer === "edit" ? <OverviewEditorDrawer overview={overview} onClose={() => setDrawer(null)} onSave={saveOverview}/> : null}
  </Page>;
}

function BriefList({ items, empty = "" }) {
  const values = (items ?? []).filter((item) => item?.label ?? item);
  if (!values.length) return empty ? <p className="industrial-brief-empty">{empty}</p> : null;
  return <ul className="industrial-brief-list">{values.map((item, index) => <li key={item.id ?? `${item}-${index}`}><span>{item.label ?? item}</span>{item.origin ? <OriginBadge origin={item.origin}/> : null}</li>)}</ul>;
}

function BriefSection({ eyebrow, title, className = "", children, onEdit }) {
  return <section className={`design-brief-v2__section ${className}`.trim()}><header><div><p className="industrial-kicker">{eyebrow}</p><h2>{title}</h2></div>{onEdit ? <button className="design-brief-v2__edit" onClick={onEdit}><Edit3 size={14}/>编辑</button> : null}</header>{children}</section>;
}

function BriefEditorDrawer({ brief, onClose, onSave }) {
  const itemText = (items) => (items ?? []).map((item) => item.label ?? item).join("、");
  const [form, setForm] = useState({
    coreDesignQuestion: brief.coreDesignQuestion,
    designObjective: brief.designObjective,
    targetUser: brief.targetUser.primary,
    targetTraits: itemText(brief.targetUser.relevantTraits),
    coreScenario: brief.coreScenario,
    designRequirements: itemText(brief.designRequirements),
    designConstants: itemText(brief.designConstants),
    designExclusions: itemText(brief.designExclusions),
    successCriteria: itemText(brief.initialSuccessCriteria),
    researchQuestions: itemText(brief.researchQuestions),
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const list = (value) => splitOverviewList(value);
  const editItems = (value, existing, prefix) => list(value).map((label, index) => ({ id: existing?.[index]?.id ?? `${brief.projectId}-edited-${prefix}-${index + 1}`, label, origin: existing?.[index]?.origin ?? "explicit", ...(existing?.[index]?.status ? { status: existing[index].status } : {}) }));
  return <div className="project-overview__drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="project-overview__drawer project-overview__drawer--wide" aria-label="编辑设计简报">
      <header><div><p className="industrial-kicker">Design Brief V2</p><h2>编辑设计简报</h2><p>修改会进入人工确认流程；已确认简报的变更可能影响已有研究和后续判断。</p></div><button className="project-overview__icon-button" onClick={onClose} aria-label="关闭编辑"><X size={19}/></button></header>
      <div className="project-overview__drawer-form">
        <label>核心设计问题<textarea rows={3} value={form.coreDesignQuestion} onChange={(event) => update("coreDesignQuestion", event.target.value)}/></label>
        <label>设计目标<textarea rows={4} value={form.designObjective} onChange={(event) => update("designObjective", event.target.value)}/></label>
        <label>核心用户<input value={form.targetUser} onChange={(event) => update("targetUser", event.target.value)}/></label>
        <label>相关行为特征<textarea rows={2} value={form.targetTraits} onChange={(event) => update("targetTraits", event.target.value)} placeholder="用顿号、逗号或换行分隔"/></label>
        <label>核心场景<textarea rows={4} value={form.coreScenario} onChange={(event) => update("coreScenario", event.target.value)}/></label>
        {[['designRequirements', '设计要求'], ['designConstants', '设计常量'], ['designExclusions', '设计排除项'], ['successCriteria', '初始成功标准'], ['researchQuestions', '研究问题']].map(([key, label]) => <label key={key}>{label}<textarea rows={3} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder="用顿号、逗号或换行分隔"/></label>)}
      </div>
      <footer><button className="industrial-button" onClick={onClose}>取消</button><button className="industrial-button industrial-button--primary" onClick={() => onSave({ coreDesignQuestion: form.coreDesignQuestion, designObjective: form.designObjective, targetUser: { ...brief.targetUser, primary: form.targetUser, relevantTraits: list(form.targetTraits) }, coreScenario: form.coreScenario, designRequirements: editItems(form.designRequirements, brief.designRequirements, "requirements"), designConstants: editItems(form.designConstants, brief.designConstants, "constants"), designExclusions: editItems(form.designExclusions, brief.designExclusions, "exclusions"), initialSuccessCriteria: editItems(form.successCriteria, brief.initialSuccessCriteria, "criteria"), researchQuestions: editItems(form.researchQuestions, brief.researchQuestions, "questions") })}><Save size={16}/>保存并检查影响</button></footer>
    </aside>
  </div>;
}

function BriefOutcomeGroup({ title, items, suggested = false, onAccept }) {
  if (!items?.length) return null;
  return <div className={`design-brief-v2__outcomes ${suggested ? "is-suggested" : ""}`}><div className="design-brief-v2__subheading"><strong>{title}</strong><span>{suggested ? "确认后才会进入项目" : `${items.length} 项`}</span></div>{items.map((item) => <article key={item.id}><div><strong>{item.label}</strong>{item.category ? <small>{item.category}</small> : null}{item.rationale ? <p>{item.rationale}</p> : null}</div>{suggested && onAccept ? <button className={item.accepted ? "is-accepted" : ""} onClick={() => onAccept(item.id, !item.accepted)}>{item.accepted ? "已加入项目" : "+ 加入项目"}</button> : null}</article>)}</div>;
}

export function IndustrialBriefPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const brief = project?.designBrief;
  const understandingRequiresGate = Boolean(project?.isDraft || project?.projectUnderstandingStatus || project?.projectUnderstandingVersions?.length);
  const understandingConfirmed = !understandingRequiresGate || Boolean(project?.projectUnderstandingConfirmedAt);
  const generateBrief = useMuseStore((state) => state.generateIndustrialBrief);
  const ensureProject = useMuseStore((state) => state.ensureIndustrialProject);
  const updateBrief = useMuseStore((state) => state.updateDesignBrief);
  const confirmBrief = useMuseStore((state) => state.confirmDesignBrief);
  const createBriefVersion = useMuseStore((state) => state.createDesignBriefVersion);
  const acceptOutcome = useMuseStore((state) => state.acceptProjectOutcomeSuggestion);
  const [drawer, setDrawer] = useState(null);
  const [showTensionDetail, setShowTensionDetail] = useState(false);
  const [changeNotice, setChangeNotice] = useState(false);
  const autoGenerationAttempted = useRef(false);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (!project || !industrial || !understandingConfirmed || brief || autoGenerationAttempted.current) return;
    autoGenerationAttempted.current = true;
    void generateBrief(projectId).catch(() => undefined);
  }, [brief, generateBrief, industrial, project, projectId, understandingConfirmed]);

  useEffect(() => {
    if (!project || !industrial || migrationAttempted.current) return;
    migrationAttempted.current = true;
    void ensureProject(projectId).catch(() => undefined);
  }, [ensureProject, industrial, project, projectId]);

  if (!project) return <StateBoundary project={project}/>;
  if (!understandingConfirmed) return <Page project={project} eyebrow="设计简报" title="请先确认项目理解" description="设计简报只能使用你确认过的项目理解，避免未经验证的 AI 建议直接影响后续研究与方向。" showWorkflowConversion={false} showAiToolbar={false} actions={<PrimaryButton onClick={() => navigate(`/projects/${projectId}/overview`)}>返回项目概览</PrimaryButton>}><main className="project-overview"><div className="project-understanding-gate" role="status"><div><p className="industrial-kicker">HUMAN CONFIRMATION GATE</p><strong>项目理解尚未确认</strong><span>请在项目概览中检查、编辑或重新生成 AI 建议；确认后 Muse 才会创建设计简报。</span></div><PrimaryButton onClick={() => navigate(`/projects/${projectId}/overview`)}>去确认项目理解<ArrowRight size={16}/></PrimaryButton></div></main></Page>;
  if (!brief) return <Page project={project} eyebrow="设计简报" title="正在形成设计问题" description="Muse 正在分离用户事实、设计约束与工作流要求。" showWorkflowConversion={false} showAiToolbar={false}><div className="project-overview__loading"><Sparkles size={20}/><strong>正在生成设计简报</strong><p>没有完成前不会进入研究，也不会生成图片。</p></div></Page>;
  const save = async (patch) => { try { await updateBrief(projectId, patch); setDrawer(null); setChangeNotice(Boolean(project.briefStatus === "confirmed")); } catch (error) { setChangeNotice(true); } };
  const confirm = async () => { await confirmBrief(projectId); navigate(`/projects/${projectId}/research`); };
  const actionLabel = brief.status === "confirmed" ? "再次确认并进入研究" : "确认简报并进入研究";
  return <Page project={project} eyebrow="设计简报 · Design Brief" title="先明确问题，再进入方案。" description="Muse 会把原始需求转化为可验证的设计问题。确认后，后续研究与设计方向都将以这份简报为基础。" showWorkflowConversion={false} showAiToolbar={false} actions={<div className="design-brief-v2__actions"><SecondaryButton onClick={() => setDrawer("edit")}>编辑简报</SecondaryButton><PrimaryButton onClick={confirm}>{actionLabel}</PrimaryButton></div>}>
    {changeNotice || project.briefStale ? <div className="design-brief-v2__notice"><CircleAlert size={17}/><span>这项修改可能影响已有研究和后续判断。</span><button onClick={() => void confirmBrief(projectId)}>更新简报</button><button onClick={() => void createBriefVersion(projectId)}>创建新版本</button><button className="is-quiet" onClick={() => setChangeNotice(false)}>取消</button></div> : null}
    <main className="design-brief-v2">
      <BriefSection eyebrow="核心设计问题 · Core Design Question" title="正在冻结的判断" className="design-brief-v2__question" onEdit={() => setDrawer("edit")}><p>{brief.coreDesignQuestion}</p><div className="design-brief-v2__domain"><span>{brief.status === "confirmed" ? "已确认" : "草稿"}</span></div></BriefSection>
      <section className="design-brief-v2__grid design-brief-v2__grid--two"><BriefSection eyebrow="设计目标 · Design Objective" title="这个设计最终需要改变什么" onEdit={() => setDrawer("edit")}><p className="design-brief-v2__objective">{brief.designObjective}</p></BriefSection><BriefSection eyebrow="核心矛盾 · Core Tension" title={`${brief.coreTension.sideA || brief.coreTension.title.split("×")[0]} × ${brief.coreTension.sideB || brief.coreTension.title.split("×")[1] || "使用理解"}`}><div className="design-brief-v2__tension"><p>{brief.coreTension.explanation}</p><button className="design-brief-v2__tension-toggle" onClick={() => setShowTensionDetail((value) => !value)}>{showTensionDetail ? "收起矛盾结构" : "查看矛盾结构"}<ChevronRight size={14} className={showTensionDetail ? "is-open" : ""}/></button>{showTensionDetail ? <div className="design-brief-v2__tension-detail"><div><span>为什么冲突</span><p>{brief.coreTension.whyConflict || "两侧判断需要在研究中找到可被验证的边界。"}</p></div><div><span>偏向前者的风险</span><p>{brief.coreTension.riskIfOverIndexA || "可能让方案牺牲另一侧的长期价值。"}</p></div><div><span>偏向后者的风险</span><p>{brief.coreTension.riskIfOverIndexB || "可能让方案失去当前项目的核心价值。"}</p></div><div><span>对研究的影响</span><p>{brief.coreTension.researchImplication || "研究应优先寻找能改变这组取舍的事实。"}</p></div></div> : null}</div></BriefSection></section>
      <section className="design-brief-v2__grid design-brief-v2__grid--two"><BriefSection eyebrow="目标用户 · Target User" title={brief.targetUser.primary} onEdit={() => setDrawer("edit")}><BriefList items={brief.targetUser.relevantTraits}/>{brief.referenceContext.length ? <div className="design-brief-v2__reference"><span>参考语境</span><p>{brief.referenceContext.join(" · ")}</p></div> : null}</BriefSection><BriefSection eyebrow="核心场景 · Core Scenario" title="谁在什么地方做什么" onEdit={() => setDrawer("edit")}><p>{brief.coreScenario}</p></BriefSection></section>
      <BriefSection eyebrow="设计要求 · Design Requirements" title="真正影响方案的要求" onEdit={() => setDrawer("edit")}><BriefList items={brief.designRequirements}/></BriefSection>
      <BriefSection eyebrow="设计边界 · Design Boundaries" title="必须保留与已明确排除" onEdit={() => setDrawer("edit")}><div className="design-brief-v2__grid design-brief-v2__grid--two design-brief-v2__boundary"><div><h3>设计常量</h3><BriefList items={brief.designConstants}/></div><div><h3>设计排除项</h3><BriefList items={brief.designExclusions} empty="未提供明确的设计排除项"/></div></div></BriefSection>
      <BriefSection eyebrow="预期成果 · Expected Outcomes" title="项目最终应该留下什么"><BriefOutcomeGroup title="用户定义" items={brief.expectedOutcomes.explicit}/><BriefOutcomeGroup title="Muse 建议补充" items={brief.expectedOutcomes.suggested} suggested onAccept={(id, accepted) => void acceptOutcome(projectId, id, accepted)}/></BriefSection>
      <section className="design-brief-v2__grid design-brief-v2__grid--two"><BriefSection eyebrow="待验证假设 · Assumptions" title="这些判断还不是事实"><BriefList items={brief.assumptions}/></BriefSection><BriefSection eyebrow="待确认 · Unknowns" title="当前仍然缺少的信息"><BriefList items={brief.unknowns} empty="当前没有待确认信息"/></BriefSection></section>
      <BriefSection eyebrow="初始成功标准 · Initial Success Criteria" title="研究后仍可调整的第一版标准" onEdit={() => setDrawer("edit")}><div className="design-brief-v2__criteria-grid">{brief.initialSuccessCriteria.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong></article>)}</div></BriefSection>
      <BriefSection eyebrow="下一步：验证关键判断" title="研究问题" className="design-brief-v2__research-questions"><div className="design-brief-v2__rq-list">{brief.researchQuestions.map((item, index) => <article key={item.id}><span>RQ{String(index + 1).padStart(2, "0")}</span><p>{item.label}</p></article>)}</div><small className="design-brief-v2__evidence-note"><strong>证据标准</strong> 下一阶段优先保留有明确来源、能够验证当前假设、能够改变设计判断的资料。</small></BriefSection>
      {brief.workflowRequirements.length ? <BriefSection eyebrow="Muse 工作流要求 · Workflow Requirements" title="这些是流程，不是设计目标" className="design-brief-v2__workflow"><BriefList items={brief.workflowRequirements}/></BriefSection> : null}
      <div className="design-brief-v2__bottom-actions"><button className="industrial-button" onClick={() => navigate(`/projects/${projectId}/overview`)}>返回修改项目概览</button><PrimaryButton onClick={confirm}>{actionLabel}</PrimaryButton></div>
    </main>
    {drawer === "edit" ? <BriefEditorDrawer brief={brief} onClose={() => setDrawer(null)} onSave={save}/> : null}
  </Page>;
}

function ResearchBadge({ children, tone = "neutral" }) {
  return <span className={`research-v2__badge research-v2__badge--${tone}`}>{children}</span>;
}

function ResearchSourceDrawer({ projectId, workspace, onClose }) {
  const addSource = useMuseStore((state) => state.addResearchSource);
  const [kind, setKind] = useState("user_paste");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [questionIds, setQuestionIds] = useState(workspace.questions[0] ? [workspace.questions[0].id] : []);
  const [fileName, setFileName] = useState("");
  const [fileId, setFileId] = useState("");
  const [mimeType, setMimeType] = useState("");
  const toggleQuestion = (id) => setQuestionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setKind("user_upload"); setFileName(file.name); setFileId(`file-${file.name}-${file.size}-${file.lastModified}`); setMimeType(file.type || "application/octet-stream");
    if (file.type.startsWith("text/") || /\.md$|\.txt$|\.csv$/i.test(file.name)) setExcerpt((await file.text()).slice(0, 900));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() && !fileName.trim() && !sourceUrl.trim()) return;
    await addSource(projectId, { kind, name: name.trim() || fileName.trim() || sourceUrl.trim(), sourceUrl, originalExcerpt: excerpt, sourceFileId: fileId, mimeType, userProvidedSource: kind !== "url", questionIds });
    onClose();
  };
  return <div className="research-v2__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="research-v2__drawer" aria-label="添加研究来源">
      <header><div><p className="industrial-kicker">SOURCE INTAKE</p><h2>添加可追溯来源</h2><p>没有原始来源的内容只能作为假设，不能进入已验证证据。</p></div><button className="research-v2__icon-button" onClick={onClose} aria-label="关闭"><X size={18}/></button></header>
      <form onSubmit={submit}>
        <div className="research-v2__source-tabs"><button type="button" className={kind === "user_paste" ? "is-active" : ""} onClick={() => setKind("user_paste")}>粘贴材料</button><button type="button" className={kind === "url" ? "is-active" : ""} onClick={() => setKind("url")}>添加链接</button><label className={kind === "user_upload" ? "is-active" : ""}><Upload size={14}/>上传文件<input type="file" accept=".txt,.md,.csv,.pdf,.doc,.docx" onChange={onFile}/></label></div>
        <label>来源名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：用户访谈 03 / 品牌官方文章"/></label>
        {kind === "url" ? <label>来源链接<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…"/></label> : null}
        {kind === "user_upload" && fileName ? <p className="research-v2__file-note"><FileText size={15}/>已选择：{fileName}</p> : null}
        <label>原文摘录{kind === "url" ? <span className="research-v2__field-note">链接可以先记录；没有摘录前不能采纳。</span> : null}<textarea rows={7} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="粘贴与研究问题直接相关的原文、访谈记录或报告摘录。"/></label>
        <fieldset><legend>关联研究问题</legend>{workspace.questions.map((question) => <label className="research-v2__check-row" key={question.id}><input type="checkbox" checked={questionIds.includes(question.id)} onChange={() => toggleQuestion(question.id)}/><span>{question.label}</span></label>)}</fieldset>
        <footer><button type="button" className="industrial-button" onClick={onClose}>取消</button><button type="submit" className="industrial-button industrial-button--primary">保存候选证据<ArrowRight size={16}/></button></footer>
      </form>
    </aside>
  </div>;
}

function ResearchPlan({ workspace, onClose }) {
  return <div className="research-v2__plan"><header><div><p className="industrial-kicker">RESEARCH PLAN</p><h3>Muse 将围绕这些问题寻找来源</h3></div><button className="research-v2__icon-button" onClick={onClose} aria-label="关闭研究计划"><X size={16}/></button></header><ol>{workspace.plan.map((item, index) => <li key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.label.replace("围绕 ", "")}</strong><small>当前没有 Research Provider，点击开始后仍需你提供资料或链接。</small></div></li>)}</ol><footer><button className="industrial-button" onClick={onClose}>先调整问题</button><button className="industrial-button industrial-button--primary" onClick={onClose}>开始并等待来源</button></footer></div>;
}

function ResearchQuestionCard({ question, index, evidence }) {
  const related = evidence.filter((item) => item.questionIds?.includes(question.id));
  return <article className="research-v2__question-card"><div><span className="research-v2__rq-id">RQ{String(index + 1).padStart(2, "0")}</span><ResearchBadge tone={related.some((item) => item.userStatus === "accepted") ? "success" : "neutral"}>{related.length ? `${related.length} 条材料` : "待寻找证据"}</ResearchBadge></div><h3>{question.label}</h3><p>{question.origin === "confirmed_brief" ? "来自已确认设计简报" : "由当前简报整理"}</p></article>;
}

function EvidenceCard({ item, workspace, projectId }) {
  const accept = useMuseStore((state) => state.acceptResearchEvidence);
  const action = useMuseStore((state) => state.setResearchEvidenceAction);
  const [showDetails, setShowDetails] = useState(false);
  const questions = workspace.questions.filter((question) => item.questionIds?.includes(question.id));
  const isVerified = item.type === "verified" && item.userStatus === "accepted";
  const status = isVerified ? "已保留" : item.userStatus === "rejected" ? "已忽略" : item.userStatus === "saved" ? "稍后处理" : "待确认";
  const tone = isVerified ? "success" : item.userStatus === "rejected" ? "danger" : "candidate";
  return <article className={`research-v2__evidence-card ${isVerified ? "is-verified" : ""}`}>
    <header><div><ResearchBadge tone={tone}>{status}</ResearchBadge><ResearchBadge>{researchSourceTypeLabel(item.sourceType)}</ResearchBadge></div><span className="research-v2__evidence-date">{item.capturedAt ? new Date(item.capturedAt).toLocaleDateString("zh-CN") : "日期待补充"}</span></header>
    <div className="research-v2__evidence-body"><div className="research-v2__evidence-main"><h3>{item.title}</h3><p className="research-v2__source-name">来源：{item.sourcePublisher || item.sourceName || "未命名来源"}{item.sourceDate ? ` · ${item.sourceDate}` : ""}</p><div className="research-v2__evidence-points"><div><span>原始事实</span><p>{item.fact || item.originalExcerpt || "尚未读取原始内容，不能把链接名称当成事实。"}</p></div><div><span>Muse 解读</span><p>{item.interpretation || "等待 Muse 基于原文整理与项目的关系。"}</p></div><div><span>对设计的影响</span><p>{item.designImplication || "等待人工判断是否会改变设计判断。"}</p></div></div></div></div>
    {showDetails ? <div className="research-v2__evidence-advanced"><div><span>关联研究焦点</span><p>{questions.map((question) => question.label).join(" / ") || "未关联具体研究问题"}</p></div><div><span>原始来源</span><p>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceTitle || item.sourceName || item.sourceUrl}<ExternalLink size={12}/></a> : item.sourceFileId ? `文件：${item.sourceFileId}` : "用户提供材料"}</p></div><div><span>原文摘录</span><p>{item.originalExcerpt || "暂无摘录"}</p></div><div><span>使用限制</span><p>{item.limitations || "需要人工判断适用范围。"}</p></div><div><span>证据 ID</span><p>{item.id}</p></div></div> : null}
    <footer><div className="research-v2__linked-questions">{questions.map((question) => <span key={question.id}>{question.id.includes("rq") ? question.id.split("-").slice(-1)[0] : "RQ"}</span>)}</div><div className="research-v2__evidence-actions"><button className="is-primary" disabled={isVerified} onClick={() => void accept(projectId, item.id)}>{isVerified ? "已保留" : "保留"}</button><button onClick={() => void action(projectId, item.id, "reject")}>{item.userStatus === "rejected" ? "已忽略" : "忽略"}</button><button className="is-quiet" onClick={() => setShowDetails((value) => !value)}>{showDetails ? "收起依据" : "查看依据"}<ChevronRight size={13} className={showDetails ? "is-open" : ""}/></button></div></footer>
  </article>;
}

function ResearchHypothesisCard({ item }) {
  return <article className="research-v2__hypothesis"><ResearchBadge tone="hypothesis">AI 假设 · 未验证</ResearchBadge><h3>{item.label}</h3><div><span>为什么重要</span><p>{item.whyItMatters}</p></div><div><span>如何验证</span><p>{item.howToValidate}</p></div></article>;
}

function LegacyIndustrialResearchPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const ensure = useMuseStore((state) => state.ensureResearchWorkspace);
  const setLimited = useMuseStore((state) => state.setResearchEvidenceLimited);
  const [drawer, setDrawer] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  useEffect(() => { if (project?.designBrief) void ensure(projectId); }, [ensure, project?.designBrief, projectId]);
  if (!project) return <StateBoundary project={project}/>;
  const brief = project.designBrief;
  const workspace = project.researchWorkspace;
  if (!workspace) return <Page project={project} eyebrow="02 · 研究证据" title="先确认设计简报" description="研究问题必须来自已确认的设计简报。" showAiToolbar={false} showWorkflowConversion={false}><div className="industrial-gate"><LockKeyhole size={18}/>请先确认设计简报，研究证据才有判断上下文。</div></Page>;
  const accepted = workspace.evidence.filter((item) => item.type === "verified" && item.userStatus === "accepted");
  const candidates = workspace.evidence.filter((item) => item.type === "candidate" && item.userStatus !== "rejected");
  const enterInsight = async (limited = false) => { if (limited) await setLimited(projectId, true); navigate(`/projects/${projectId}/insight`); };
  return <Page project={project} eyebrow="02 · 研究证据" title="研究不是素材墙，而是后续选择的证据" description="从已确认简报出发，寻找能改变设计判断的真实材料。没有来源的内容不会被包装成事实。" showAiToolbar={false} showWorkflowConversion={false} actions={<div className="research-v2__header-actions"><button className="industrial-button" onClick={() => setShowPlan(true)}><Search size={15}/>让 Muse 开始研究</button><button className="industrial-button" onClick={() => setDrawer(true)}><Link2 size={15}/>添加来源</button><button className="industrial-button industrial-button--primary" onClick={() => void enterInsight(workspace.insightGate.ready ? false : true)} disabled={!workspace.insightGate.ready && !workspace.evidence.length}>{workspace.insightGate.ready ? "提炼设计洞察" : "证据有限，继续"}<ArrowRight size={16}/></button></div>}>
    {brief?.status !== "confirmed" && !industrial?.briefConfirmed ? <div className="industrial-gate"><LockKeyhole size={18}/>当前简报还未确认；先确认简报，研究问题才会冻结。</div> : null}
    <section className="research-v2__mode-banner"><div className="research-v2__mode-icon"><Search size={18}/></div><div><p className="industrial-kicker">RESEARCH LIMITED MODE</p><h2>研究受限模式</h2><p>当前没有可用 Research Provider。Muse 不会编造外部搜索、竞品资料或研究图片；你可以上传资料、添加链接或粘贴访谈/报告内容，Muse 只对你提供的原文做整理。</p></div><ResearchBadge tone="limited">Provider 未连接</ResearchBadge></section>
    <section className="research-v2__summary-strip"><div><span>研究问题</span><strong>{workspace.questions.length}</strong><small>来自已确认简报</small></div><div><span>候选证据</span><strong>{candidates.length}</strong><small>等待人工采纳</small></div><div><span>已验证证据</span><strong>{accepted.length}</strong><small>只来自可追溯来源</small></div><div><span>洞察门槛</span><strong>{workspace.insightGate.ready ? "已满足" : "未满足"}</strong><small>3 条证据 / 2 个问题 / 2 个来源</small></div></section>
    <section className="research-v2__section"><header><div><p className="industrial-kicker">RESEARCH QUESTIONS</p><h2>先回答哪些问题</h2></div><span>{workspace.questions.length} 个问题</span></header><div className="research-v2__question-grid">{workspace.questions.map((question, index) => <ResearchQuestionCard key={question.id} question={question} index={index} evidence={workspace.evidence}/>)}</div></section>
    <section className="research-v2__section"><header><div><p className="industrial-kicker">RESEARCH LENSES</p><h2>按领域选择研究镜头</h2></div><span>{workspace.lenses[0]?.domain || "general_design"}</span></header><div className="research-v2__lens-grid">{workspace.lenses.map((lens) => <article key={lens.id} className={workspace.coverage.find((item) => item.id === lens.id)?.status === "covered" ? "is-covered" : ""}><div><span>{workspace.coverage.find((item) => item.id === lens.id)?.acceptedEvidenceCount || 0}</span><CheckCircle2 size={15}/></div><h3>{lens.label}</h3><p>{lens.description}</p></article>)}</div></section>
    <section className="research-v2__section research-v2__section--evidence"><header><div><p className="industrial-kicker">EVIDENCE REVIEW</p><h2>证据与来源</h2></div><div className="research-v2__section-actions"><button className="industrial-button" onClick={() => setDrawer(true)}><Upload size={14}/>上传或粘贴</button><span>{workspace.evidence.length} 条材料</span></div></header>{workspace.evidence.length ? <div className="research-v2__evidence-list">{workspace.evidence.map((item) => <EvidenceCard key={item.id} item={item} workspace={workspace} projectId={projectId}/>)}</div> : <div className="research-v2__empty"><FileText size={21}/><h3>还没有真实来源</h3><p>先添加用户访谈、观察记录、报告摘录或外部链接。研究页不再用 AI 示意图填充空状态。</p><button className="industrial-button industrial-button--primary" onClick={() => setDrawer(true)}>添加第一条来源<ArrowRight size={15}/></button></div>}</section>
    <section className="research-v2__section"><header><div><p className="industrial-kicker">AI HYPOTHESES</p><h2>AI 假设</h2></div><span>不等于研究事实</span></header><div className="research-v2__hypothesis-grid">{workspace.hypotheses.map((item) => <ResearchHypothesisCard key={item.id} item={item}/>)}</div></section>
    <section className="research-v2__section research-v2__bottom-summary"><header><div><p className="industrial-kicker">RESEARCH SUMMARY</p><h2>只有已采纳证据会进入摘要</h2></div><ResearchBadge tone={workspace.insightGate.ready ? "success" : "limited"}>{workspace.insightGate.ready ? "可进入洞察" : "Evidence Limited"}</ResearchBadge></header><p className="research-v2__summary-copy">{workspace.researchSummary}</p><div className="research-v2__coverage"><strong>证据覆盖</strong>{workspace.coverage.map((item) => <div key={item.id}><span>{item.label}</span><i className={item.status === "covered" ? "is-covered" : ""}/></div>)}</div><footer><p>{workspace.insightGate.ready ? "证据已达到进入洞察层的最低门槛。" : "建议继续补充至少两个独立来源；如果必须继续，可以明确标记 Evidence Limited。"}</p><div><button className="industrial-button" onClick={() => void enterInsight(true)}>仍然进入洞察（证据有限）<ArrowRight size={15}/></button>{workspace.insightGate.ready ? <button className="industrial-button industrial-button--primary" onClick={() => void enterInsight(false)}>提炼设计洞察<ArrowRight size={15}/></button> : null}</div></footer></section>
    {drawer ? <ResearchSourceDrawer projectId={projectId} workspace={workspace} onClose={() => setDrawer(false)}/> : null}
    {showPlan ? <div className="research-v2__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlan(false); }}><ResearchPlan workspace={workspace} onClose={() => setShowPlan(false)}/></div> : null}
  </Page>;
}

function LegacyIndustrialInsightPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const apply = useMuseStore((state) => state.applyIndustrialEvent);
  if (!project) return <StateBoundary project={project}/>;
  const confirm = async () => { await apply(projectId, { type: "INSIGHTS_CONFIRMED" }); navigate(`/projects/${projectId}/direction`); };
  return <Page project={project} eyebrow="设计洞察" title="选择值得驱动概念的机会点" description="把来源明确的证据转成可判断的机会点。只有被确认的机会点，才会影响方向与概念。" actions={<PrimaryButton disabled={!industrial.selectedInsightIds.length} onClick={confirm}>确认 {industrial.selectedInsightIds.length} 条洞察</PrimaryButton>}>
    {!industrial.briefConfirmed ? <div className="industrial-gate"><LockKeyhole size={18}/>请先确认设计简报，再把研究证据转化为设计机会。</div> : null}
    <div className="industrial-insight-list">{industrial.insights.map((item, index) => {
      const selected = industrial.selectedInsightIds.includes(item.id);
      const evidence = industrial.evidence.filter((e) => item.sourceEvidenceIds.includes(e.id));
      return <button disabled={!industrial.briefConfirmed} className={selected ? "is-selected" : ""} key={item.id} onClick={() => apply(projectId, { type: "INSIGHT_TOGGLED", insightId: item.id })}>
      <ChoiceMark selected={selected}/><span className="industrial-index">0{index + 1}</span>{item.image ? <img src={assetSrc(item.image)} alt={`${item.statement}洞察视觉`}/> : <span className="industrial-insight-image-placeholder" aria-hidden="true"/>}<div><h2>{item.statement}</h2><p>{item.rationale}</p><strong>设计机会：{item.opportunity}</strong><small>依据：{evidence.map((e) => e.title).join(" / ")}</small></div>
      </button>;
    })}</div>
  </Page>;
}

export function IndustrialResearchPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const ensure = useMuseStore((state) => state.ensureResearchWorkspace);
  const setLimited = useMuseStore((state) => state.setResearchEvidenceLimited);
  const [drawer, setDrawer] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const brain = useMemo(() => project ? buildProjectBrain(project) : null, [project]);
  useEffect(() => { if (project?.designBrief) void ensure(projectId); }, [ensure, project?.designBrief, projectId]);
  if (!project) return <StateBoundary project={project}/>;
  const brief = project.designBrief;
  const workspace = project.researchWorkspace;
  if (!workspace) return <Page project={project} eyebrow="02 · 研究证据" title="先确认设计简报" description="研究问题必须来自已确认的设计简报。" showAiToolbar={false} showWorkflowConversion={false}><div className="industrial-gate"><LockKeyhole size={18}/>请先确认设计简报，研究证据才有判断上下文。</div></Page>;
  const accepted = brain?.acceptedEvidence ?? [];
  const candidates = workspace.evidence.filter((item) => item.type === "candidate" && item.userStatus !== "rejected");
  const insightGate = workspace.insightGate ?? { ready: false };
  const enterInsight = async (limited = false) => { if (limited) await setLimited(projectId, true); navigate(`/projects/${projectId}/insight`); };
  const focusLenses = workspace.lenses.slice(0, 4);
  return <Page project={project} eyebrow="02 · 研究证据" title="找到真正会影响设计判断的信息" description="Muse 围绕已确认设计问题整理研究；你只需要判断哪些信息值得进入下一步。" showWorkflowConversion={false} actions={<div className="research-v2__header-actions"><button className="industrial-button" onClick={() => setDrawer(true)}><Link2 size={15}/>添加来源</button><PrimaryButton disabled={!insightGate.ready} onClick={() => void enterInsight(false)}>用 {accepted.length} 条证据生成设计洞察</PrimaryButton></div>}>
    <section className="research-v2__entry-guidance"><div><p className="industrial-kicker">现在只需要做两件事</p><h2>看研究发现，保留有价值的证据</h2><p>Muse 会把已保留的证据带入设计洞察；没有来源的内容不会被包装成事实。</p></div><ol><li><span>01</span><strong>看研究发现</strong><small>先读原文、Muse 解读和可能影响。</small></li><li><span>02</span><strong>保留有价值的证据</strong><small>保留至少 2 条，最好覆盖不同研究焦点。</small></li></ol></section>
    {brief?.status !== "confirmed" && !industrial?.briefConfirmed ? <div className="industrial-gate"><LockKeyhole size={18}/>当前简报还未确认；先确认简报，研究问题才会冻结。</div> : null}
    <section className="research-v2__focus"><header><div><p className="industrial-kicker">MUSE 正在研究</p><h2>先看这些研究焦点</h2></div><ResearchBadge tone={insightGate.ready ? "success" : "limited"}>{insightGate.ready ? "已达到洞察门槛" : `已保留 ${accepted.length} 条`}</ResearchBadge></header><div className="research-v2__focus-grid">{focusLenses.map((lens) => { const coverage = workspace.coverage.find((item) => item.id === lens.id); return <article key={lens.id} className={coverage?.status === "covered" ? "is-covered" : ""}><span>{coverage?.acceptedEvidenceCount || 0}</span><h3>{lens.label}</h3><p>{lens.description}</p></article>; })}</div><button className="research-v2__disclosure" onClick={() => setShowQuestions((value) => !value)}>{showQuestions ? "收起研究问题" : "查看研究问题"}<ChevronRight size={15} className={showQuestions ? "is-open" : ""}/></button>{showQuestions ? <div className="research-v2__question-grid">{workspace.questions.map((question, index) => <ResearchQuestionCard key={question.id} question={question} index={index} evidence={workspace.evidence}/>)}</div> : null}</section>
    <section className="research-v2__section research-v2__section--evidence"><header><div><p className="industrial-kicker">EVIDENCE REVIEW</p><h2>研究发现</h2><p>每条卡片只保留：发现、解读、可能影响，以及你的判断。</p></div><div className="research-v2__section-actions"><button className="industrial-button" onClick={() => setDrawer(true)}><Upload size={14}/>添加材料</button><span>{candidates.length} 条待确认 · {accepted.length} 条已保留</span></div></header>{workspace.evidence.length ? <div className="research-v2__evidence-list">{workspace.evidence.map((item) => <EvidenceCard key={item.id} item={item} workspace={workspace} projectId={projectId}/>)}</div> : <div className="research-v2__empty"><FileText size={21}/><h3>还没有真实来源</h3><p>先添加用户访谈、观察记录、报告摘录或外部链接。Muse 只对你提供的原文做整理。</p><button className="industrial-button industrial-button--primary" onClick={() => setDrawer(true)}>添加第一条来源<ArrowRight size={15}/></button></div>}</section>
    <details className="research-v2__advanced"><summary>查看研究覆盖与待验证假设<ChevronRight size={15}/></summary><div className="research-v2__advanced-content"><div className="research-v2__lens-grid">{workspace.lenses.map((lens) => { const coverage = workspace.coverage.find((item) => item.id === lens.id); return <article key={lens.id} className={coverage?.status === "covered" ? "is-covered" : ""}><div><span>{coverage?.acceptedEvidenceCount || 0}</span><CheckCircle2 size={15}/></div><h3>{lens.label}</h3><p>{lens.description}</p></article>; })}</div><div className="research-v2__hypothesis-grid">{workspace.hypotheses.map((item) => <ResearchHypothesisCard key={item.id} item={item}/>)}</div></div></details>
    <section className="research-v2__bottom-summary"><div><p className="industrial-kicker">下一步</p><h2>已保留的证据会进入设计洞察</h2><p>{workspace.researchSummary}</p></div><div className="research-v2__bottom-summary-actions"><button className="industrial-button" onClick={() => void enterInsight(true)}>证据有限，先查看初步判断<ArrowRight size={15}/></button><PrimaryButton disabled={!insightGate.ready} onClick={() => void enterInsight(false)}>用 {accepted.length} 条证据生成设计洞察</PrimaryButton></div></section>
    {drawer ? <ResearchSourceDrawer projectId={projectId} workspace={workspace} onClose={() => setDrawer(false)}/> : null}
  </Page>;
}

function InsightStrengthBadge({ strength }) {
  const copy = strength === "strong" ? "证据较强" : strength === "medium" ? "有一定支持" : "初步判断";
  return <ResearchBadge tone={strength === "strong" ? "success" : strength === "medium" ? "candidate" : "limited"}>{copy}</ResearchBadge>;
}

function InsightEvidenceList({ evidence }) {
  return <div className="industrial-insight-evidence"><span>依据 · {evidence.length} 条已保留证据</span>{evidence.length ? <ul>{evidence.map((item) => <li key={item.id}><strong>{item.title}</strong><small>{item.sourceName || "用户提供材料"} · {item.originalExcerpt}</small></li>)}</ul> : <p>尚未找到已保留的可追溯证据。</p>}</div>;
}

function InsightCard({ item, index, evidence, selected, onAction, onSaveEdit }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [statement, setStatement] = useState(item.insightStatement);
  const [implication, setImplication] = useState(item.designImplication);
  const save = async () => { await onSaveEdit(item.id, { title: title.trim() || item.title, insightStatement: statement.trim() || item.insightStatement, designImplication: implication.trim() || item.designImplication }); setEditing(false); };
  return <article className={`industrial-insight-card ${selected ? "is-selected" : ""}`}>
    <header><div className="industrial-insight-card__meta"><span className="industrial-index">{String(index + 1).padStart(2, "0")}</span><InsightStrengthBadge strength={item.evidenceStrength}/><span>{evidence.length} 条依据</span></div><span className={`industrial-insight-status ${selected ? "is-confirmed" : ""}`}>{selected ? "已保留" : item.status === "rejected" ? "暂不采用" : "待判断"}</span></header>
    {editing ? <div className="industrial-insight-edit"><label>洞察标题<input value={title} onChange={(event) => setTitle(event.target.value)}/></label><label>洞察判断<textarea rows={4} value={statement} onChange={(event) => setStatement(event.target.value)}/></label><label>设计含义<textarea rows={4} value={implication} onChange={(event) => setImplication(event.target.value)}/></label><div><button className="industrial-button" onClick={() => setEditing(false)}>取消</button><button className="industrial-button industrial-button--primary" onClick={() => void save()}>保存修改<Check size={15}/></button></div></div> : <><p className="industrial-kicker">{item.title}</p><h2>{item.insightStatement}</h2><div className="industrial-insight-card__section"><span>为什么重要</span><p>{item.whyItMatters}</p></div><div className="industrial-insight-card__section industrial-insight-card__section--implication"><span>对设计意味着什么</span><p>{item.designImplication}</p></div><details className="industrial-insight-card__evidence"><summary>查看依据<ChevronRight size={14}/></summary><InsightEvidenceList evidence={evidence}/></details><footer><button className="is-primary" onClick={() => void onAction(item.id, selected ? "reset" : "keep")}>{selected ? "已保留" : "保留"}</button><button onClick={() => void onAction(item.id, "reject")}>暂不采用</button><button className="is-quiet" onClick={() => setEditing(true)}><Edit3 size={14}/>编辑洞察</button></footer></>}
  </article>;
}

export function IndustrialInsightPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const ensure = useMuseStore((state) => state.ensureDesignInsights);
  const action = useMuseStore((state) => state.setDesignInsightAction);
  const update = useMuseStore((state) => state.updateDesignInsight);
  const confirmDesignInsights = useMuseStore((state) => state.confirmDesignInsights);
  const attempted = useRef("");
  const brain = useMemo(() => project ? buildProjectBrain(project) : null, [project]);
  useEffect(() => { if (project?.designBrief && attempted.current !== projectId) { attempted.current = projectId; void ensure(projectId); } }, [ensure, project?.designBrief, projectId]);
  if (!project) return <StateBoundary project={project}/>;
  const insights = project.designInsights ?? [];
  const selectedIds = brain?.confirmedInsights.map((item) => String(item.id ?? "")) ?? [];
  const accepted = brain?.acceptedEvidence ?? [];
  const confirm = async () => { try { await confirmDesignInsights(projectId, selectedIds); navigate(`/projects/${projectId}/direction`); } catch (error) { useMuseStore.getState().pushToast(error?.message === "DESIGN_INSIGHTS_MAXIMUM_EXCEEDED" ? "最多保留 4 条设计洞察" : "至少保留 2 条设计洞察后才能进入设计方向", "warning"); } };
  return <Page project={project} eyebrow="03 · 设计洞察" title="把证据推进一层，找到真正的设计机会" description="洞察不是重复简报，而是从多条证据中提炼出“为什么重要”与“意味着什么”。只有你保留的洞察会影响设计方向。" showWorkflowConversion={false} actions={<PrimaryButton disabled={selectedIds.length < 2 || selectedIds.length > 4} onClick={confirm}>确认 {selectedIds.length} 条设计洞察</PrimaryButton>}>
    {!project.designBrief || project.designBrief.status !== "confirmed" ? <div className="industrial-gate"><LockKeyhole size={18}/>请先确认设计简报，再把研究证据转化为设计洞察。</div> : null}
    <section className="industrial-insight-context"><div><p className="industrial-kicker">洞察上下文</p><h2>只使用已确认简报 + 已保留研究证据</h2><p>当前有 {accepted.length} 条已保留证据；洞察页不生成图片，也不读取原始输入中的工作流说明。</p></div><InsightStrengthBadge strength={accepted.length >= 2 ? "strong" : "preliminary"}/></section>
    {accepted.length < 2 ? <div className="industrial-gate"><CircleAlert size={18}/>至少保留 2 条有来源的研究证据，Muse 才能形成较可靠的设计洞察。当前会显示初步判断，但不能确认进入方向。</div> : null}
    {insights.length ? <div className="industrial-insight-v2-list">{insights.map((item, index) => <InsightCard key={item.id} item={item} index={index} selected={selectedIds.includes(item.id)} evidence={accepted.filter((evidence) => item.evidenceIds?.includes(evidence.id))} onAction={(id, nextAction) => action(projectId, id, nextAction)} onSaveEdit={(id, patch) => update(projectId, id, patch)}/>)}</div> : <div className="industrial-empty industrial-empty--large"><FileText size={21}/><h3>还没有可生成的设计洞察</h3><p>回到研究证据页，保留至少两条来自不同来源、能够改变设计判断的材料。</p><button className="industrial-button industrial-button--primary" onClick={() => navigate(`/projects/${projectId}/research`)}>返回研究证据<ArrowRight size={15}/></button></div>}
    <section className="industrial-insight-next"><div><p className="industrial-kicker">下一步</p><h2>确认后进入设计方向比较</h2><p>方向页会显示哪些策略受到洞察影响；你仍然需要在那里做方向选择。</p></div><PrimaryButton disabled={selectedIds.length < 2 || selectedIds.length > 4} onClick={confirm}>确认 {selectedIds.length} 条设计洞察</PrimaryButton></section>
  </Page>;
}

function DirectionSupportBadge({ level }) {
  const copy = level === "supported" ? "证据支持" : level === "partial" ? "部分支持" : "初步方向";
  return <span className={`direction-v2__support direction-v2__support--${level || "preliminary"}`}>{copy}</span>;
}

function DirectionTrace({ direction, insights, evidence, onOpenInsight }) {
  const linkedInsights = insights.filter((item) => direction.insightIds?.includes(item.id));
  const linkedEvidence = evidence.filter((item) => direction.evidenceIds?.includes(item.id));
  return <div className="direction-v2-card__trace">
    <div><span className="direction-v2__label">基于已确认洞察</span><div className="direction-v2-card__chips">{linkedInsights.length ? linkedInsights.map((item) => <button type="button" key={item.id} onClick={() => onOpenInsight?.(item)}>{item.title}</button>) : <span className="direction-v2-card__empty">暂未确认洞察</span>}</div></div>
    <div><span className="direction-v2__label">可追溯证据</span><p>{linkedEvidence.length ? `${linkedEvidence.length} 条已采纳证据 · ${new Set(linkedEvidence.map((item) => item.sourceName)).size} 个来源` : "当前没有已采纳证据"}</p></div>
  </div>;
}

function DirectionCard({ direction, selected, canChoose, insights, evidence, onDetails, onChoose }) {
  return <article className={`direction-v2-card ${selected ? "is-selected" : ""}`}>
    <header className="direction-v2-card__header">
      <div><span className="direction-v2-card__code">{direction.code}</span><div><p className="direction-v2__eyebrow">{direction.subtitle}</p><h2>{direction.name}</h2></div></div>
      <DirectionSupportBadge level={direction.supportLevel}/>
    </header>
    <p className="direction-v2-card__thesis">{direction.thesis}</p>
    <div className="direction-v2-card__keywords">{(direction.keywords ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>
    <DirectionTrace direction={direction} insights={insights} evidence={evidence}/>
    <div className="direction-v2-card__decision"><div><span className="direction-v2__label">最大优势</span><p>{direction.advantages?.[0] || "待进一步明确"}</p></div><div><span className="direction-v2__label">最大风险</span><p>{direction.risks?.[0] || "待进一步验证"}</p></div></div>
    <footer className="direction-v2-card__actions"><button type="button" className="direction-v2__text-button" onClick={() => onDetails(direction)}>查看完整方向<ChevronRight size={15}/></button><button type="button" className="industrial-button industrial-button--primary" disabled={!canChoose} onClick={() => onChoose(direction)}>{selected ? "已选择方向" : "选择这个方向"}<ArrowRight size={16}/></button></footer>
  </article>;
}

function DirectionDetailDrawer({ direction, insights, evidence, onClose, onChoose, canChoose }) {
  if (!direction) return null;
  const linkedInsights = insights.filter((item) => direction.insightIds?.includes(item.id));
  const linkedEvidence = evidence.filter((item) => direction.evidenceIds?.includes(item.id));
  const logic = [["品牌逻辑", direction.brandLogic], ["文化逻辑", direction.culturalLogic], ["视觉逻辑", direction.visualLogic], ["空间逻辑", direction.spatialLogic], ["体验逻辑", direction.experienceLogic], ["交互逻辑", direction.interactionLogic], ["形体逻辑", direction.formLogic], ["材料逻辑", direction.materialLogic]].filter(([, value]) => value);
  return <div className="direction-v2__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="direction-v2-drawer" role="dialog" aria-modal="true" aria-labelledby="direction-v2-drawer-title">
      <header><div><p className="direction-v2__eyebrow">{direction.code} · 完整战略</p><h2 id="direction-v2-drawer-title">{direction.name}</h2><DirectionSupportBadge level={direction.supportLevel}/></div><button type="button" className="direction-v2__icon-button" onClick={onClose} aria-label="关闭方向详情"><X size={18}/></button></header>
      <section className="direction-v2-drawer__thesis"><span className="direction-v2__label">核心主张</span><p>{direction.thesis}</p><p>{direction.strategicIdea}</p></section>
      <section><h3>为什么成立</h3>{linkedInsights.length ? <div className="direction-v2-drawer__trace-list">{linkedInsights.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.insightStatement}</p><small>设计含义：{item.designImplication}</small></article>)}</div> : <p className="direction-v2__muted">当前没有已确认洞察，方向会保持为初步方向。</p>}{linkedEvidence.length ? <div className="direction-v2-drawer__evidence">{linkedEvidence.map((item) => <article key={item.id}><span>{item.sourceName || "已采纳来源"}</span><p>{item.originalExcerpt}</p><small>{item.designImplication}</small></article>)}</div> : null}</section>
      <section><h3>战略逻辑</h3><div className="direction-v2-drawer__logic">{logic.map(([label, value]) => <div key={label}><span>{label}</span><p>{value}</p></div>)}</div></section>
      <section className="direction-v2-drawer__columns"><div><h3>优势</h3><ul>{(direction.advantages ?? []).map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>取舍</h3><ul>{(direction.tradeoffs ?? []).map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>风险</h3><ul>{(direction.risks ?? []).map((item) => <li key={item}>{item}</li>)}</ul></div></section>
      <section><h3>验证问题</h3><ol className="direction-v2-drawer__validation">{(direction.validationQuestions ?? []).map((item) => <li key={item}>{item}</li>)}</ol></section>
      <footer className="direction-v2-drawer__footer"><button type="button" className="direction-v2__text-button" onClick={onClose}>继续比较</button><button type="button" className="industrial-button industrial-button--primary" disabled={!canChoose} onClick={() => onChoose(direction)}>选择这个方向<ArrowRight size={16}/></button></footer>
    </aside>
  </div>;
}

function DirectionComparisonMatrix({ directions, explanation, onExplain }) {
  const rows = [
    ["文化机制", (item) => item.culturalLogic || "不以文化机制为主"],
    ["参与方式", (item) => item.interactionLogic || item.experienceLogic],
    ["品牌延展", (item) => item.brandLogic || "不以品牌延展为主"],
    ["空间延展", (item) => item.spatialLogic || "不以空间延展为主"],
    ["社交分享", (item) => item.communicationLogic || item.visualLogic],
    ["长期品牌价值", (item) => item.advantages?.[0] || "待验证"],
    ["用户价值", (item) => item.userValue],
    ["证据支持", (item) => item.supportLevel === "supported" ? "强 · 已采纳证据与已确认洞察" : item.supportLevel === "partial" ? "中高 · 仍需补充验证" : "弱 · 初步方向"],
    ["最大风险", (item) => item.biggestRisk || item.risks?.[0] || "待补充"],
  ];
  return <section className="direction-v2-matrix"><header><div><p className="direction-v2__eyebrow">COMPARE WITHOUT SCORES</p><h2>三条方向的差异</h2></div><span>点击单元格查看判断依据</span></header><div className="direction-v2-matrix__scroll"><table><thead><tr><th>比较维度</th>{directions.map((item) => <th key={item.id}>{item.code} · {item.name}</th>)}</tr></thead><tbody>{rows.map(([label, getValue]) => <tr key={label}><th>{label}</th>{directions.map((item) => <td key={`${item.id}-${label}`}><button type="button" onClick={() => onExplain({ direction: item, label, value: getValue(item) })}>{getValue(item)}</button></td>)}</tr>)}</tbody></table></div>{explanation ? <div className="direction-v2-matrix__explanation"><strong>{explanation.direction.code} · {explanation.direction.name} / {explanation.label}</strong><p>{explanation.value}</p><small>这是该方向的策略判断，不是未经验证的数字评分。</small></div> : null}</section>;
}

function DirectionRecommendation({ recommendation, directions, onChoose, onCompare }) {
  if (!recommendation?.enabled) return <section className="direction-v2-recommendation direction-v2-recommendation--disabled"><div><p className="direction-v2__eyebrow">MUSE RECOMMENDATION · 暂停</p><h2>证据链尚不足以推荐方向</h2><p>{recommendation?.risk || "至少需要 2 条已采纳证据和 1 条已确认洞察。"}</p></div></section>;
  const direction = directions.find((item) => item.id === recommendation?.directionId) ?? directions[0];
  if (!direction) return null;
  return <section className="direction-v2-recommendation"><div><p className="direction-v2__eyebrow">MUSE RECOMMENDATION · 仅供比较</p><h2>优先看「{direction.name}」</h2><p>推荐基于当前已采纳证据与已确认洞察，不会替你自动锁定。</p><ul>{(recommendation?.reasons ?? []).map((item) => <li key={item}>{item}</li>)}</ul><div className="direction-v2-recommendation__tradeoffs">{(recommendation?.tradeoffs ?? []).map((item) => <p key={item}>{item}</p>)}</div><div className="direction-v2-recommendation__risk"><span>最大风险</span><p>{recommendation?.risk || direction.risks?.[0]}</p></div></div><div className="direction-v2-recommendation__actions"><button type="button" className="industrial-button industrial-button--primary" onClick={() => onChoose(direction)}>选择这个方向<ArrowRight size={16}/></button><button type="button" className="direction-v2__text-button" onClick={onCompare}>继续比较</button><button type="button" className="direction-v2__text-button" onClick={onCompare}>暂不决定</button></div></section>;
}

function DirectionSelectionDialog({ direction, reason, onReasonChange, onClose, onConfirm }) {
  if (!direction) return null;
  return <div className="direction-v2__backdrop direction-v2__backdrop--confirm" role="presentation"><section className="direction-v2-confirm" role="dialog" aria-modal="true" aria-labelledby="direction-v2-confirm-title"><header><div><p className="direction-v2__eyebrow">确认方向选择</p><h2 id="direction-v2-confirm-title">你正在选择「{direction.name}」</h2></div><button type="button" className="direction-v2__icon-button" onClick={onClose} aria-label="返回比较"><X size={18}/></button></header><p>{direction.thesis}</p><div className="direction-v2-confirm__summary"><div><span>你将带入概念页</span><strong>{direction.mustKeep?.slice(0, 3).join(" · ") || "当前方向的设计规则"}</strong></div><div><span>下一步先验证</span><strong>{direction.validationQuestions?.[0] || "方向是否能转化为可执行概念"}</strong></div></div><label>为什么选择这个方向？<span>可选，帮助团队保留决策理由</span><textarea rows="4" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="例如：它最能回应已确认洞察，并且适合当前核心场景。"/></label><footer><button type="button" className="direction-v2__text-button" onClick={onClose}>返回比较</button><button type="button" className="industrial-button industrial-button--primary" onClick={onConfirm}>确认选择，进入概念探索<ArrowRight size={16}/></button></footer></section></div>;
}

export function IndustrialDirectionPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const ensure = useMuseStore((state) => state.ensureDesignDirections);
  const lock = useMuseStore((state) => state.lockDesignDirection);
  const attempted = useRef("");
  const [detail, setDetail] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState(null);
  const brain = useMemo(() => project ? buildProjectBrain(project) : null, [project]);
  useEffect(() => {
    if (project?.designBrief && attempted.current !== projectId) {
      attempted.current = projectId;
      void ensure(projectId);
    }
  }, [ensure, project?.designBrief, projectId]);
  if (!project) return <StateBoundary project={project}/>;
  const directions = brain?.directionCandidates ?? project.designDirections ?? [];
  const acceptedEvidence = brain?.acceptedEvidence ?? [];
  const confirmedInsights = brain?.confirmedInsights ?? [];
  const selectedInsightIds = project.confirmedInsightIds ?? industrial.selectedInsightIds ?? [];
  const gateReady = acceptedEvidence.length >= 2 && confirmedInsights.length >= 1;
  const canChoose = Boolean(gateReady && project.designBrief?.status === "confirmed");
  const recommendation = project.directionRecommendation;
  const choose = (direction) => { setReason(""); setConfirming(direction); };
  const confirm = async () => {
    if (!confirming) return;
    try {
      await lock(projectId, confirming.id, reason);
      setConfirming(null);
      navigate(`/projects/${projectId}/concept`);
    } catch (error) {
      useMuseStore.getState().pushToast(error?.message === "INSIGHT_NOT_SELECTED" ? "请先确认至少一条设计洞察" : "方向还没有完成锁定，请检查当前简报与洞察状态", "warning");
    }
  };
  const isLoading = gateReady && (!project.directionContext || directions.length < 3);
  return <Page project={project} eyebrow="04 · 设计方向" title="把已确认洞察变成可比较的设计战略" description="方向页只承接已确认简报、已采纳研究证据和已确认设计洞察；这里比较的是战略取舍，不是图片或颜色。" showWorkflowConversion={false}>
    <section className="direction-v2-context"><div><p className="direction-v2__eyebrow">DIRECTION CONTEXT · {project.directionContext?.domain?.label || "当前项目"}</p><h2>先看核心路径，再决定往哪里走</h2><p>{project.directionContext?.coreDesignQuestion || project.designBrief?.coreDesignQuestion || "当前简报还没有形成可比较的核心设计问题。"}</p></div><div className="direction-v2-context__stats"><div><strong>{acceptedEvidence.length}</strong><span>已采纳证据</span></div><div><strong>{confirmedInsights.length}</strong><span>已确认洞察</span></div><div><strong>{directions.length || 0}</strong><span>可比较方向</span></div></div></section>
    {!project.designBrief || project.designBrief.status !== "confirmed" ? <div className="industrial-gate"><LockKeyhole size={18}/>请先确认设计简报；方向只读取确认后的上下文。</div> : null}
    {!gateReady ? <div className="industrial-gate direction-v2-gate"><LockKeyhole size={18}/><div><strong>方向生成已暂停</strong><span>正常决策链至少需要 2 条已采纳证据和 1 条已确认洞察；Muse 不会用模板方向填补缺口。</span></div><button type="button" onClick={() => navigate(acceptedEvidence.length < 2 ? `/projects/${projectId}/research` : `/projects/${projectId}/insight`)}>{acceptedEvidence.length < 2 ? "返回采纳证据" : "返回确认洞察"}<ArrowRight size={15}/></button></div> : null}
    {!gateReady ? <DirectionRecommendation recommendation={recommendation} directions={directions} onChoose={choose} onCompare={() => setExplanation(null)}/> : isLoading ? <section className="direction-v2-loading"><Sparkles size={18}/><div><strong>正在从已确认上下文建立方向比较</strong><p>正在检查领域、证据追溯和三条策略差异。方向阶段不生成图片。</p></div></section> : <>
      <div className="direction-v2-grid">{directions.map((direction) => <DirectionCard key={direction.id} direction={direction} selected={industrial.selectedDirectionId === direction.id} canChoose={canChoose} insights={confirmedInsights} evidence={acceptedEvidence} onDetails={setDetail} onChoose={choose}/>)}</div>
      <DirectionComparisonMatrix directions={directions} explanation={explanation} onExplain={setExplanation}/>
      <DirectionRecommendation recommendation={recommendation} directions={directions} onChoose={choose} onCompare={() => setExplanation(null)}/>
      <section className={`direction-v2-next ${industrial.selectedDirectionId ? "is-ready" : ""}`}><div><p className="direction-v2__eyebrow">下一步工作</p><h2>将已选方向发展为具体概念</h2><p>下一阶段将沿用当前方向的设计逻辑继续展开，而不是重新生成一套无关方案。</p></div><button type="button" className="industrial-button industrial-button--primary" disabled={!industrial.selectedDirectionId} onClick={() => navigate(`/projects/${projectId}/concept`)}>{industrial.selectedDirectionId ? "进入概念探索" : "先选择一个方向"}<ArrowRight size={17}/></button></section>
    </>}
    <DirectionDetailDrawer direction={detail} insights={confirmedInsights} evidence={acceptedEvidence} canChoose={canChoose} onClose={() => setDetail(null)} onChoose={(direction) => { setDetail(null); choose(direction); }}/>
    <DirectionSelectionDialog direction={confirming} reason={reason} onReasonChange={setReason} onClose={() => setConfirming(null)} onConfirm={() => void confirm()}/>
  </Page>;
}

export function IndustrialConceptPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const apply = useMuseStore((state) => state.applyIndustrialEvent);
  const projectBrain = useMemo(() => project ? buildProjectBrain(project) : null, [project]);
  const concepts = projectBrain?.conceptCandidates ?? [];
  useEffect(() => {
    if (!projectBrain) return;
    const meta = projectBrain.conceptGeneration ?? {};
    console.info('[ConceptGeneration]', JSON.stringify({
      stage: 'render',
      'HTTP status': meta['HTTP status'] ?? 0,
      provider: meta.provider ?? 'unknown',
      model: meta.model ?? 'unknown',
      rawContentLength: meta.rawContentLength ?? 0,
      parsedConceptCount: meta.parsedConceptCount ?? concepts.length,
      validationResult: concepts.length >= 2 ? 'success' : 'not-rendered',
      persistedConceptCount: concepts.length,
      renderedConceptCount: concepts.length,
    }));
  }, [concepts.length, projectBrain]);
  if (!project) return <StateBoundary project={project}/>;
  const choose = async (conceptId) => { await apply(projectId, { type: "CONCEPT_SELECTED", conceptId }); };
  const chooseVisual = async (visualId) => { await apply(projectId, { type: "VISUAL_SELECTED", visualId }); navigate(`/projects/${projectId}/cmf`); };
  const direction = industrial.directions.find((item) => item.id === industrial.selectedDirectionId);
  const selectedConcept = projectBrain?.selectedConcept ?? concepts.find((item) => item.id === industrial.selectedConceptId);
  const visuals = Array.from(new Map(
    (projectBrain?.generatedVisuals ?? [])
      .filter((item) => item.stage === "concept" && item.conceptId === selectedConcept?.id)
      .map((item) => [item.id, item]),
  ).values());
  const demoMode = isDemoPortfolioProject(project) || industrial.visualMode === "demo-asset";
  return <Page project={project} eyebrow="05 · 产品概念" title={direction ? `${direction.code} · ${direction.name} 的概念探索` : "先锁定方向"} description="先比较文字概念，确认后才调用图片 AI。图片不会反向替代产品逻辑。">
    {!direction ? <div className="industrial-gate"><LockKeyhole size={18}/>返回方向页锁定策略后，概念候选才会出现。</div> : <div className="industrial-concept-grid industrial-concept-grid--text">{concepts.map((item, index) => <article className={industrial.selectedConceptId === item.id ? "is-selected" : ""} key={item.id}>
       <div><span className="industrial-concept-code">Concept {String(index + 1).padStart(2, "0")}</span><h2>{item.name}</h2><p>{item.conceptStatement}</p><dl className="industrial-concept-details"><div><dt>核心机制</dt><dd>{item.coreMechanism}</dd></div><div><dt>用户体验</dt><dd>{item.userExperience}</dd></div><div><dt>为什么符合当前方向</dt><dd>{item.whyFitsDirection}</dd></div><div><dt>产品 / 空间表达</dt><dd>{item.productExpression ?? item.spatialExpression ?? item.brandExpression ?? item.digitalExpression ?? "待补充"}</dd></div></dl><strong>优势 · {(item.advantages ?? []).join("；")}</strong><small>风险 · {(item.risks ?? []).join("；")}</small><div className="industrial-concept-actions"><button onClick={() => choose(item.id)}>{industrial.selectedConceptId === item.id ? "已选为概念基线" : "选择此概念"} <ArrowRight size={16}/></button></div></div>
    </article>)}</div>}
    {selectedConcept ? <section className="industrial-visual-workbench"><header><div><p className="industrial-kicker">Visual Exploration</p><h2>围绕已选概念查看互补视觉</h2><p>{demoMode ? "这些视觉来自当前项目的演示资产，并与已选概念、CMF 和版本记录保持绑定。" : "主视图、交互视图、场景视图与结构细节共享同一个产品身份；只有真实图片服务返回后才会显示结果。"}</p></div><ConceptImageButton projectId={projectId} conceptId={selectedConcept.id} count={visuals.length} demoMode={demoMode}/></header>
      {visuals.length ? <div className={`industrial-visual-grid ${visuals.length === 1 ? "industrial-visual-grid--single" : ""}`}>{visuals.map((visual) => {
        const attributes = visual.visualAttributes ?? {};
        const visualLabel = visual.variation || visual.variant || "视觉方案";
        const visualDescription = visual.visualDescription || visual.rationale || `围绕${selectedConcept.name}建立的概念视觉。`;
        const directionRelation = direction?.name || selectedConcept.whyFitsDirection || "当前已选方向";
        const validationQuestion = selectedConcept.validationQuestions?.[0] || "确认视觉是否持续服务当前概念，而不是只呈现外观。";
        return <article className={`${industrial.selectedVisualId === visual.id ? "is-selected " : ""}${visuals.length === 1 ? "industrial-visual-card--single" : ""}`} key={visual.id}>
          <div className="industrial-visual-card__media"><img src={assetSrc(visual.imageUrl || visual.imagePath)} alt={`${selectedConcept.name} · ${visualLabel}`}/><span>{visuals.length === 1 ? "A · 当前视觉基线" : visualLabel}</span></div>
          <div className="industrial-visual-card__info">
            <header><div><strong>{visualLabel}</strong><small>{visual.visualMode === "demo-asset" ? "演示资产 · 当前项目" : `${visual.provider ?? "真实 Provider"} · ${visual.model ?? "已返回"}`}</small></div>{industrial.selectedVisualId === visual.id ? <span className="industrial-visual-card__status">已选基线</span> : null}</header>
            {visuals.length === 1 ? <><p className="industrial-visual-card__description">{visualDescription}</p><dl className="industrial-visual-card__reading"><div><dt>继承方向</dt><dd>{directionRelation}</dd></div><div><dt>产品形态</dt><dd>{attributes.form || selectedConcept.productExpression || selectedConcept.coreMechanism || "沿用当前概念机制"}</dd></div><div><dt>交互暗示</dt><dd>{attributes.interaction || selectedConcept.userExperience || "围绕当前核心任务展开"}</dd></div><div><dt>下一步判断</dt><dd>{validationQuestion}</dd></div></dl></> : null}
            <button onClick={() => chooseVisual(visual.id)}>{industrial.selectedVisualId === visual.id ? "已选为视觉基线" : "选定并进入材料阶段"}<ArrowRight size={15}/></button>
          </div>
        </article>;
      })}</div> : <div className="industrial-empty">当前概念还没有对应视觉资产。不会随机拿其他项目图片顶替。</div>}
    </section> : null}
  </Page>;
}

export function IndustrialCMFPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const apply = useMuseStore((state) => state.applyIndustrialEvent);
  if (!project) return <StateBoundary project={project}/>;
  const language = materialLanguageFor(project);
  const projectBrain = buildProjectBrain(project);
  const selectedVisual = projectBrain.selectedVisual;
  const choose = async (cmfId) => { await apply(projectId, { type: "CMF_SELECTED", cmfId }); navigate(`/projects/${projectId}/review`); };
  return <Page project={project} eyebrow={language.eyebrow} title={language.title} description={`每套${language.noun}都保留部位、理由、风险、父视觉与生成来源，不能只做换色。`}>
    <section className="industrial-cmf-overview">
      <div><p className="industrial-kicker">Decision First · 不生成 CMF 图片</p><h2>先决定触点、耐久与清洁边界，再把视觉作为小型参考。</h2><p>本阶段只调用文字 AI 输出材料、颜色、表面处理和验证目标；不会把多张图片拼成一张“材料效果图”，也不会用空白图替代工程判断。</p></div>
      {selectedVisual ? <aside className="industrial-cmf-preview"><img src={assetSrc(selectedVisual.imageUrl || selectedVisual.imagePath || selectedVisual.image)} alt="当前选定的概念视觉基线"/><span>视觉基线 · {selectedVisual.variation || selectedVisual.variant || "当前概念"}</span></aside> : <aside className="industrial-cmf-preview industrial-cmf-preview--empty"><span>尚未选择视觉基线</span><small>CMF 决策仍可先从材料与触点开始</small></aside>}
    </section>
    <div className="industrial-cmf-grid">{industrial.cmfSchemes.filter((item) => !item.conceptId || item.conceptId === industrial.selectedConceptId).map((item) => <article className={industrial.selectedCMFId === item.id ? "is-selected" : ""} key={item.id}>
       <div className="industrial-cmf-decision"><div className="industrial-cmf-decision-head"><div><p className="industrial-kicker">方案 {item.code}</p><h2>{item.name}</h2></div>{industrial.selectedCMFId === item.id ? <span className="industrial-cmf-selected"><Check size={14}/>已选方案</span> : null}</div><p className="industrial-cmf-summary">{item.summary}</p>{item.parts.map((part) => <div className="industrial-material" key={part.part}><div><strong>{part.part}</strong><span className="industrial-material-spec"><i className="industrial-color-chip" style={{ background: materialSwatch(part.color) }} aria-hidden="true"/>{part.material} · {part.color} · {part.finish}</span></div><p>{part.rationale}</p><div className="industrial-material-meta"><span><b>风险</b>{part.risk || "待验证"}</span><span><b>验证目标</b>{materialValidationLabel(part)}</span></div></div>)}<p className="industrial-provenance">来源：{item.imageSource === "demo-asset" || item.visualMode === "demo-asset" ? "演示资产（仅作参考）" : item.contentOrigin === "real_ai" ? `${item.provider ?? "DeepSeek"} · ${item.model ?? "REAL"}` : "项目决策数据"}</p><button onClick={() => choose(item.id)}>选择方案 {item.code} <ArrowRight size={16}/></button></div>
    </article>)}</div>
  </Page>;
}

export function IndustrialReviewPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const runReview = useMuseStore((state) => state.runIndustrialReview);
  const createRevision = useMuseStore((state) => state.createIndustrialRevision);
  const setIssueDecision = useMuseStore((state) => state.setIndustrialReviewIssueDecision);
  const aiJob = useMuseStore((state) => state.aiJob);
  const [editingIssueId, setEditingIssueId] = useState(null);
  const [editedRecommendation, setEditedRecommendation] = useState("");
  const [capabilities, setCapabilities] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    void aiClient.capabilities(controller.signal).then(setCapabilities).catch((error) => {
      if (error?.name !== "AbortError") setCapabilities(null);
    });
    return () => controller.abort();
  }, []);
  if (!project) return <StateBoundary project={project}/>;
  const primaryNeed = industrial.brief.keyNeeds[0] || "核心任务";
  const review = industrial.reviews.find((item) => item.id === industrial.currentReviewId);
  const revise = async (issueId) => { const version = await createRevision(projectId, issueId); if (version) navigate(`/projects/${projectId}/versions`); };
  const decide = async (issue, decision) => { await setIssueDecision(projectId, issue.id, decision, decision === "edited" ? editedRecommendation : undefined); setEditingIssueId(null); setEditedRecommendation(""); };
  const textAiReady = Boolean(capabilities?.providers?.text?.ready);
  return <Page project={project} eyebrow="07 · 设计评审" title="评审的产物是可行动问题，不是一个总分" description="AI 读取完整项目上下文；你决定采纳哪条建议，并把它写进下一版本。" actions={<SecondaryButton title={textAiReady ? undefined : "请先在设置中连接 DeepSeek Text AI"} disabled={!industrial.selectedCMFId || aiJob.status === "processing" || !textAiReady} onClick={() => runReview(projectId)}><RefreshCw size={15}/> {textAiReady ? (review ? "重新评审" : "生成证据化评审") : "文字 AI 未连接"}</SecondaryButton>}>
    {!industrial.selectedCMFId ? <div className="industrial-gate"><LockKeyhole size={18}/>完成方向、概念与 CMF 决策后才能评审。</div> : null}
    {aiJob.status === "processing" ? <div className="industrial-review-processing"><Sparkles size={18}/> {aiJob.message}</div> : null}
    {review ? <div className="industrial-review">
      <section className="industrial-review-summary"><p className="industrial-kicker">当前方案上下文</p><h2>{review.context.direction} / {review.context.concept} / {review.context.cmf}</h2><p>{review.summary}</p>{review.context.visualInspection === "metadata-only" ? <small className="industrial-review-vision-note">当前评审未接入 Vision Review Provider；视觉维度只检查生成元数据与一致性规则，不会假装看过图片像素。</small> : null}</section>
       <div className="industrial-strengths">{review.strengths.map((item, index) => <article key={`${item.title || "strength"}-${index}`}><Check size={17}/><div><strong>{item.title}</strong><p>{item.evidence}</p></div></article>)}</div>
       <div className="industrial-issues">{review.issues.map((item, index) => <article key={`${item.id || "issue"}-${index}`}><header><span className={`severity severity--${item.severity}`}>{item.severity === "high" ? "高风险" : item.severity === "low" ? "低风险" : "中风险"}</span><span className="industrial-review-dimension">{item.dimension || `检查项 ${index + 1}`}</span><h3>{item.title}</h3></header><dl><div><dt>证据</dt><dd>{item.evidence}</dd></div><div><dt>影响</dt><dd>{item.impact}</dd></div><div><dt>建议动作</dt><dd>{item.recommendation}</dd></div></dl><div className="industrial-issue-context"><span>决策门槛</span><p>{item.severity === "high" ? `在“${primaryNeed}”完成可复现的寿命与操作验证前，不进入下一轮量产判断。` : "先保留为可追踪假设，完成对比测试后再决定是否改变当前方案。"}</p></div>{editingIssueId === item.id ? <div className="industrial-review-edit"><label htmlFor={`review-edit-${item.id}`}>编辑后再接受</label><textarea id={`review-edit-${item.id}`} value={editedRecommendation} onChange={(event) => setEditedRecommendation(event.target.value)} rows="3"/><div><button onClick={() => setEditingIssueId(null)}>取消</button><button disabled={!editedRecommendation.trim()} onClick={() => decide(item, "edited")}>保存编辑</button></div></div> : null}<footer><span><CircleAlert size={15}/>{item.decision === "accepted" ? "已接受" : item.decision === "edited" ? "已编辑并接受" : item.decision === "ignored" ? "已忽略" : item.validationState === "TO_BE_VALIDATED" ? "待验证" : "AI 建议，待人工确认"}</span><div className="industrial-review-actions"><button className={item.decision === "accepted" ? "is-active" : ""} onClick={() => decide(item, "accepted")}>接受</button><button className={item.decision === "ignored" ? "is-active" : ""} onClick={() => decide(item, "ignored")}>忽略</button><button onClick={() => { setEditingIssueId(item.id); setEditedRecommendation(item.recommendation); }}>编辑</button>{["accepted", "edited"].includes(item.decision) ? <button className="industrial-review-apply" onClick={() => revise(item.id)}>应用到图片并创建版本 <ArrowRight size={15}/></button> : null}</div></footer></article>)}</div>
    </div> : <div className="industrial-empty industrial-empty--large">设计评审尚未生成。这里不会显示装饰性评分。</div>}
  </Page>;
}

export function IndustrialVersionsPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  if (!project) return <StateBoundary project={project}/>;
  return <Page project={project} eyebrow="08 · 版本记录" title="版本记录解释为什么改变" description="每个版本都保留触发问题、修改内容和设计理由。" actions={<PrimaryButton onClick={() => navigate(`/projects/${projectId}/decision-map`)}>查看决策地图</PrimaryButton>}>
     {industrial.versionStory.length ? <div className="industrial-version-track">{industrial.versionStory.map((item, index) => { const versionNumber = Number.isFinite(Number(item.number)) && Number(item.number) > 0 ? Number(item.number) : index + 1; const parent = item.parentVersionId ? industrial.versionStory.find((candidate) => candidate.id === item.parentVersionId) : null; return <article className={item.id === industrial.currentVersionId ? "is-current" : ""} key={item.id}><div className="industrial-version-number">V{versionNumber}</div><div className="industrial-version-visuals">{parent?.image ? <img src={assetSrc(parent.image)} alt="上一版本视觉"/> : <span>无上一版本视觉</span>}<span className="industrial-version-arrow">→</span>{item.image ? <img src={assetSrc(item.image)} alt="当前版本视觉"/> : <span>当前版本暂无视觉</span>}</div><div><p className="industrial-kicker">{index === industrial.versionStory.length - 1 ? "当前版本" : "历史版本"} · {parent ? `继承 ${parent.label}` : "项目起点"}</p><h2>{item.label}</h2><dl><div><dt>触发</dt><dd>{item.reviewTrigger || "项目阶段决策"}</dd></div><div><dt>改变</dt><dd>{item.whatChanged || item.changeSummary || "未记录具体改变"}</dd></div><div><dt>原因</dt><dd>{item.why || "未记录设计理由"}</dd></div></dl><div className="industrial-version-followup"><span><b>保留</b>{(item.retained ?? []).join("；") || "未记录"}</span><span><b>下一步验证</b>{(item.nextValidation ?? []).join("；") || "待定义"}</span></div></div></article>; })}</div> : <div className="industrial-empty industrial-empty--large">完成一次评审并采纳建议后，这里会保存第一条版本记录。</div>}
  </Page>;
}

export function IndustrialDecisionMapPage() {
  const navigate = useNavigate();
  const { project, industrial, projectId } = useIndustrialProject();
  const [activeNodeId, setActiveNodeId] = useState(null);
  if (!project) return <StateBoundary project={project}/>;
  const brain = buildProjectBrain(project);
  const direction = brain.directionCandidates.find((item) => item.id === industrial.selectedDirectionId) ?? brain.lockedDirection;
  const concept = brain.selectedConcept;
  const visual = brain.selectedVisual;
  const cmf = brain.cmfDecision;
  const acceptedEvidenceCount = brain.acceptedEvidence.length;
  const confirmedInsightCount = brain.confirmedInsights.length;
  const evidenceIds = new Set(brain.acceptedEvidence.map((item) => String(item.id ?? "")));
  const unsupportedInsightCount = brain.confirmedInsights.filter((item) => !Array.isArray(item.evidenceIds) || !item.evidenceIds.some((id) => evidenceIds.has(String(id)))).length;
  const summary = (value, fallback) => String(value ?? "").trim() || fallback;
  const compact = (value, max = 140) => {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const briefValue = (value, fallback = "未填写") => {
    if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean).join("；") || fallback;
    return summary(value, fallback);
  };
  const workflowBriefPattern = /必须设计的内容|请帮助我完成|Moodboard|Creative Direction|最终希望看到|不要预先固定/iu;
  const decisionFor = (stage) => [...brain.decisions].reverse().find((item) => String(item.stage ?? item.type ?? "").toLowerCase().includes(stage));
  const stateFor = (complete, attention = false) => attention ? { label: "需要检查", tone: "attention" } : complete ? { label: "已完成", tone: "complete" } : { label: "待完成", tone: "pending" };
  const briefCandidate = [brain.projectOverview.projectSummary, brain.projectOverview.designGoal, brain.originalBrief.designGoal, brain.designBrief.designObjective].map((item) => String(item ?? "").trim()).find((item) => item && !workflowBriefPattern.test(item));
  const targetUser = briefValue(brain.originalBrief.audience ?? brain.designBrief.targetUser?.primary, "目标用户");
  const coreScenario = briefValue(brain.originalBrief.context ?? brain.designBrief.coreScenario, "核心使用场景");
  const briefGoal = compact(briefCandidate ?? `围绕${project.name}，为${targetUser}在${coreScenario}中解决核心使用问题，并保留可验证的设计边界。`);
  const coreQuestion = compact(summary(brain.designBrief.coreDesignQuestion, `如何在${coreScenario}中为${targetUser}解决核心使用问题？`), 120);
  const originalBriefDetail = [
    { label: "设计目标", value: briefValue(brain.originalBrief.designGoal, briefGoal) },
    { label: "目标用户", value: briefValue(brain.originalBrief.audience, targetUser) },
    { label: "使用场景", value: briefValue(brain.originalBrief.context, coreScenario) },
    { label: "预期交付物", value: briefValue(brain.originalBrief.deliverables) },
    { label: "限制条件", value: briefValue(brain.originalBrief.constraints) },
    { label: "设计关键词", value: briefValue(brain.originalBrief.keywords) },
    { label: "避免项", value: briefValue(brain.originalBrief.avoid) },
  ];
  const directionName = direction ? `${direction.code ? `${direction.code} · ` : ""}${summary(direction.name, "已锁定方向")}` : "尚未锁定设计方向";
  const conceptName = concept ? `${concept.code ? `${concept.code} · ` : ""}${summary(concept.name, "已选择概念")}` : "尚未选择产品概念";
  const visualName = visual ? `${summary(visual.variation ?? visual.variant, "视觉基线")} · ${visual.visualMode === "demo-asset" ? "演示资产" : summary(visual.provider, "真实 Provider")}` : "尚未选择视觉基线";
  const cmfName = cmf ? `${cmf.code ? `${cmf.code} · ` : ""}${summary(cmf.name, "已选择材料方案")}` : "尚未选择材料与色彩方案";
  const reviewCount = brain.reviewResults.length;
  const version = brain.versionEvents.at(-1);
  const nodes = [
    { id: "brief", stage: "01 · 项目起点", label: "原始需求", value: briefGoal, summary: "保留用户真正输入的目标与边界，作为后续判断的起点。", why: "不让 AI 改写覆盖原始命题，避免项目越做越偏。", source: "Project.originalBrief", evidence: "用户输入", state: stateFor(Boolean(project.originalBrief || brain.designBrief)), cta: "查看原始需求", action: () => navigate(`/projects/${projectId}/overview`), detail: originalBriefDetail },
    { id: "question", stage: "02 · 问题定义", label: "核心设计问题", value: coreQuestion, summary: "把项目目标收敛成可以被研究、比较和验证的问题。", why: "研究必须围绕一个清晰问题展开，而不是堆积资料。", source: "DesignBrief.coreDesignQuestion", evidence: "简报已确认", state: stateFor(Boolean(brain.designBrief.coreDesignQuestion)), cta: "查看设计简报", action: () => navigate(`/projects/${projectId}/brief`), detail: [{ label: "核心张力", value: summary(brain.designBrief.coreTension?.explanation, "尚未形成") }, { label: "成功标准", value: Array.isArray(brain.designBrief.initialSuccessCriteria) ? brain.designBrief.initialSuccessCriteria.map((item) => item.label).join("、") : "尚未填写" }] },
    { id: "evidence", stage: "03 · 事实输入", label: "研究证据", value: acceptedEvidenceCount ? `${acceptedEvidenceCount} 条已采纳证据` : "还没有已采纳证据", summary: acceptedEvidenceCount ? "只有被保留且有来源的事实进入判断链。" : "先完成证据核验，后续洞察才有可追溯依据。", why: "没有证据的判断不能被当成事实，也不能直接推动方案。", source: "ResearchWorkspace.evidence", evidence: acceptedEvidenceCount ? `${acceptedEvidenceCount} 条来源已保留` : "证据链为空", state: stateFor(acceptedEvidenceCount > 0, confirmedInsightCount > 0 && acceptedEvidenceCount === 0), cta: "查看研究证据", action: () => navigate(`/projects/${projectId}/research`), detail: brain.acceptedEvidence.slice(0, 3).map((item) => ({ label: summary(item.title, "证据"), value: summary(item.designImplication, summary(item.interpretation, "已采纳")) })) },
    { id: "insight", stage: "04 · 判断形成", label: "设计洞察", value: confirmedInsightCount ? `${confirmedInsightCount} 条已确认洞察` : "等待证据转成洞察", summary: confirmedInsightCount ? "把重复出现的事实模式转成可比较的机会点。" : "完成证据筛选后，才会出现可确认的洞察。", why: "洞察是事实与设计动作之间的桥，不是脱离证据的口号。", source: "DesignInsights.insights", evidence: unsupportedInsightCount ? `${unsupportedInsightCount} 条洞察缺少采纳证据` : `${confirmedInsightCount} 条洞察已关联证据`, state: stateFor(confirmedInsightCount > 0, unsupportedInsightCount > 0), cta: "查看设计洞察", action: () => navigate(`/projects/${projectId}/insight`), detail: brain.confirmedInsights.slice(0, 3).map((item) => ({ label: summary(item.title, "洞察"), value: summary(item.designImplication, summary(item.insightStatement, "已确认")) })), anomaly: unsupportedInsightCount > 0 ? `当前有 ${unsupportedInsightCount} 条已确认洞察没有找到已采纳证据支持，先回到研究证据补齐链路。` : undefined },
    { id: "direction", stage: "05 · 策略选择", label: "设计方向", value: directionName, summary: direction ? summary(direction.thesis, "已锁定一条可执行方向。") : "等待从洞察中选择一条策略。", why: "方向必须解释它回应了哪些洞察，以及会牺牲什么。", source: "DesignDirections + user decision", evidence: direction ? `${(direction.evidenceIds ?? []).length} 条证据 · ${(direction.insightIds ?? []).length} 条洞察` : "尚未产生用户选择", state: stateFor(Boolean(direction)), cta: direction ? "查看已锁定方向" : "进入设计方向", action: () => navigate(`/projects/${projectId}/direction`), detail: direction ? [{ label: "战略机制", value: summary(direction.strategicMechanism, direction.thesis) }, { label: "主要风险", value: summary(direction.biggestRisk, (direction.risks ?? []).join("、") || "待验证") }, { label: "选择理由", value: summary(decisionFor("direction")?.reason, "当前项目没有单独记录选择理由。") }] : [] },
    { id: "concept", stage: "06 · 产品化", label: "产品概念", value: conceptName, summary: concept ? summary(concept.conceptStatement, "已选择一个具体概念。") : "方向锁定后，这里会记录唯一概念基线。", why: "概念让材料、结构、交互和场景服务同一件产品，而不是只做外观换色。", source: "ProjectBrain.conceptCandidates + user decision", evidence: concept ? "方向约束已继承" : "等待方向锁定", state: stateFor(Boolean(concept)), cta: concept ? "查看产品概念" : "进入产品概念", action: () => navigate(`/projects/${projectId}/concept`), detail: concept ? [{ label: "核心机制", value: summary(concept.coreMechanism, "未填写") }, { label: "用户体验", value: summary(concept.userExperience, "未填写") }] : [] },
    { id: "visual", stage: "07 · 视觉基线", label: "视觉方案", value: visualName, summary: visual ? (visual.visualMode === "demo-asset" ? "已选定与当前概念绑定的演示视觉，后续 CMF、评审与版本会沿用同一父视觉。" : "已选定真实生成图作为后续 CMF 与评审的父视觉。") : "概念确认后，生成并选择一张与概念匹配的视觉。", why: "视觉必须继承概念身份，不能让孤立图片反向决定产品逻辑。", source: "GeneratedVisuals + selectedVisualId", evidence: visual ? (visual.visualMode === "demo-asset" ? "当前项目 Demo Visual" : `${visual.provider ?? "真实 Provider"} · ${visual.model ?? "已返回"}`) : "视觉服务尚未产生已选结果", state: stateFor(Boolean(visual)), cta: visual ? "查看视觉探索" : "进入视觉探索", action: () => navigate(`/projects/${projectId}/concept`), detail: visual ? [{ label: "视觉描述", value: summary(visual.visualDescription ?? visual.generationBrief, "未记录") }, { label: "生成时间", value: summary(visual.generatedAt, "未记录") }] : [] },
    { id: "cmf", stage: "08 · 物性决策", label: "材料与色彩", value: cmfName, summary: cmf ? summary(cmf.summary, "已选择一套带材料理由的 CMF 方案。") : "等待视觉基线，再对材料、颜色和表面处理做受控判断。", why: "CMF 应回应触感、清洁、耐久和品牌感知，不是单纯换色。", source: "CmfDecision + selectedVisualId", evidence: cmf ? `${(cmf.parts ?? []).length} 个部位有材料说明` : "尚未形成材料决策", state: stateFor(Boolean(cmf)), cta: cmf ? "查看材料与色彩" : "进入材料与色彩", action: () => navigate(`/projects/${projectId}/cmf`), detail: cmf ? (cmf.parts ?? []).slice(0, 4).map((part) => ({ label: summary(part.part, "部位"), value: `${summary(part.material, "材料待定")} · ${summary(part.color, "颜色待定")} · ${summary(part.finish, "表面待定")}` })) : [] },
    { id: "review", stage: "09 · 风险判断", label: "设计评审", value: reviewCount ? `${reviewCount} 次评审 · ${industrial.currentReviewId ? "当前版本有待处理问题" : "已保留历史结果"}` : "还没有证据化评审", summary: reviewCount ? "把风险拆成证据、影响和下一步动作，再由用户决定是否采纳。" : "完成 CMF 后生成评审，避免用装饰性分数替代判断。", why: "评审的输出是可执行问题，不是一个脱离上下文的总分。", source: "Industrial.reviews", evidence: reviewCount ? `${reviewCount} 份评审结果` : "等待 CMF 决策", state: stateFor(reviewCount > 0), cta: "查看设计评审", action: () => navigate(`/projects/${projectId}/review`), detail: brain.reviewResults.slice(-2).map((item) => ({ label: summary(item.summary, "评审结果"), value: Array.isArray(item.issues) ? `${item.issues.length} 个问题进入处理` : "已生成" })) },
    { id: "version", stage: "10 · 迭代留痕", label: "版本记录", value: version ? summary(version.label, "当前版本") : "等待第一次版本迭代", summary: version ? summary(version.whatChanged, "已保留本轮改变。") : "采纳评审问题后，Muse 会记录触发、改变和理由。", why: "版本让设计因果链可以被回看，而不是只留下最终图片。", source: "Industrial.versionStory", evidence: version ? `${brain.versionEvents.length} 个版本事件` : "尚未创建版本", state: stateFor(Boolean(version)), cta: "查看版本记录", action: () => navigate(`/projects/${projectId}/versions`), detail: version ? [{ label: "触发", value: summary(version.reviewTrigger, "未记录") }, { label: "改变", value: summary(version.whatChanged, "未记录") }, { label: "原因", value: summary(version.why, "未记录") }] : [] },
  ];
  const activeNode = nodes.find((node) => node.id === activeNodeId);
  return <Page project={project} eyebrow="决策地图 · Design Decision Trace" title="从问题到方案，每一步都有来处" description={`这是 ${project.name} 的真实设计决策链。地图只读取 ProjectBrain，不重新调用 AI 编造解释。`}>
    <div className="decision-timeline-toolbar"><div><strong>当前进度 {nodes.filter((node) => node.state.tone === "complete").length} / {nodes.length}</strong><span>证据 → 洞察 → 方向 → 概念 → 视觉 → CMF → 评审 → 版本</span></div>{unsupportedInsightCount > 0 ? <div className="decision-timeline-warning"><CircleAlert size={16}/>证据链不完整：{unsupportedInsightCount} 条洞察缺少采纳证据</div> : <StatusPill status="success">链路可追溯</StatusPill>}</div>
    <div className={`decision-timeline-layout ${activeNode ? "" : "decision-timeline-layout--solo"}`}><section className="decision-timeline" aria-label="纵向设计决策时间线">{nodes.map((node, index) => <article className={`decision-timeline-node decision-timeline-node--${node.state.tone} ${activeNodeId === node.id ? "is-active" : ""}`} key={node.id}><div className="decision-timeline-rail"><span>{String(index + 1).padStart(2, "0")}</span>{index < nodes.length - 1 ? <i aria-hidden="true"/> : null}</div><div className="decision-timeline-card"><header><div><p>{node.stage}</p><h2>{node.label}</h2></div><StatusPill status={node.state.tone === "complete" ? "success" : "warn"}>{node.state.label}</StatusPill></header><strong className="decision-timeline-value">{node.value}</strong><p className="decision-timeline-summary">{node.summary}</p><div className="decision-timeline-meta"><span><b>为什么</b>{node.why}</span><span><b>依据</b>{node.evidence}</span></div>{node.anomaly ? <div className="decision-timeline-anomaly"><CircleAlert size={15}/><span>{node.anomaly}</span></div> : null}<footer><span>{node.source}</span><div><button type="button" className="decision-timeline-detail-button" onClick={() => setActiveNodeId(node.id)}>查看详情</button>{node.cta ? <button type="button" onClick={node.action}>{node.cta}<ArrowRight size={15}/></button> : null}</div></footer></div></article>)}</section>{activeNode ? <aside className="decision-timeline-drawer" aria-label={`${activeNode.label}详情`}><header><div><p className="industrial-kicker">{activeNode.stage}</p><h2>{activeNode.label}</h2></div><button type="button" className="decision-timeline-drawer__close" aria-label="关闭详情" onClick={() => setActiveNodeId(null)}><X size={18}/></button></header><div className="decision-timeline-drawer__content"><p className="decision-timeline-drawer__value">{activeNode.value}</p><dl><div><dt>为什么发生</dt><dd>{activeNode.why}</dd></div><div><dt>上游依据</dt><dd>{activeNode.source}</dd></div><div><dt>当前状态</dt><dd>{activeNode.evidence}</dd></div></dl>{activeNode.id === "brief" ? <div className="decision-timeline-original"><h3>Original Brief · 原始需求</h3>{activeNode.detail.map((item) => <div key={item.label}><b>{item.label}</b><p>{item.value}</p></div>)}</div> : activeNode.detail.length ? <div className="decision-timeline-detail-list">{activeNode.detail.map((item) => <div key={item.label}><b>{item.label}</b><p>{item.value}</p></div>)}</div> : <p className="decision-timeline-empty">这个阶段还没有可展开的业务结果。完成上游动作后，详情会从项目数据中出现。</p>}{activeNode.anomaly ? <div className="decision-timeline-anomaly"><CircleAlert size={15}/><span>{activeNode.anomaly}</span></div> : null}</div><footer><button type="button" onClick={activeNode.action}>{activeNode.cta}<ArrowRight size={15}/></button></footer></aside> : null}</div>
  </Page>;
}
