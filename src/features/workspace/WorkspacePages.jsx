import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GridLayout from "react-grid-layout/legacy";
import {
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  FileCheck2,
  Grip,
  ImagePlus,
  LayoutGrid,
  Link2,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "../../components/shell";
import { MuseCanvas } from "../../components/MuseCanvas";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  ProcessingCard,
  StatusPill,
  Surface,
  TagList,
} from "../../components/ui";
import { createAssetRecords } from "../../lib/assets/museAssetPipeline";
import { useMuseStore } from "../../stores/useMuseStore";
import { MissingProject } from "../projects/ProjectPages";

function useProjectWorkspace() {
  const { projectId } = useParams();
  const project = useMuseStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const brief = useMuseStore((state) =>
    state.briefs.find((item) => item.projectId === projectId),
  );
  return { projectId, project, brief };
}

function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () =>
      setWidth(Math.max(320, node.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function WorkspaceContext({ projectId }) {
  const navigate = useNavigate();
  const researchCount = useMuseStore(
    (state) =>
      state.researchItems.filter((item) => item.projectId === projectId).length,
  );
  const boardCount = useMuseStore(
    (state) =>
      state.moodboardItems.filter((item) => item.projectId === projectId)
        .length,
  );
  const directionCount = useMuseStore(
    (state) =>
      state.directions.filter((item) => item.projectId === projectId).length,
  );
  return (
    <>
      <div className="context-title">
        <Sparkles size={20} />
        <h2>AI 创意导师</h2>
      </div>
      <p className="context-subtitle">
        画布只呈现你主动加入的项目内容，便于回看信息如何变成设计判断。
      </p>
      <Surface title="当前进度">
        <div className="metric-list">
          <span>
            研究证据 <b>{researchCount}</b>
          </span>
          <span>
            情绪板素材 <b>{boardCount}</b>
          </span>
          <span>
            创意方向 <b>{directionCount}</b>
          </span>
        </div>
      </Surface>
      <Surface title="建议动作">
        <ul className="plain-list">
          {researchCount < 3 ? (
            <li>先收集至少 3 条不同来源的研究证据</li>
          ) : (
            <li>研究证据已经可以开始归纳</li>
          )}
          {boardCount < 4 ? (
            <li>从研究与素材库补充视觉证据</li>
          ) : (
            <li>分析情绪板的色彩、标签与共性</li>
          )}
          <li>完成分析后再生成可比较方向</li>
        </ul>
      </Surface>
      <div className="context-actions">
        <Button
          variant="quiet"
          icon={Search}
          onClick={() => navigate(`/projects/${projectId}/research`)}
        >
          进入研究
        </Button>
        <Button
          icon={ImagePlus}
          onClick={() => navigate(`/projects/${projectId}/moodboard`)}
        >
          整理情绪板
        </Button>
      </div>
    </>
  );
}

export function WorkspacePage() {
  const navigate = useNavigate();
  const { projectId, project, brief } = useProjectWorkspace();
  const canvas = useMuseStore((state) =>
    state.canvas.find((item) => item.projectId === projectId),
  );
  const workspaceCanvas = useMemo(
    () =>
      canvas ?? {
        projectId,
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        history: [],
        historyIndex: -1,
      },
    [canvas, projectId],
  );
  const saveCanvas = useMuseStore((state) => state.saveCanvas);
  const addCanvasNode = useMuseStore((state) => state.addCanvasNode);
  const [selection, setSelection] = useState([]);
  if (!project) return <MissingProject />;
  const addBrief = () =>
    addCanvasNode(projectId, {
      kind: "brief",
      sourceId: brief?.id,
      title: "项目简报",
      body: brief?.target || brief?.requirement || "查看项目目标与约束。",
    });
  return (
    <AppShell
      project={project}
      context={<WorkspaceContext projectId={projectId} />}
    >
      <div className="workspace-page">
        <header className="page-heading page-heading--compact">
          <p>项目概览</p>
          <h1>把研究、素材与判断放在同一张画布上</h1>
          <span>
            拖动卡片组织关系，选择对象后可在右侧查看对应阶段与下一步。
          </span>
        </header>
        {!canvas?.nodes?.length ? (
          <div className="canvas-zero">
            <FileCheck2 size={24} />
            <div>
              <strong>画布还是空的</strong>
              <span>先加入项目简报，或从研究页把证据送到画布。</span>
            </div>
            <Button icon={Plus} onClick={addBrief}>
              加入项目简报
            </Button>
          </div>
        ) : null}
        <MuseCanvas
          canvas={workspaceCanvas}
          onSave={saveCanvas}
          onSelectionChange={setSelection}
          onOpenMoodboard={() => navigate(`/projects/${projectId}/moodboard`)}
          onOpenDirections={() => navigate(`/projects/${projectId}/directions`)}
        />
        <p className="canvas-selection-note">
          {selection.length
            ? `已选择 ${selection.length} 个画布对象`
            : "画布内容会自动保存在当前浏览器"}
        </p>
      </div>
    </AppShell>
  );
}

const emptyResearchForm = {
  title: "",
  sourceType: "网页",
  url: "",
  summary: "",
  quote: "",
  conclusion: "",
  evidenceStatus: "pending",
};
const evidenceLabel = {
  pending: "待核验",
  verified: "已核验",
  limited: "证据受限",
};

function ResearchForm({ initial, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial ?? emptyResearchForm);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) {
      setError("请填写标题与内容摘要");
      return;
    }
    await onSubmit(form, file);
  };
  return (
    <form className="research-form" onSubmit={submit}>
      <div className="two-fields">
        <Field label="研究标题">
          <input
            aria-label="研究标题"
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            placeholder="这条资料说明了什么"
          />
        </Field>
        <Field label="来源类型">
          <select
            aria-label="来源类型"
            value={form.sourceType}
            onChange={(event) => setField("sourceType", event.target.value)}
          >
            {["网页", "书籍", "访谈", "观察", "竞品"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="来源链接" hint="可选，用于保留可追溯出处">
        <input
          aria-label="来源链接"
          type="url"
          value={form.url}
          onChange={(event) => setField("url", event.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="内容摘要">
        <textarea
          aria-label="内容摘要"
          rows="3"
          value={form.summary}
          onChange={(event) => setField("summary", event.target.value)}
          placeholder="用自己的语言概括资料内容"
        />
      </Field>
      <div className="two-fields">
        <Field label="关键引文 / 观察">
          <textarea
            aria-label="关键引文或观察"
            rows="3"
            value={form.quote}
            onChange={(event) => setField("quote", event.target.value)}
            placeholder="保留原始证据或观察记录"
          />
        </Field>
        <Field label="设计启示">
          <textarea
            aria-label="设计启示"
            rows="3"
            value={form.conclusion}
            onChange={(event) => setField("conclusion", event.target.value)}
            placeholder="这条证据可能影响什么设计判断"
          />
        </Field>
      </div>
      <div className="two-fields">
        <Field label="证据状态">
          <select
            aria-label="证据状态"
            value={form.evidenceStatus}
            onChange={(event) => setField("evidenceStatus", event.target.value)}
          >
            <option value="pending">待核验</option>
            <option value="verified">已核验</option>
            <option value="limited">证据受限</option>
          </select>
        </Field>
        <Field label="视觉附件" hint="可选，之后可加入情绪板">
          <label className="research-upload">
            <ImagePlus size={16} />
            {file?.name || "选择图片"}
            <input
              aria-label="选择视觉附件"
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files[0] ?? null)}
            />
          </label>
        </Field>
      </div>
      {error ? <p className="field__error">{error}</p> : null}
      <footer>
        <Button type="button" variant="quiet" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" icon={Check}>
          保存研究条目
        </Button>
      </footer>
    </form>
  );
}

export function LegacyResearchPage() {
  const { projectId, project } = useProjectWorkspace();
  const allResearchItems = useMuseStore((state) => state.researchItems);
  const items = allResearchItems.filter((item) => item.projectId === projectId);
  const addResearchItem = useMuseStore((state) => state.addResearchItem);
  const updateResearchItem = useMuseStore((state) => state.updateResearchItem);
  const deleteResearchItem = useMuseStore((state) => state.deleteResearchItem);
  const addProjectAssets = useMuseStore((state) => state.addProjectAssets);
  const addMoodboardAssets = useMuseStore((state) => state.addMoodboardAssets);
  const addCanvasNode = useMuseStore((state) => state.addCanvasNode);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  if (!project) return <MissingProject />;
  const visible = items.filter(
    (item) =>
      (filter === "all" || item.evidenceStatus === filter) &&
      [item.title, item.summary, item.conclusion]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const save = async (form, file) => {
    let assetId = editing?.assetId ?? null;
    if (file) {
      const [asset] = await createAssetRecords([file], {
        projectId,
        source: "研究附件",
      });
      await addProjectAssets(projectId, [asset]);
      assetId = asset.id;
    }
    if (editing) await updateResearchItem(editing.id, { ...form, assetId });
    else await addResearchItem(projectId, { ...form, assetId });
    setEditing(null);
    setFormOpen(false);
  };
  return (
    <AppShell
      project={project}
      context={
        <>
          <div className="context-title">
            <Search size={20} />
            <h2>研究证据</h2>
          </div>
          <p className="context-subtitle">
            研究结论不会自动成为事实。保留来源和证据状态，方便后续评审追溯。
          </p>
          <Surface title="证据概况">
            <div className="metric-list">
              <span>
                全部条目 <b>{items.length}</b>
              </span>
              <span>
                已核验{" "}
                <b>
                  {
                    items.filter((item) => item.evidenceStatus === "verified")
                      .length
                  }
                </b>
              </span>
              <span>
                带视觉附件 <b>{items.filter((item) => item.assetId).length}</b>
              </span>
            </div>
          </Surface>
        </>
      }
    >
      <div className="research-page">
        <LibraryHeader
          title="研究"
          description="收集、核验并转化与命题相关的事实、观察和参考。"
          action={
            <Button
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              添加研究
            </Button>
          }
        />
        <div className="research-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="搜索研究"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索研究标题或结论"
            />
          </label>
          <div className="filter-tabs">
            {[
              ["all", "全部"],
              ["verified", "已核验"],
              ["pending", "待核验"],
              ["limited", "证据受限"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {formOpen ? (
          <ResearchForm
            initial={editing}
            onCancel={() => {
              setEditing(null);
              setFormOpen(false);
            }}
            onSubmit={save}
          />
        ) : null}
        {visible.length ? (
          <div className="research-list">
            {visible.map((item) => (
              <article key={item.id}>
                <header>
                  <div>
                    <StatusPill
                      status={
                        item.evidenceStatus === "verified"
                          ? "success"
                          : item.evidenceStatus === "limited"
                            ? "warn"
                            : "ai"
                      }
                    >
                      {evidenceLabel[item.evidenceStatus]}
                    </StatusPill>
                    <span>{item.sourceType}</span>
                  </div>
                  <div>
                    <IconButton
                      label="编辑研究"
                      onClick={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      label="删除研究"
                      onClick={() => deleteResearchItem(item.id)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </header>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
                {item.quote ? <blockquote>{item.quote}</blockquote> : null}
                <div className="research-conclusion">
                  <Sparkles size={15} />
                  <span>{item.conclusion || "尚未补充设计启示"}</span>
                </div>
                <footer>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      查看来源
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span>未添加外部链接</span>
                  )}
                  <div>
                    <button
                      onClick={() =>
                        addCanvasNode(projectId, {
                          kind: "research",
                          sourceId: item.id,
                          title: item.title,
                          body: item.conclusion || item.summary,
                        })
                      }
                    >
                      加入画布
                    </button>
                    <button
                      disabled={!item.assetId}
                      title={
                        item.assetId
                          ? "将视觉附件加入情绪板"
                          : "先为研究条目添加视觉附件"
                      }
                      onClick={() =>
                        item.assetId &&
                        addMoodboardAssets(projectId, [item.assetId])
                      }
                    >
                      加入情绪板
                    </button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={items.length ? "没有匹配的研究条目" : "从第一条研究证据开始"}
            description={
              items.length
                ? "更换搜索词或证据状态。"
                : "添加来源、摘要、关键引文和设计启示；如果包含图片，可直接送入情绪板。"
            }
            action={
              !items.length ? (
                <Button icon={Plus} onClick={() => setFormOpen(true)}>
                  添加研究
                </Button>
              ) : null
            }
          />
        )}
      </div>
    </AppShell>
  );
}

export { ResearchPage } from "../research/ResearchPage";

function LibraryHeader({ title, description, action }) {
  return (
    <header className="page-heading page-heading--actions">
      <div>
        <p>项目工作区</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </header>
  );
}

function AssetPicker({ projectId, onClose }) {
  const allAssets = useMuseStore((state) => state.assets);
  const assets = allAssets.filter((item) => !item.projectId || item.projectId === projectId);
  const addMoodboardAssets = useMuseStore((state) => state.addMoodboardAssets);
  const [selected, setSelected] = useState([]);
  return (
    <div className="dialog-backdrop">
      <div className="dialog asset-picker">
        <h2>从素材库选择</h2>
        <p>选择素材后会添加到当前项目情绪板，原素材仍保留在素材库。</p>
        {assets.length ? (
          <div className="asset-picker__grid">
            {assets.map((asset) => (
              <label
                key={asset.id}
                className={selected.includes(asset.id) ? "is-selected" : ""}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(asset.id)}
                  onChange={() =>
                    setSelected((value) =>
                      value.includes(asset.id)
                        ? value.filter((id) => id !== asset.id)
                        : [...value, asset.id],
                    )
                  }
                />
                <img src={asset.url} alt={asset.name} />
                <span>{asset.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <EmptyState
            title="素材库暂无图片"
            description="先在全局素材库或当前页面上传图片。"
          />
        )}
        <div className="dialog__actions">
          <Button variant="quiet" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!selected.length}
            onClick={async () => {
              await addMoodboardAssets(projectId, selected);
              onClose();
            }}
          >
            添加 {selected.length} 个素材
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LegacyMoodboardPage() {
  const { projectId, project } = useProjectWorkspace();
  const allMoodboardItems = useMuseStore((state) => state.moodboardItems);
  const items = allMoodboardItems.filter((item) => item.projectId === projectId);
  const assets = useMuseStore((state) => state.assets);
  const allAnalyses = useMuseStore((state) => state.analyses);
  const analyses = allAnalyses.filter((item) => item.projectId === projectId);
  const aiJob = useMuseStore((state) => state.aiJob);
  const addProjectAssets = useMuseStore((state) => state.addProjectAssets);
  const addMoodboardAssets = useMuseStore((state) => state.addMoodboardAssets);
  const updateLayouts = useMuseStore((state) => state.updateMoodboardLayouts);
  const removeItems = useMuseStore((state) => state.removeMoodboardItems);
  const groupItems = useMuseStore((state) => state.groupMoodboardItems);
  const ungroupItems = useMuseStore((state) => state.ungroupMoodboardItems);
  const analyzeMoodboard = useMuseStore((state) => state.analyzeMoodboard);
  const addCanvasNode = useMuseStore((state) => state.addCanvasNode);
  const pushToast = useMuseStore((state) => state.pushToast);
  const [selected, setSelected] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gridRef, gridWidth] = useContainerWidth();
  if (!project) return <MissingProject />;
  const latestAnalysis = analyses.at(-1);
  const layout = items.map((item) => ({
    i: item.id,
    x: item.x,
    y: item.y,
    w: item.w || 3,
    h: item.h || 3,
    minW: 2,
    minH: 2,
  }));
  const upload = async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    try {
      const records = await createAssetRecords(files, {
        projectId,
        source: "项目情绪板上传",
      });
      await addProjectAssets(projectId, records);
      await addMoodboardAssets(
        projectId,
        records.map((item) => item.id),
      );
    } catch {
      pushToast("图片无法读取，请检查格式与大小", "error");
    }
  };
  const autoArrange = () => {
    const editorialLayout = [
      { x: 0, y: 0, w: 3, h: 4 },
      { x: 3, y: 0, w: 5, h: 3 },
      { x: 8, y: 0, w: 4, h: 4 },
      { x: 3, y: 3, w: 3, h: 3 },
      { x: 6, y: 3, w: 2, h: 4 },
      { x: 0, y: 4, w: 3, h: 3 },
      { x: 8, y: 4, w: 4, h: 3 },
      { x: 3, y: 6, w: 3, h: 3 },
    ];
    return updateLayouts(
      projectId,
      items.map((item, index) => ({
        i: item.id,
        ...editorialLayout[index % editorialLayout.length],
      })),
    );
  };
  const analyze = async () => {
    try {
      await analyzeMoodboard(projectId);
    } catch {
      pushToast("请先添加至少一个素材", "error");
    }
  };
  const context = (
    <>
      <div className="context-title">
        <Sparkles size={20} />
        <h2>视觉分析</h2>
      </div>
      <p className="context-subtitle">
        结论只基于当前情绪板中的真实素材数量、色彩与标签。
      </p>
      {latestAnalysis ? (
        <>
          <Surface title={`基于 ${latestAnalysis.assetCount} 个素材`}>
            <p>{latestAnalysis.evidence}</p>
          </Surface>
          <Surface title="主色调">
            <div className="color-swatches">
              {latestAnalysis.colors.map((item) => (
                <i
                  key={item.color}
                  style={{ background: item.color }}
                  title={`${item.color} · ${item.count} 次`}
                />
              ))}
            </div>
          </Surface>
          <Surface title="共现关键词">
            {latestAnalysis.keywords.length ? (
              <TagList items={latestAnalysis.keywords} tone="ai" />
            ) : (
              <p className="muted">素材尚未添加标签，可在全局素材库中补充。</p>
            )}
          </Surface>
          <Button
            variant="quiet"
            onClick={() =>
              addCanvasNode(projectId, {
                kind: "moodboard",
                sourceId: latestAnalysis.id,
                title: "情绪板分析",
                body: latestAnalysis.evidence,
                items: latestAnalysis.keywords,
              })
            }
          >
            加入项目画布
          </Button>
        </>
      ) : (
        <Surface title="等待分析">
          <p>添加素材后，点击“分析当前情绪板”提取可追溯的视觉共性。</p>
        </Surface>
      )}
      <Button
        icon={Sparkles}
        loading={aiJob.status === "processing"}
        disabled={!items.length}
        onClick={analyze}
      >
        分析当前情绪板
      </Button>
      <ProcessingCard job={aiJob} />
    </>
  );
  return (
    <AppShell project={project} context={context}>
      <div className="moodboard-page">
        <LibraryHeader
          title="情绪板"
          description="收集、组织并理解视觉灵感；卡片位置会自动保存。"
          action={
            <div className="heading-actions">
              <label className="button button--quiet">
                <Upload size={16} />
                上传图片
                <input
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={upload}
                />
              </label>
              <Button icon={ImagePlus} onClick={() => setPickerOpen(true)}>
                从素材库选择
              </Button>
            </div>
          }
        />
        <div className="moodboard-tools">
          <Button
            variant="quiet"
            icon={LayoutGrid}
            disabled={!items.length}
            onClick={autoArrange}
          >
            自动整理
          </Button>
          <Button
            variant="quiet"
            disabled={selected.length < 2}
            onClick={() => groupItems(projectId, selected)}
          >
            归为一组
          </Button>
          <Button
            variant="quiet"
            disabled={!selected.some((id) => items.find((item) => item.id === id)?.groupId)}
            onClick={() => ungroupItems(selected)}
          >
            取消分组
          </Button>
          <Button
            variant="quiet"
            icon={Trash2}
            disabled={!selected.length}
            onClick={() => {
              removeItems(selected);
              setSelected([]);
            }}
          >
            移除所选
          </Button>
          <span />
          <StatusPill status="ai">已选 {selected.length} 个</StatusPill>
        </div>
        <div ref={gridRef} className="moodboard-grid-wrap">
          {items.length ? (
            <GridLayout
              width={gridWidth}
              layout={layout}
              cols={12}
              rowHeight={58}
              margin={[11, 11]}
              compactType={null}
              isResizable
              draggableHandle=".mood-card__handle"
              onDragStop={(next) => updateLayouts(projectId, next)}
              onResizeStop={(next) => updateLayouts(projectId, next)}
            >
              {items.map((item) => {
                const asset = assets.find(
                  (candidate) => candidate.id === item.assetId,
                );
                if (!asset) return <div key={item.id} />;
                return (
                  <article
                    className={`mood-card ${selected.includes(item.id) ? "is-selected" : ""} ${item.groupId ? "is-grouped" : ""}`}
                    key={item.id}
                    onClick={(event) =>
                      setSelected((value) =>
                        event.shiftKey
                          ? value.includes(item.id)
                            ? value.filter((id) => id !== item.id)
                            : [...value, item.id]
                          : [item.id],
                      )
                    }
                  >
                    <div className="mood-card__handle">
                      <Grip size={15} />
                      <span>{item.groupId ? "已分组" : asset.source}</span>
                    </div>
                    <img src={asset.url} alt={asset.name} />
                    <footer>
                      <strong>{asset.name}</strong>
                      <TagList items={asset.tags.slice(0, 3)} />
                    </footer>
                  </article>
                );
              })}
            </GridLayout>
          ) : (
            <EmptyState
              title="情绪板还没有素材"
              description="上传图片，或从全局素材库选择已有素材。这里不会自动创建演示内容。"
              action={
                <div className="empty-actions">
                  <label className="button button--quiet">
                    <Upload size={16} />
                    上传图片
                    <input
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={upload}
                    />
                  </label>
                  <Button icon={ImagePlus} onClick={() => setPickerOpen(true)}>
                    从素材库选择
                  </Button>
                </div>
              }
            />
          )}
        </div>
      </div>
      {pickerOpen ? (
        <AssetPicker
          projectId={projectId}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </AppShell>
  );
}

export { MoodboardPage } from "../moodboard/MoodboardPage";
