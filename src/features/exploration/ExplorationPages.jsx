import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check,
  ImagePlus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  WandSparkles,
} from "lucide-react";
import { AppShell } from "../../components/shell";
import {
  Button,
  EmptyState,
  ProcessingCard,
  StatusPill,
  Surface,
  TagList,
} from "../../components/ui";
import { useMuseStore } from "../../stores/useMuseStore";
import { MissingProject } from "../projects/ProjectPages";

function useExplorationContext() {
  const { projectId } = useParams();
  const project = useMuseStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const direction = useMuseStore((state) =>
    state.directions.find(
      (item) => item.projectId === projectId && item.lockedAt,
    ),
  );
  const allExplorations = useMuseStore((state) => state.explorations);
  const explorations = allExplorations.filter((item) => item.projectId === projectId);
  return { projectId, project, direction, explorations };
}

export function LegacyExplorationPage() {
  const navigate = useNavigate();
  const { projectId, project, direction, explorations } =
    useExplorationContext();
  const generate = useMuseStore((state) => state.generateExplorations);
  const cancel = useMuseStore((state) => state.cancelGeneration);
  const selectExploration = useMuseStore((state) => state.selectExploration);
  const aiJob = useMuseStore((state) => state.aiJob);
  const pushToast = useMuseStore((state) => state.pushToast);
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");
  if (!project) return <MissingProject />;
  const visible = explorations.filter(
    (item) => filter === "all" || item.status === filter,
  );
  const run = async () => {
    try {
      await generate(projectId, direction.id, notes);
      setNotes("");
    } catch (error) {
      pushToast(
        error.message === "NO_VISUAL_SOURCE"
          ? "请先在情绪板加入至少一个视觉素材"
          : "请先锁定一个创意方向",
        "error",
      );
    }
  };
  const context = (
    <>
      <div className="context-title">
        <Sparkles size={20} />
        <h2>生成设置</h2>
      </div>
      <Surface title="当前方向">
        <p>{direction?.name ?? "尚未锁定方向"}</p>
        {direction ? (
          <TagList items={direction.keywords.slice(0, 5)} tone="ai" />
        ) : null}
      </Surface>
      <Surface title="生成方式">
        <StatusPill status="success">本地预览可用</StatusPill>
        <p className="muted">
          候选会复用你情绪板中的真实图片并保存方向、参数与来源；可在设置中切换本机图像服务。
        </p>
      </Surface>
      <label className="iteration-note">
        <span>本轮细化要求</span>
        <textarea
          rows="4"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="例如：强化标题层级，减少装饰元素，增加更明确的主视觉焦点"
        />
      </label>
      {aiJob.status === "processing" ? (
        <Button
          variant="danger"
          icon={Square}
          onClick={() => cancel(projectId)}
        >
          取消本轮生成
        </Button>
      ) : (
        <Button icon={WandSparkles} disabled={!direction} onClick={run}>
          {explorations.length ? "生成新一轮候选" : "生成视觉探索候选"}
        </Button>
      )}
      <ProcessingCard job={aiJob} />
    </>
  );
  return (
    <AppShell project={project} context={context}>
      <div className="exploration-page">
        <header className="page-heading">
          <p>视觉探索</p>
          <h1>围绕选定方向形成可比较候选</h1>
          <span>
            每个候选保留来源素材、方向参数与本轮要求，不把预览误认为最终设计。
          </span>
        </header>
        {!direction ? (
          <EmptyState
            title="先选择一个创意方向"
            description="返回方向比较页，锁定你要继续探索的视觉策略。"
            action={
              <Button
                onClick={() => navigate(`/projects/${projectId}/directions`)}
              >
                返回方向比较
              </Button>
            }
          />
        ) : (
          <>
            <div className="exploration-toolbar">
              <div className="filter-tabs">
                {[
                  ["all", "全部候选"],
                  ["candidate", "待选择"],
                  ["selected", "已送评审"],
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
              {explorations.length ? (
                <Button variant="quiet" icon={RefreshCw} onClick={run}>
                  再生成一轮
                </Button>
              ) : null}
            </div>
            {visible.length ? (
              <div className="exploration-grid">
                {visible.map((item) => (
                  <article
                    className={`exploration-card ${item.status === "selected" ? "exploration-card--active" : ""}`}
                    key={item.id}
                  >
                    <div className="exploration-card__image">
                      <img src={item.outputUrl} alt={item.name} />
                      <span>
                        {item.status === "selected"
                          ? "已送入评审"
                          : `候选 ${item.variantIndex}`}
                      </span>
                      {item.status === "selected" ? (
                        <button aria-label="已选中">
                          <Check size={16} />
                        </button>
                      ) : null}
                    </div>
                    <div className="exploration-card__body">
                      <h3>{item.name}</h3>
                      <p>来源：{item.metadata.sourceAssetName}</p>
                      <code>{item.prompt}</code>
                      <div className="exploration-card__actions">
                        <Button
                          variant="quiet"
                          icon={Send}
                          onClick={async () => {
                            await selectExploration(projectId, item.id);
                            navigate(`/projects/${projectId}/critique`);
                          }}
                        >
                          送入 AI 评审
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="还没有视觉候选"
                description="Muse 会根据锁定方向与情绪板素材组织三种探索重点。"
                action={
                  <Button icon={ImagePlus} onClick={run}>
                    生成第一轮候选
                  </Button>
                }
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

export { ExplorationPage } from "./ExplorationPage";

export function CritiquePage() {
  const { projectId, project, explorations } = useExplorationContext();
  const allCritiques = useMuseStore((state) => state.critiques);
  const critiques = allCritiques.filter((item) => item.projectId === projectId);
  const runCritique = useMuseStore((state) => state.runCritique);
  const aiJob = useMuseStore((state) => state.aiJob);
  const [explorationId, setExplorationId] = useState(
    () =>
      explorations.find((item) => item.status === "selected")?.id ??
      explorations[0]?.id ??
      "",
  );
  if (!project) return <MissingProject />;
  const exploration = explorations.find((item) => item.id === explorationId);
  const critique = critiques
    .filter((item) => item.explorationId === explorationId)
    .at(-1);
  return (
    <AppShell
      project={project}
      context={
        <>
          <div className="context-title">
            <Sparkles size={20} />
            <h2>评审依据</h2>
          </div>
          <p className="context-subtitle">
            分数来自项目简报、情绪板证据、方向风险与候选元数据，不是人工预填。
          </p>
          <Surface title="评审状态">
            <div className="metric-list">
              <span>
                候选方案 <b>{explorations.length}</b>
              </span>
              <span>
                评审记录 <b>{critiques.length}</b>
              </span>
              <span>
                当前总分 <b>{critique ? critique.total : "—"}</b>
              </span>
            </div>
          </Surface>
          <Button
            icon={Sparkles}
            disabled={!explorationId}
            loading={aiJob.status === "processing"}
            onClick={() => runCritique(projectId, explorationId)}
          >
            评审当前方案
          </Button>
          <ProcessingCard job={aiJob} />
        </>
      }
    >
      <div className="critique-page">
        <header className="page-heading page-heading--actions">
          <div>
            <p>AI 评审</p>
            <h1>把反馈变成可追溯的迭代依据</h1>
            <span>选择候选后，Muse 会按六个固定维度给出证据、建议与总评。</span>
          </div>
          {explorations.length ? (
            <select
              aria-label="选择评审候选"
              className="critique-select"
              value={explorationId}
              onChange={(event) => setExplorationId(event.target.value)}
            >
              {explorations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : null}
        </header>
        {exploration ? (
          critique ? (
            <>
              <section className="critique-overview">
                <div className="critique-preview">
                  <img src={exploration.outputUrl} alt={exploration.name} />
                  <div>
                    <StatusPill status="success">评审已完成</StatusPill>
                    <h2>{exploration.name}</h2>
                    <p>{critique.summary}</p>
                  </div>
                </div>
                <div className="score-orbit">
                  <div>
                    <b>{critique.total}</b>
                    <span>/100</span>
                    <small>综合得分</small>
                  </div>
                </div>
              </section>
              <div className="critique-dimensions">
                {critique.dimensions.map((item) => (
                  <article className="critique-dimension" key={item.id}>
                    <div>
                      <h3>{item.label}</h3>
                      <strong>{item.score}</strong>
                    </div>
                    <div className="score-track">
                      <span style={{ width: `${item.score}%` }} />
                    </div>
                    <p>
                      <b>证据：</b>
                      {item.evidence}
                    </p>
                    <p className="suggestion">
                      <WandSparkles size={15} />
                      {item.suggestion}
                    </p>
                  </article>
                ))}
              </div>
              <div className="critique-next">
                <label>
                  <span>下一轮修改备注</span>
                  <textarea
                    rows="3"
                    placeholder="记录你接受、拒绝或需要验证的建议"
                  />
                </label>
                <Button
                  icon={RefreshCw}
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  返回上方选择其他候选
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              title="这个候选还没有评审"
              description="点击“评审当前方案”，Muse 会读取项目简报、方向与情绪板证据。"
              action={
                <Button
                  icon={Sparkles}
                  onClick={() => runCritique(projectId, explorationId)}
                >
                  开始评审
                </Button>
              }
            />
          )
        ) : (
          <EmptyState
            title="还没有可评审的视觉候选"
            description="先在视觉探索页生成并选择一个候选方案。"
            action={
              <Button
                onClick={() =>
                  location.assign(`/projects/${projectId}/exploration`)
                }
              >
                前往视觉探索
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
