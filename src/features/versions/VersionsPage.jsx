import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Download,
  GitBranch,
  History,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { AppShell } from "../../components/shell";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  StatusPill,
  Surface,
} from "../../components/ui";
import { buildVersionLineage } from "../../lib/versions/versionLineage";
import { compareVersionSnapshots } from "../../lib/versions/versionLineage";
import { createMuseBundle, downloadJson } from "../../lib/transfer/museBundle";
import { formatDate } from "../../lib/ids";
import { useMuseStore } from "../../stores/useMuseStore";
import { MissingProject } from "../projects/ProjectPages";

function diffAreas(diff) {
  if (!diff || typeof diff !== "object") return [];
  const labels = {
    project: "项目状态",
    briefs: "项目简报",
    assets: "素材",
    researchItems: "研究",
    moodboardItems: "情绪板",
    analyses: "分析",
    directions: "创意方向",
    explorations: "视觉探索",
    critiques: "评审",
    canvas: "项目画布",
  };
  return Object.keys(diff).map((key) => labels[key] ?? key);
}

export function VersionsPage() {
  const { projectId } = useParams();
  const project = useMuseStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const allVersions = useMuseStore((state) => state.versions);
  const versions = allVersions.filter((item) => item.projectId === projectId);
  const createVersion = useMuseStore((state) => state.createVersion);
  const branchVersion = useMuseStore((state) => state.branchVersion);
  const restoreVersion = useMuseStore((state) => state.restoreVersion);
  const [summary, setSummary] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null);
  if (!project) return <MissingProject />;
  const selected =
    versions.find((item) => item.id === selectedId) ??
    [...versions].sort((a, b) => b.number - a.number)[0];
  const parent = versions.find((item) => item.id === selected?.parentVersionId);
  const changes = selected
    ? diffAreas(compareVersionSnapshots(parent?.snapshot, selected.snapshot))
    : [];
  const graph = useMemo(() => buildVersionLineage(versions), [versions]);
  return (
    <AppShell
      project={project}
      context={
        <>
          <div className="context-title">
            <History size={20} />
            <h2>版本详情</h2>
          </div>
          {selected ? (
            <>
              <Surface
                title={`V${selected.number} · ${selected.changeSummary}`}
              >
                <p>{formatDate(selected.createdAt)}</p>
                <StatusPill status="ai">
                  {selected.branchId === "main" ? "主线" : "分支"}
                </StatusPill>
              </Surface>
              <Surface title="相对父版本变化">
                {changes.length ? (
                  <ul className="plain-list">
                    {changes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">这是首个版本，或与父版本无结构变化。</p>
                )}
              </Surface>
              <div className="context-actions">
                <Button
                  variant="quiet"
                  icon={GitBranch}
                  onClick={() => branchVersion(selected.id)}
                >
                  从此版本创建分支
                </Button>
                <Button
                  icon={RotateCcw}
                  onClick={() => setPendingRestore(selected)}
                >
                  恢复此版本
                </Button>
              </div>
            </>
          ) : (
            <p className="context-subtitle">
              保存首个版本后，可以查看谱系、差异和分支。
            </p>
          )}
        </>
      }
    >
      <div className="versions-page">
        <header className="page-heading page-heading--actions">
          <div>
            <p>版本记录</p>
            <h1>保留每一次关键设计决策</h1>
            <span>恢复操作会创建新的分支版本，不会删除或改写已有历史。</span>
          </div>
          <Button
            variant="quiet"
            icon={Download}
            onClick={async () =>
              downloadJson(
                await createMuseBundle(projectId),
                `Muse-${project.name}.json`,
              )
            }
          >
            导出项目 JSON
          </Button>
        </header>
        <div className="version-save">
          <Field label="本次版本说明">
            <input
              aria-label="本次版本说明"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="例如：确认方向后，调整了构图层级与色彩比例"
            />
          </Field>
          <Button
            icon={Save}
            onClick={async () => {
              const version = await createVersion(projectId, summary);
              setSummary("");
              setSelectedId(version.id);
            }}
          >
            保存当前版本
          </Button>
        </div>
        {versions.length ? (
          <>
            <section className="version-flow">
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                onNodeClick={(_, node) => setSelectedId(node.id)}
              >
                <Background color="#33423b" gap={18} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </section>
            <div className="version-list">
              {[...versions]
                .sort((a, b) => b.number - a.number)
                .map((version) => (
                  <button
                    className={selected?.id === version.id ? "is-selected" : ""}
                    key={version.id}
                    onClick={() => setSelectedId(version.id)}
                  >
                    <span>V{version.number}</span>
                    <div>
                      <strong>{version.changeSummary}</strong>
                      <small>{formatDate(version.createdAt)}</small>
                    </div>
                    <StatusPill status="ai">
                      {version.branchId === "main" ? "主线" : "分支"}
                    </StatusPill>
                  </button>
                ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="还没有版本记录"
            description="在完成简报、锁定方向或评审后保存版本，方便后续回看与分支。"
            action={
              <Button
                icon={Save}
                onClick={async () =>
                  setSelectedId(
                    (await createVersion(projectId, "建立首个项目版本")).id,
                  )
                }
              >
                保存首个版本
              </Button>
            }
          />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pendingRestore)}
        title={`恢复 V${pendingRestore?.number}？`}
        description="当前内容会切换到该版本的项目快照，并创建一条新的恢复分支；已有版本历史不会被删除。"
        confirmText="恢复并创建分支"
        onCancel={() => setPendingRestore(null)}
        onConfirm={async () => {
          await restoreVersion(pendingRestore.id);
          setPendingRestore(null);
        }}
      />
    </AppShell>
  );
}
