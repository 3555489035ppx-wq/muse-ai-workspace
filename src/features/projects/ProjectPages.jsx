import { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Grid2X2,
  ImagePlus,
  List,
  LayoutTemplate,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppShell, Brand } from "../../components/shell";
import {
  Button,
  ConfirmDialog,
  CustomSelect,
  EmptyState,
  Field,
  IconButton,
  ProcessingCard,
  SearchInput,
  StatusPill,
  Surface,
  TagList,
} from "../../components/ui";
import { stageLabel, templateCatalog } from "../../data/catalog";
import { phaseOneTemplateCatalog } from "../../application/template/catalog";
import { formatDate } from "../../lib/ids";
import { useMuseStore } from "../../stores/useMuseStore";

export function useProjectRecord() {
  const { projectId } = useParams();
  const project = useMuseStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const brief = useMuseStore((state) =>
    state.briefs.find((item) => item.projectId === projectId),
  );
  return { projectId, project, brief };
}

export function MissingProject() {
  return (
    <AppShell>
      <EmptyState
        title="找不到这个项目"
        description="项目可能已移到回收站，或链接已经失效。"
        action={
          <Link className="button button--default" to="/projects">
            返回我的项目
          </Link>
        }
      />
    </AppShell>
  );
}

export function filterProjects(projects, query, stage) {
  const normalizedQuery = query.trim().toLowerCase();
  return projects.filter((project) => {
    const queryMatch = project.name.toLowerCase().includes(normalizedQuery);
    return queryMatch && (stage === "all" || project.stage === stage);
  });
}

export function projectDestination(project) {
  return project.isDraft
    ? `/projects/${project.id}/${project.projectUnderstandingConfirmedAt ? "brief" : "overview"}`
    : `/projects/${project.id}/workspace`;
}

const homeTemplateCover = {
  "便携式产品概念": "/assets/portfolio/journey-water-capsule/journey-water-capsule-concept-01.png",
  "家居小电器设计": "/assets/portfolio/kitchen-loop-reclaimer/kitchen-loop-reclaimer-concept-01.png",
  "母婴产品设计": "/assets/jinganbao/concepts/care-tactile-v1.png",
  "智能硬件外观设计": "/assets/portfolio/quiet-air-lighthouse/quiet-air-lighthouse-concept-01.png",
};

const stageProgress = { brief: 12, research: 28, moodboard: 44, directions: 58, exploration: 72, critique: 88, complete: 100 };

export function projectProgress(project) {
  return Number.isFinite(project.progress)
    ? Math.max(0, Math.min(100, project.progress))
    : (stageProgress[project.stage] ?? 0);
}

