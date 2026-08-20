import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, CircleDashed, RefreshCw, Sparkles } from "lucide-react";
import type { ProjectId } from "../../domain/shared/id.js";
import { db } from "../../db/database.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, StatusPill } from "../../components/ui.jsx";
import { useMuseStore } from "../../stores/useMuseStore.js";

type StepStatus = "pending" | "processing" | "success" | "error";
type CreationStep = { id: string; label: string; detail: string; status: StepStatus };
type CreationRun = { status: "running" | "success" | "partial" | "error"; steps: CreationStep[]; error?: string; updatedAt: string };

const RUN_PREFIX = "project-creation:";
const STEP_DISPLAY_MS = 140;
const FINAL_DISPLAY_MS = 220;
type PreferenceRecord = { id: string; value?: unknown; updatedAt?: string };
const preferencesTable = db.table<PreferenceRecord, string>("preferences");
const defaultSteps: readonly CreationStep[] = [
  { id: "save", label: "保存原始输入", detail: "先创建 Project ID，保存用户原始 Brief 与项目归属。", status: "pending" },
  { id: "understanding", label: "生成项目理解", detail: "仅生成 Project Understanding 与 Design Brief Draft，不调用图片 AI。", status: "pending" },
  { id: "gate", label: "准备人工确认", detail: "等待你编辑、删除、修改并确认项目理解。", status: "pending" },
];

function cloneSteps(steps: readonly CreationStep[] = defaultSteps): CreationStep[] {
  return defaultSteps.map((fallback) => ({ ...fallback, ...(steps.find((item) => item.id === fallback.id) ?? {}) }));
}

function runKey(projectId: string) {
  return `${RUN_PREFIX}${projectId}`;
}

function makeRun(partial: Partial<CreationRun> = {}): CreationRun {
  return {
    status: partial.status ?? "running",
    steps: cloneSteps(partial.steps),
    ...(partial.error ? { error: partial.error } : {}),
    updatedAt: new Date().toISOString(),
  };
}

async function readRun(projectId: string): Promise<CreationRun | null> {
  const record = await preferencesTable.get(runKey(projectId));
  if (!record?.value || typeof record.value !== "object") return null;
  const value = record.value as Partial<CreationRun>;
  return makeRun({ ...value, steps: cloneSteps(Array.isArray(value.steps) ? value.steps : undefined) });
}

async function saveRun(projectId: string, value: CreationRun) {
  const next = { ...value, updatedAt: new Date().toISOString() };
  await preferencesTable.put({ id: runKey(projectId), value: next, updatedAt: next.updatedAt });
  return next;
}

