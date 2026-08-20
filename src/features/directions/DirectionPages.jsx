import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  GitMerge,
  Heart,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { AppShell } from "../../components/shell";
import {
  Button,
  EmptyState,
  IconButton,
  ProcessingCard,
  StatusPill,
  Surface,
  TagList,
} from "../../components/ui";
import { useMuseStore } from "../../stores/useMuseStore";
import { MissingProject } from "../projects/ProjectPages";

function useProjectContext() {
  const { projectId, directionId } = useParams();
  const project = useMuseStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const allDirections = useMuseStore((state) => state.directions);
  const directions = allDirections.filter((item) => item.projectId === projectId);
  const assets = useMuseStore((state) => state.assets);
  const allMoodboardItems = useMuseStore((state) => state.moodboardItems);
  const moodboardItems = allMoodboardItems.filter(
    (item) => item.projectId === projectId,
  );
  const moodboardAssetIds = new Set(moodboardItems.map((item) => item.assetId));
  const visualAssets = assets.filter((item) => moodboardAssetIds.has(item.id));
  return { projectId, directionId, project, directions, visualAssets };
}

function Palette({ colors }) {
  return (
    <div className="direction-palette">
      {colors.map((color) => (
        <i key={color} style={{ background: color }} title={color} />
      ))}
    </div>
  );
}