function ProjectProgress({ project }) {
  const progress = projectProgress(project);
  return (
    <div
      className="project-card__meter"
      role="progressbar"
      aria-label={`${project.name} 完成进度`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}

function ProjectActions({ project, busy, onOpen, onDuplicate, onSaveTemplate, onDelete }) {
  return (
    <div className="project-card__actions" aria-label={`${project.name} 项目操作`}>
      <button disabled={busy} onClick={() => onOpen(project)}>
        继续项目
        <ArrowRight aria-hidden="true" size={14} />
      </button>
      <button disabled={busy} onClick={() => onDuplicate(project)}>
        <Copy aria-hidden="true" size={14} />
        创建副本
      </button>
      <button disabled={busy} onClick={() => onSaveTemplate(project)}>
        <Save aria-hidden="true" size={14} />
        存为模板
      </button>
      <button disabled={busy} onClick={() => onDelete(project)}>
        <Trash2 aria-hidden="true" size={14} />
        移到回收站
      </button>
    </div>
  );
}

function projectCover(project) {
  if (project.coverImage || project.cover) {
    return project.coverImage || project.cover;
  }
  return "/assets/projects/project-flow-horizon-v1.png";
}

function ProjectGridCard({ project, busy, onOpen, onDuplicate, onSaveTemplate, onDelete }) {
  const progress = projectProgress(project);
  return (
    <article className="project-card" data-project-id={project.id}>
      <button className="project-card__cover" onClick={() => onOpen(project)} aria-label={`打开${project.name}`}>
        <img src={projectCover(project)} alt="" />
      </button>
      <div className="project-card__body">
        <StatusPill status={project.isDraft ? "warn" : "ai"}>
          {project.isDraft ? "简报草稿" : stageLabel[project.stage]}
        </StatusPill>
        <h3>{project.name}</h3>
        <p>更新于 {formatDate(project.updatedAt)} · 完成 {progress}%</p>
        <ProjectProgress project={project} />
        <ProjectActions {...{ project, busy, onOpen, onDuplicate, onSaveTemplate, onDelete }} />
      </div>
    </article>
  );
}

function ProjectListRow({ project, busy, onOpen, onDuplicate, onSaveTemplate, onDelete }) {
  const progress = projectProgress(project);
  return (
    <article className="project-list-row" data-project-id={project.id} role="listitem">
      <button className="project-list-row__cover" onClick={() => onOpen(project)} aria-label={`打开${project.name}`}>
        <img src={projectCover(project)} alt="" />
      </button>
      <div className="project-list-row__identity">
        <h3>{project.name}</h3>
        <p>更新于 {formatDate(project.updatedAt)}</p>
      </div>
      <StatusPill status={project.isDraft ? "warn" : "ai"}>
        {project.isDraft ? "简报草稿" : stageLabel[project.stage]}
      </StatusPill>
      <div className="project-list-row__progress">
        <span>{progress}%</span>
        <ProjectProgress project={project} />
      </div>
      <ProjectActions {...{ project, busy, onOpen, onDuplicate, onSaveTemplate, onDelete }} />
    </article>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useMuseStore((state) => state.projects);
  const duplicateProject = useMuseStore((state) => state.duplicateProject);
  const moveProjectToTrash = useMuseStore((state) => state.moveProjectToTrash);
  const saveProjectAsTemplate = useMuseStore(
    (state) => state.saveProjectAsTemplate,
  );
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [view, setView] = useState("grid");
  const [quickIdea, setQuickIdea] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyProjectId, setBusyProjectId] = useState(null);
  const [operationError, setOperationError] = useState("");
  const filtered = useMemo(
    () => filterProjects(projects, query, stage),
    [projects, query, stage],
  );
  const userProjects = useMemo(() => filtered.filter((project) => project.ownerScope === "user" || project.isDraft), [filtered]);
  const exampleProjects = useMemo(() => filtered.filter((project) => !(project.ownerScope === "user" || project.isDraft)), [filtered]);
  const hasFilters = Boolean(query.trim()) || stage !== "all";
  const openProject = (project) => navigate(projectDestination(project));
  const startQuickProject = () => {
    const idea = quickIdea.trim();
    navigate(idea ? `/projects/new?idea=${encodeURIComponent(idea)}` : "/projects/new");
  };
  const runProjectAction = async (project, action) => {
    if (busyProjectId) return;
    setOperationError("");
    setBusyProjectId(project.id);
    try {
      await action();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "项目操作失败，请重试。 ");
    } finally {
      setBusyProjectId(null);
    }
  };
  const duplicate = (project) => runProjectAction(project, async () => {
    const next = await duplicateProject(project.id);
    if (!next) throw new Error("无法创建项目副本。");
    navigate(`/projects/${next.id}/workspace`);
  });
  const saveAsTemplate = (project) => runProjectAction(project, async () => {
    const template = await saveProjectAsTemplate(project.id);
    if (!template) throw new Error("无法保存为模板。");
  });
  const projectViewProps = {
    onOpen: openProject,
    onDuplicate: duplicate,
    onSaveTemplate: saveAsTemplate,
    onDelete: setPendingDelete,
  };
  return (
    <AppShell>
      <div className="projects-page">
        <section className="projects-hero projects-hero--brand liquid-glass-surface" data-tour="home">
          <div className="projects-hero__copy">
            <h1><span>灵感自此</span><span>有了形状</span></h1>
            <p>把零散灵感组织成可研究、可比较、可追溯的创意方向。</p>
            <Button className="liquid-glass-control" data-tour="create" icon={ArrowRight} onClick={() => navigate("/projects/new")}>
              开始新项目
            </Button>
          </div>
          <div className="projects-hero__visual" aria-hidden="true">
            <picture>
              <source media="(max-width: 640px)" srcSet="/assets/brand/muse-goddess-hero-mobile.webp" />
              <img
                src="/assets/brand/muse-goddess-hero.webp"
                alt=""
              />
            </picture>
          </div>
        </section>
        <section className="projects-section projects-section--projects">
          <div className="section-heading">
            <div>
              <span>本地工作区</span>
              <h2>我的项目</h2>
            </div>
            <div className="project-controls">
              <SearchInput
                label="搜索项目"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索项目名称"
                resultCount={filtered.length}
              />
              <CustomSelect
                label="按阶段筛选"
                value={stage}
                onChange={setStage}
                options={[
                  { value: "all", label: "全部阶段" },
                  ...Object.entries(stageLabel).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
              <div className="view-switch">
                <IconButton
                  label="网格视图"
                  className={view === "grid" ? "is-active" : ""}
                  selected={view === "grid"}
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={16} />
                </IconButton>
                <IconButton
                  label="列表视图"
                  className={view === "list" ? "is-active" : ""}
                  selected={view === "list"}
                  onClick={() => setView("list")}
                >
                  <List size={17} />
                </IconButton>
              </div>
            </div>
          </div>
          {operationError ? <p className="projects-operation-error" role="alert">{operationError}</p> : null}
          {filtered.length ? (
            <>
              <section className="project-collection" aria-labelledby="your-projects-title">
                <div className="project-collection__heading"><div><span>你创建并保存的项目</span><h3 id="your-projects-title">Your Projects</h3></div><small>{userProjects.length} 个项目</small></div>
                {userProjects.length ? (view === "grid" ? (
                  <div className="project-grid" aria-label="Your Projects">
                    {userProjects.map((project) => <ProjectGridCard key={project.id} project={project} busy={busyProjectId === project.id} {...projectViewProps} />)}
                  </div>
                ) : (
                  <div className="project-list" role="list" aria-label="Your Projects">
                    {userProjects.map((project) => <ProjectListRow key={project.id} project={project} busy={busyProjectId === project.id} {...projectViewProps} />)}
                  </div>
                )) : <p className="project-collection__empty">还没有真实项目。输入一个陌生命题，30 秒内建立第一份可确认的项目理解。</p>}
              </section>
              {exampleProjects.length ? <section className="project-collection" aria-labelledby="example-projects-title">
                <div className="project-collection__heading"><div><span>Muse 固定演示内容</span><h3 id="example-projects-title">Example Projects</h3></div><small>{exampleProjects.length} 个项目</small></div>
                {view === "grid" ? (
                  <div className="project-grid" aria-label="Example Projects">
                    {exampleProjects.map((project) => <ProjectGridCard key={project.id} project={project} busy={busyProjectId === project.id} {...projectViewProps} />)}
                  </div>
                ) : (
                  <div className="project-list" role="list" aria-label="Example Projects">
                    {exampleProjects.map((project) => <ProjectListRow key={project.id} project={project} busy={busyProjectId === project.id} {...projectViewProps} />)}
                  </div>
                )}
              </section> : null}
            </>
          ) : (
            <EmptyState
              title={hasFilters ? "没有匹配的项目" : "从第一个创意项目开始"}
              description={
                hasFilters
                  ? "更换关键词或筛选条件，查看其他项目。"
                  : "Muse 会先理解你的设计需求，再把研究、情绪板、方向与评审串成一条工作流。"
              }
              action={
                hasFilters ? (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setQuery("");
                      setStage("all");
                    }}
                  >
                    清除筛选
                  </Button>
                ) : (
                  <Button icon={Plus} onClick={() => navigate("/projects/new")}>
                    新建项目
                  </Button>
                )
              }
            />
          )}
        </section>
        <section className="projects-section projects-section--quick" aria-labelledby="quick-start-title">
          <div className="section-heading">
            <div>
              <span>快速开始</span>
              <h2 id="quick-start-title">先写下一个明确的设计任务</h2>
            </div>
            <p>输入会带入项目简报，之后再由你确认用户、场景与限制。</p>
          </div>
          <div className="quick-start-form">
            <input
              value={quickIdea}
              onChange={(event) => setQuickIdea(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") startQuickProject(); }}
              placeholder="例如：便携消毒产品、青年茶饮快闪、智能家居产品"
              aria-label="快速描述设计任务"
            />
            <Button icon={ArrowRight} onClick={startQuickProject}>开始分析</Button>
          </div>
          <div className="quick-actions" aria-label="快速入口">
            <button type="button" onClick={() => navigate("/projects/new")}>
              <Plus size={18} aria-hidden="true" />
              <strong>新建空白项目</strong>
              <span>从真实问题和约束开始</span>
            </button>
            <button type="button" onClick={() => navigate("/templates")}>
              <LayoutTemplate size={18} aria-hidden="true" />
              <strong>选择项目模板</strong>
              <span>复用研究与交付结构</span>
            </button>
            <button type="button" onClick={() => navigate("/assets")}>
              <ImagePlus size={18} aria-hidden="true" />
              <strong>整理参考素材</strong>
              <span>上传并建立可追溯来源</span>
            </button>
          </div>
        </section>
        <section className="projects-section workflow-blueprint" aria-labelledby="workflow-title">
          <div className="section-heading">
            <div>
              <span>一条可追溯的创意路径</span>
              <h2 id="workflow-title">从模糊命题，到清晰方向</h2>
            </div>
            <p>AI 在每一步提供结构和证据，你始终保留选择权。</p>
          </div>
          <div className="workflow-blueprint__track">
            <article data-tour="brief"><span>01</span><strong>确认简报</strong><p>校准目标、受众、交付物与限制。</p></article>
            <article data-tour="research"><span>02</span><strong>研究证据</strong><p>把来源、洞察和事实放在同一处。</p></article>
            <article data-tour="moodboard"><span>03</span><strong>组织情绪板</strong><p>看见色彩、材质与图像语言的共性。</p></article>
            <article data-tour="direction"><span>04</span><strong>比较方向</strong><p>并排判断、融合或拒绝多个路径。</p></article>
            <article data-tour="critique"><span>05</span><strong>评审迭代</strong><p>依据目标评审，并保存每一轮决策。</p></article>
          </div>
        </section>
        <section className="projects-section">
          <div className="section-heading">
            <div>
              <span>可选起点</span>
              <h2>从模板开始</h2>
            </div>
            <Button variant="quiet" onClick={() => navigate("/templates")}>
              查看全部模板
            </Button>
          </div>
          <div className="template-preview-grid">
            {phaseOneTemplateCatalog.slice(0, 4).map((template) => (
              <button
                key={template.id}
                onClick={() =>
                  navigate(`/projects/new?template=${template.id}`)
                }
              >
                <span className="template-preview-grid__cover">
                  <img src={homeTemplateCover[template.name]} alt="" />
                  <i>产品 / 工业设计</i>
                  <b>{template.name}</b>
                </span>
                <strong>{template.name}</strong>
                <small>{template.briefPlaceholder}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="移到回收站？"
        description="项目会保留在回收站中，之后可以恢复。"
        confirmText="移到回收站"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const project = pendingDelete;
          await runProjectAction(project, () => moveProjectToTrash(project.id));
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}

const emptyForm = {
  name: "",
  requirement: "",
  audience: "",
  background: "",
  deliverables: "",
  constraints: "",
  keywords: "",
  avoid: "",
};
const splitList = (value) =>
  value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function LegacyNewProjectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const savedTemplates = useMuseStore((state) => state.templates);
  const template = [...templateCatalog, ...savedTemplates].find(
    (item) => item.id === searchParams.get("template"),
  );
  const createProjectDraft = useMuseStore((state) => state.createProjectDraft);
  const analyzeBrief = useMuseStore((state) => state.analyzeBrief);
  const aiJob = useMuseStore((state) => state.aiJob);
  const [form, setForm] = useState(() =>
    template
      ? {
          ...emptyForm,
          deliverables: template.defaults.deliverables.join("、"),
          constraints: template.defaults.constraints.join("、"),
          keywords: template.defaults.keywords.join("、"),
        }
      : emptyForm,
  );
  const [errors, setErrors] = useState({});
  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "请输入项目名称";
    if (form.requirement.trim().length < 20)
      nextErrors.requirement = "请至少用 20 个字说明设计需求";
    if (!form.audience.trim()) nextErrors.audience = "请说明目标受众";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const project = await createProjectDraft({
      ...form,
      templateId: template?.id,
      deliverables: splitList(form.deliverables),
      constraints: splitList(form.constraints),
      keywords: splitList(form.keywords),
      avoid: splitList(form.avoid),
    });
    await analyzeBrief(project.id);
    navigate(`/projects/${project.id}/brief`);
  };
  return (
    <div className="new-project-app">
      <aside className="new-project-sidebar">
        <Brand />
        <Button
          variant="quiet"
          icon={ArrowLeft}
          onClick={() => navigate("/projects")}
        >
          返回我的项目
        </Button>
      </aside>
      <main className="new-project-main">
        <div className="stepper">
          <span className="is-active">1 输入需求</span>
          <i />
          <span>2 AI 理解</span>
          <i />
          <span>3 确认简报</span>
          <i />
          <span>4 创建项目</span>
        </div>
        <div className="new-project-grid">
          <form className="project-form" onSubmit={submit}>
            <header>
              <p>
                {template ? `已选择模板 · ${template.name}` : "新建创意项目"}
              </p>
              <h1>描述你的设计需求</h1>
              <span>
                信息会先整理成可编辑的项目简报，不会直接替你决定创意方向。
              </span>
            </header>
            <Field label="项目名称" error={errors.name}>
              {(id) => (
                <input
                  id={id}
                  autoFocus
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="为项目起一个清晰的名称"
                />
              )}
            </Field>
            <Field
              label="设计需求"
              hint="说明要解决的问题、期望结果与使用场景"
              error={errors.requirement}
            >
              {(id) => (
                <textarea
                  id={id}
                  rows="6"
                  value={form.requirement}
                  onChange={(event) =>
                    setField("requirement", event.target.value)
                  }
                  placeholder="例如：为一个面向大学生的校园文化活动建立主视觉，需要兼顾线下海报与社交媒体传播……"
                />
              )}
            </Field>
            <div className="two-fields">
              <Field label="目标受众" error={errors.audience}>
                {(id) => (
                  <input
                    id={id}
                    value={form.audience}
                    onChange={(event) =>
                      setField("audience", event.target.value)
                    }
                    placeholder="年龄、身份、需求或行为特征"
                  />
                )}
              </Field>
              <Field label="品牌 / 项目背景">
                {(id) => (
                  <input
                    id={id}
                    value={form.background}
                    onChange={(event) =>
                      setField("background", event.target.value)
                    }
                    placeholder="项目语境、现状或已有资产"
                  />
                )}
              </Field>
            </div>
            <div className="two-fields">
              <Field label="预期交付物" hint="用逗号或顿号分隔">
                {(id) => (
                  <input
                    id={id}
                    value={form.deliverables}
                    onChange={(event) =>
                      setField("deliverables", event.target.value)
                    }
                    placeholder="主视觉、系列海报、社交媒体封面"
                  />
                )}
              </Field>
              <Field label="限制条件" hint="用逗号或顿号分隔">
                {(id) => (
                  <input
                    id={id}
                    value={form.constraints}
                    onChange={(event) =>
                      setField("constraints", event.target.value)
                    }
                    placeholder="尺寸、时间、渠道或品牌规范"
                  />
                )}
              </Field>
            </div>
            <div className="two-fields">
              <Field label="设计关键词">
                {(id) => (
                  <input
                    id={id}
                    value={form.keywords}
                    onChange={(event) =>
                      setField("keywords", event.target.value)
                    }
                    placeholder="希望呈现的气质与感受"
                  />
                )}
              </Field>
              <Field label="避免项">
                {(id) => (
                  <input
                    id={id}
                    value={form.avoid}
                    onChange={(event) => setField("avoid", event.target.value)}
                    placeholder="不希望出现的表达方式"
                  />
                )}
              </Field>
            </div>
            <Button
              className="full-button"
              type="submit"
              icon={Sparkles}
              loading={aiJob.status === "processing"}
            >
              让 Muse 理解我的项目
            </Button>
            <ProcessingCard job={aiJob} />
          </form>
          <aside className="new-project-guide">
            <h2>Muse 将为你整理</h2>
            <div className="guide-list">
              <span>
                <Check />
                项目目标与交付物
              </span>
              <span>
                <Check />
                目标受众与使用场景
              </span>
              <span>
                <Check />
                核心语境与设计机会
              </span>
              <span>
                <Check />
                风险与待确认问题
              </span>
            </div>
            <p>
              所有分析均可在下一步编辑或删除，只有你确认后才会创建正式工作区。
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

export { NewProjectPage } from "./NewProjectPage";
export { ProjectCreationProgressPage } from "./ProjectCreationProgressPage";

function BriefSection({ title, value, tone, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    Array.isArray(value) ? value.join("、") : (value ?? ""),
  );
  const isList = Array.isArray(value);
  return (
    <Surface
      title={title}
      action={
        <button className="text-button" onClick={() => setEditing(true)}>
          <Pencil size={14} />
          编辑
        </button>
      }
    >
      <div className="brief-content">
        {editing ? (
          <>
            <textarea
              rows="4"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div>
              <Button
                variant="quiet"
                onClick={() => {
                  setDraft(isList ? value.join("、") : (value ?? ""));
                  setEditing(false);
                }}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  onSave(isList ? splitList(draft) : draft.trim());
                  setEditing(false);
                }}
              >
                保存
              </Button>
            </div>
          </>
        ) : isList ? (
          value.length ? (
            <TagList items={value} tone={tone} />
          ) : (
            <p className="muted">尚未补充</p>
          )
        ) : (
          <p>{value || "尚未补充"}</p>
        )}
      </div>
    </Surface>
  );
}

export function BriefPage() {
  const navigate = useNavigate();
  const { projectId, project, brief } = useProjectRecord();
  const updateBrief = useMuseStore((state) => state.updateBrief);
  const confirmProject = useMuseStore((state) => state.confirmProject);
  const pushToast = useMuseStore((state) => state.pushToast);
  if (!project || !brief) return <MissingProject />;
  const sections = [
    ["项目目标", "target", brief.target],
    ["目标受众", "audience", brief.audience],
    ["项目背景", "background", brief.background],
    ["交付物", "deliverables", brief.deliverables],
    ["设计关键词", "keywords", brief.keywords],
    ["避免项", "avoid", brief.avoid],
    ["设计机会", "opportunities", brief.opportunities],
    ["风险提示", "risks", brief.risks],
    ["待确认问题", "questions", brief.questions],
  ];
  const score = Math.min(
    100,
    45 +
      [brief.target, brief.audience, brief.background].filter(Boolean).length *
        10 +
      [brief.deliverables, brief.keywords, brief.constraints].filter(
        (items) => items?.length,
      ).length *
        8,
  );
  return (
    <AppShell
      project={project}
      context={
        <>
          <div className="context-title">
            <Sparkles size={20} />
            <h2>项目简报摘要</h2>
          </div>
          <div className="score-ring">
            <b>{score}</b>
            <small>/100</small>
          </div>
          <div className="metric-list">
            <span>
              信息完整度 <b>{score}%</b>
            </span>
            <span>
              方向明确度 <b>{Math.max(52, score - 8)}%</b>
            </span>
            <span>
              可执行性 <b>{Math.max(56, score - 4)}%</b>
            </span>
          </div>
          <Surface title="确认前检查">
            <ul className="plain-list">
              <li>目标是否能被具体成果验证</li>
              <li>受众与使用场景是否清晰</li>
              <li>交付物与限制条件是否冲突</li>
            </ul>
          </Surface>
        </>
      }
    >
      <div className="brief-page">
        <div className="stepper stepper--shell">
          <span className="is-done">1 输入需求</span>
          <i />
          <span className="is-done">2 AI 理解</span>
          <i />
          <span className="is-active">3 确认简报</span>
          <i />
          <span>4 创建项目</span>
        </div>
        <header className="page-heading">
          <p>AI 需求分析</p>
          <h1>这是 Muse 对项目的理解</h1>
          <span>
            逐项修改、补充或删除；你的确认将成为后续研究与评审的判断依据。
          </span>
        </header>
        <div className="brief-grid">
          {sections.map(([label, key, value]) => (
            <BriefSection
              key={key}
              title={label}
              value={value}
              tone={["avoid", "risks"].includes(key) ? "warn" : "default"}
              onSave={(next) => updateBrief(projectId, { [key]: next })}
            />
          ))}
        </div>
        <footer className="page-footer">
          <Button
            variant="quiet"
            icon={ArrowLeft}
            onClick={() => navigate("/projects/new")}
          >
            重新输入需求
          </Button>
          <Button
            variant="quiet"
            icon={Save}
            onClick={() => pushToast("简报草稿已保存在本地")}
          >
            保存草稿
          </Button>
          <Button
            icon={ArrowRight}
            onClick={async () => {
              await confirmProject(projectId);
              navigate(`/projects/${projectId}/workspace`);
            }}
          >
            确认简报并创建项目
          </Button>
        </footer>
      </div>
    </AppShell>
  );
}