function pause(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function StepIcon({ status }: { readonly status: StepStatus }) {
  if (status === "success") return <Check aria-hidden="true" size={17} />;
  if (status === "error") return <AlertCircle aria-hidden="true" size={17} />;
  if (status === "processing") return <CircleDashed aria-hidden="true" size={17} className="creation-progress__spinner" />;
  return <span className="creation-progress__dot" aria-hidden="true" />;
}

export function ProjectCreationProgressPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = useMuseStore((state) => state.projects.find((item: { id: string }) => item.id === projectId));
  const prepareIndustrialProject = useMuseStore((state) => state.prepareIndustrialProject);
  const [run, setRun] = useState<CreationRun>(() => makeRun());
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [readError, setReadError] = useState("");
  const startRef = useRef(false);

  const progress = useMemo(() => {
    const completed = run.steps.filter((step) => step.status === "success").length;
    return Math.round((completed / run.steps.length) * 100);
  }, [run.steps]);

  const start = useCallback(async (existing?: CreationRun | null) => {
    if (!projectId || startRef.current) return;
    startRef.current = true;
    setStarted(true);
    setLoading(false);
    setReadError("");
    let current = makeRun({ steps: existing?.steps });
    setRun(current);
    await saveRun(projectId, current);
    try {
      await prepareIndustrialProject(projectId as ProjectId, async (label: string, detail: string, status: StepStatus = "success") => {
        const step = current.steps.find((item) => item.label === label);
        current = {
          ...current,
          steps: current.steps.map((item) => item.id === step?.id ? { ...item, status, detail } : item),
          status: status === "error" || current.status === "partial" ? "partial" : "running",
        };
        setRun(current);
        await saveRun(projectId, current);
        if (status === "success") await pause(STEP_DISPLAY_MS);
      });
      current = { ...current, status: current.status === "partial" ? "partial" : "success" };
      setRun(current);
      await saveRun(projectId, current);
      await pause(FINAL_DISPLAY_MS);
      navigate(`/projects/${projectId}/overview`, { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "项目创建失败，请重试。";
      current = { ...current, status: "error", error: message, steps: current.steps.map((item) => item.status === "processing" ? { ...item, status: "error", detail: "这一步没有完成，已有内容不会被覆盖。" } : item) };
      setRun(current);
      await saveRun(projectId, current);
    } finally {
      startRef.current = false;
      setStarted(false);
    }
  }, [navigate, prepareIndustrialProject, projectId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    void readRun(projectId).then((existing) => {
      if (!active) return;
      if (existing?.status === "success" || existing?.status === "partial") {
        navigate(`/projects/${projectId}/overview`, { replace: true });
        return;
      }
      void start(existing);
    }).catch(() => {
      if (active) {
        setLoading(false);
        setReadError("无法读取创建进度，但可以安全重试。 ");
      }
    });
    return () => { active = false; };
  }, [navigate, projectId, start]);

  if (!projectId || !project) {
    return <AppShell mode="new-project"><div className="creation-progress-page"><p role="alert">项目不存在或已移到回收站。</p><Button icon={ArrowRight} onClick={() => navigate("/projects")}>返回我的项目</Button></div></AppShell>;
  }

  return (
    <AppShell mode="new-project">
      <main className="creation-progress-page" aria-labelledby="creation-progress-title">
        <div className="creation-progress__header">
          <div>
            <p className="creation-progress__eyebrow">PROJECT BUILD / {project.name}</p>
            <h1 id="creation-progress-title">正在把你的命题变成一个可继续判断的项目</h1>
            <p className="creation-progress__intro">先保存原始 Brief，再生成第一轮 Project Understanding。概念图片必须等你锁定方向并选择概念后才会生成。</p>
          </div>
          <div className="creation-progress__orb" aria-hidden="true"><span /><i /><b /></div>
        </div>
        <section className="creation-progress__surface liquid-glass-surface" aria-label="项目创建进度" aria-busy={run.status === "running"}>
          <header className="creation-progress__meter-header" aria-live="polite"><div><StatusPill status={run.status === "error" || run.status === "partial" ? "warn" : run.status === "success" ? "success" : "ai"}>{run.status === "error" ? "需要重试" : run.status === "partial" ? "项目已创建" : run.status === "success" ? "已完成" : "正在制作"}</StatusPill><strong>{progress}%</strong></div><span>{loading ? "正在读取创建记录…" : started ? "Muse 正在保存并理解项目" : "可以查看项目理解"}</span></header>
          <div className="creation-progress__meter"><span style={{ width: `${progress}%` }} /></div>
          <ol className="creation-progress__steps">
            {run.steps.map((step) => <li key={step.id} data-status={step.status}><span className="creation-progress__step-icon"><StepIcon status={step.status} /></span><div><strong>{step.label}</strong><p>{step.detail}</p></div><small>{step.status === "success" ? "完成" : step.status === "processing" ? "处理中" : step.status === "error" ? "失败" : "等待"}</small></li>)}
          </ol>
          {run.status === "error" || readError ? <div className="creation-progress__error" role="alert"><AlertCircle size={17} /><span>{readError || run.error || "创建没有完成，已有内容会保留。"}</span><Button variant="quiet" icon={RefreshCw} onClick={() => { startRef.current = false; void start(run); }}>重新生成理解</Button></div> : null}
          {run.status === "partial" ? <div className="creation-progress__error" role="status"><AlertCircle size={17} /><span>项目已创建，但 AI 项目理解暂时生成失败。当前项目内容已保存，可在下一页手动完善或重试。</span><Button variant="quiet" icon={ArrowRight} onClick={() => navigate(`/projects/${projectId}/overview`)}>手动完善</Button></div> : null}
          {run.status === "success" ? <div className="creation-progress__next"><Sparkles size={17} /><span>Project Understanding 与 Design Brief Draft 已保存。请先人工确认，后续阶段会按顺序生成。</span><Button icon={ArrowRight} onClick={() => navigate(`/projects/${projectId}/overview`)}>查看项目理解</Button></div> : null}
        </section>
        <p className="creation-progress__footnote">本页不会生成图片。产品概念页调用真实图片 API 后，会等待每一张结果返回，并在保存前完成尺寸、可加载性、来源与重复视觉校验。</p>
      </main>
    </AppShell>
  );
}