export function LegacyDirectionsPage() {
  const navigate = useNavigate();
  const { projectId, project, directions, visualAssets } = useProjectContext();
  const generateDirections = useMuseStore((state) => state.generateDirections);
  const fuseDirections = useMuseStore((state) => state.fuseDirections);
  const lockDirection = useMuseStore((state) => state.lockDirection);
  const saveToLibrary = useMuseStore((state) => state.saveDirectionToLibrary);
  const aiJob = useMuseStore((state) => state.aiJob);
  const pushToast = useMuseStore((state) => state.pushToast);
  const [selected, setSelected] = useState([]);
  if (!project) return <MissingProject />;
  const choose = (id) =>
    setSelected((value) =>
      value.includes(id)
        ? value.filter((item) => item !== id)
        : value.length < 2
          ? [...value, id]
          : [value[1], id],
    );
  const context = (
    <>
      <div className="context-title">
        <Sparkles size={20} />
        <h2>方向比较</h2>
      </div>
      <p className="context-subtitle">
        三个方向来自同一份项目简报与情绪板证据，差异体现在策略、构图与图像语言。
      </p>
      <Surface title="比较状态">
        <div className="metric-list">
          <span>
            已生成方向 <b>{directions.length}</b>
          </span>
          <span>
            待融合选择 <b>{selected.length}/2</b>
          </span>
          <span>
            锁定方向{" "}
            <b>
              {directions.some((item) => item.lockedAt) ? "已完成" : "未选择"}
            </b>
          </span>
        </div>
      </Surface>
      <div className="context-actions">
        <Button
          variant="quiet"
          icon={RefreshCw}
          loading={aiJob.status === "processing"}
          onClick={() => generateDirections(projectId)}
        >
          重新生成三方向
        </Button>
        <Button
          icon={GitMerge}
          disabled={selected.length !== 2}
          onClick={async () => {
            try {
              const next = await fuseDirections(projectId, selected);
              setSelected([next.id]);
            } catch {
              pushToast("请选择两个方向进行融合", "error");
            }
          }}
        >
          融合所选方向
        </Button>
      </div>
      <ProcessingCard job={aiJob} />
    </>
  );
  return (
    <AppShell project={project} context={context}>
      <div className="directions-page">
        <header className="page-heading page-heading--actions">
          <div>
            <p>创意方向</p>
            <h1>比较不同的视觉策略</h1>
            <span>先比较概念、构图、色彩与风险，再由你锁定或融合方向。</span>
          </div>
          {directions.length ? (
            <Button
              icon={RefreshCw}
              variant="quiet"
              onClick={() => generateDirections(projectId)}
            >
              生成新一组
            </Button>
          ) : null}
        </header>
        {directions.length ? (
          <>
            <div className="direction-grid">
              {directions.map((direction, index) => (
                <article
                  className={`direction-card ${selected.includes(direction.id) ? "direction-card--selected" : ""}`}
                  key={direction.id}
                >
                  <button
                    className="direction-select-strip"
                    onClick={() => choose(direction.id)}
                  >
                    <span
                      className={
                        selected.includes(direction.id) ? "is-selected" : ""
                      }
                    >
                      {selected.includes(direction.id) ? (
                        <Check size={14} />
                      ) : null}
                    </span>
                    加入比较
                  </button>
                  <div className="direction-card__visual">
                    {visualAssets.length ? (
                      <img
                        src={visualAssets[index % visualAssets.length].url}
                        alt={`${direction.name} 的来源视觉素材`}
                      />
                    ) : null}
                    <Palette colors={direction.palette} />
                    <strong>
                      {String.fromCharCode(
                        64 + Math.min(direction.strategyIndex, 4),
                      )}
                    </strong>
                  </div>
                  <div className="direction-card__body">
                    <StatusPill status={direction.lockedAt ? "success" : "ai"}>
                      {direction.lockedAt ? "当前方向" : "候选方向"}
                    </StatusPill>
                    <h3>{direction.name}</h3>
                    <p>{direction.concept}</p>
                    <TagList items={direction.keywords.slice(0, 5)} />
                    <dl>
                      <div>
                        <dt>构图</dt>
                        <dd>{direction.composition}</dd>
                      </div>
                      <div>
                        <dt>图像语言</dt>
                        <dd>{direction.imageLanguage}</dd>
                      </div>
                      <div>
                        <dt>风险</dt>
                        <dd>{direction.risk}</dd>
                      </div>
                    </dl>
                    <div className="direction-card__actions">
                      <Button
                        variant="quiet"
                        onClick={() =>
                          navigate(
                            `/projects/${projectId}/directions/${direction.id}`,
                          )
                        }
                      >
                        查看详情
                      </Button>
                      <Button
                        icon={LockKeyhole}
                        onClick={async () => {
                          await lockDirection(projectId, direction.id);
                          navigate(`/projects/${projectId}/exploration`);
                        }}
                      >
                        选择方向
                      </Button>
                    </div>
                    <button
                      className="save-library"
                      onClick={() => saveToLibrary(direction.id)}
                    >
                      <Bookmark size={14} />
                      保存到方向库
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {selected.length === 2 ? (
              <section className="direction-comparison">
                <header>
                  <span>所选方向对比</span>
                  <strong>
                    {directions.find((item) => item.id === selected[0])?.name}
                  </strong>
                  <strong>
                    {directions.find((item) => item.id === selected[1])?.name}
                  </strong>
                </header>
                {[
                  ["核心概念", "concept"],
                  ["构图策略", "composition"],
                  ["字体方向", "typography"],
                  ["主要风险", "risk"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <p>
                      {
                        directions.find((item) => item.id === selected[0])?.[
                          key
                        ]
                      }
                    </p>
                    <p>
                      {
                        directions.find((item) => item.id === selected[1])?.[
                          key
                        ]
                      }
                    </p>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="还没有创意方向"
            description="完成项目简报并整理情绪板后，Muse 会基于真实项目内容生成三个可比较方向。"
            action={
              <Button
                icon={WandSparkles}
                loading={aiJob.status === "processing"}
                onClick={() => generateDirections(projectId)}
              >
                生成三个创意方向
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}

export { DirectionPage as DirectionsPage } from "./DirectionPage";

export function DirectionDetailPage() {
  const navigate = useNavigate();
  const { projectId, directionId, project, directions, visualAssets } =
    useProjectContext();
  const direction = directions.find((item) => item.id === directionId);
  const lockDirection = useMuseStore((state) => state.lockDirection);
  const saveToLibrary = useMuseStore((state) => state.saveDirectionToLibrary);
  const addCanvasNode = useMuseStore((state) => state.addCanvasNode);
  if (!project || !direction) return <MissingProject />;
  return (
    <AppShell
      project={project}
      context={
        <>
          <div className="context-title">
            <Sparkles size={20} />
            <h2>方向摘要</h2>
          </div>
          <div className="direction-score">
            <b>{direction.keywords.length + direction.palette.length}</b>
            <small>条视觉依据</small>
          </div>
          <Surface title="主要风险">
            <p>{direction.risk}</p>
          </Surface>
          <div className="context-actions">
            <Button
              variant="quiet"
              icon={Sparkles}
              onClick={() =>
                addCanvasNode(projectId, {
                  kind: "direction",
                  sourceId: direction.id,
                  title: direction.name,
                  body: direction.concept,
                  items: direction.keywords,
                })
              }
            >
              加入项目画布
            </Button>
            <Button
              variant="quiet"
              icon={Bookmark}
              onClick={() => saveToLibrary(direction.id)}
            >
              保存到方向库
            </Button>
            <Button
              icon={ArrowRight}
              onClick={async () => {
                await lockDirection(projectId, direction.id);
                navigate(`/projects/${projectId}/exploration`);
              }}
            >
              选择并进入视觉探索
            </Button>
          </div>
        </>
      }
    >
      <div className="direction-detail-page">
        <button
          className="back-link"
          onClick={() => navigate(`/projects/${projectId}/directions`)}
        >
          <ArrowLeft size={15} />
          返回方向比较
        </button>
        <header className="page-heading">
          <p>创意方向详情</p>
          <h1>{direction.name}</h1>
          <span>{direction.concept}</span>
        </header>
        <section className="direction-focus">
          <div className="direction-focus__image">
            <img
              src={
                visualAssets[
                  (direction.strategyIndex - 1) % Math.max(visualAssets.length, 1)
                ]?.url ?? "/assets/brand/muse-hero.png"
              }
              alt={`${direction.name} 的视觉方向预览`}
            />
            <div>
              <strong>来源于当前情绪板</strong>
              <p>保留真实素材与方向参数之间的可追溯关系。</p>
            </div>
          </div>
          <div className="direction-focus__copy">
            <h2>核心策略</h2>
            <p>{direction.concept}</p>
            <div className="direction-attribute-list">
              <span>
                <b>构图原则</b>
                {direction.composition}
              </span>
              <span>
                <b>字体方向</b>
                {direction.typography}
              </span>
              <span>
                <b>图像语言</b>
                {direction.imageLanguage}
              </span>
            </div>
          </div>
        </section>
        <div className="direction-attributes">
          <Surface title="关键词">
            <TagList items={direction.keywords} tone="ai" />
          </Surface>
          <Surface title="建议采用">
            <ul className="plain-list">
              {direction.do.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Surface>
          <Surface title="建议避免">
            <ul className="plain-list">
              {direction.dont.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Surface>
        </div>
      </div>
    </AppShell>
  );
}
