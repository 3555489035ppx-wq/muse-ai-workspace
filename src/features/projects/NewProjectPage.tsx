import React, { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Circle, Sparkles } from "lucide-react";
import type { Project } from "../../domain/project/index.js";
import type { ProjectId } from "../../domain/shared/id.js";
import { isEntityId } from "../../domain/shared/id.js";
import { getDefaultDatabase } from "../../db/database.js";
import { ProjectRepository } from "../../repositories/ProjectRepository.js";
import {
  createTemplateInstantiationService,
  getPhaseOneTemplate,
  type InstantiateProjectInput,
  type TemplateInstantiationResult,
} from "../../application/template/index.js";
import { useMuseStore } from "../../stores/useMuseStore.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, CustomSelect, Field, StatusPill, TagList } from "../../components/ui.jsx";
import { AiProviderStatus } from "../../components/ai/AiProviderStatus";
import { MuseAiClient } from "../../lib/api/museAiClient";

export interface ProjectCreationPort {
  instantiate(input: InstantiateProjectInput): Promise<TemplateInstantiationResult>;
}

export interface ProjectRuntimeHydrationPort {
  refresh(): Promise<void>;
  hydrateIndustrialProject?(projectId: ProjectId): Promise<void>;
}

export interface ProjectCreationFormValue {
  readonly name: string;
  readonly description: string;
  readonly audience?: string;
  readonly background?: string;
  readonly deliverables?: string;
  readonly constraints?: string;
  readonly keywords?: string;
  readonly avoid?: string;
  readonly projectType: "brand" | "editorial" | "ui" | "campaign";
  readonly targetOutput: "brand_identity" | "poster" | "social_media" | "packaging" | "digital_experience";
  readonly templateId?: string;
}

export type ProjectCreationMode = "quick" | "full";

function splitList(value: string | undefined): readonly string[] | undefined {
  const items = String(value ?? "")
    .split(/[，,、;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? [...new Set(items)] : undefined;
}

export function validateProjectCreationForm(value: ProjectCreationFormValue, options: { readonly requireAudience?: boolean } = {}): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (value.name.trim().length < 2) errors.name = "请输入至少 2 个字的项目名称";
  if (value.description.trim().length < 10) errors.description = "请至少用 10 个字说明设计目标";
  if (options.requireAudience && !value.audience?.trim()) errors.audience = "请说明目标用户，方便后续研究与方向生成";
  else if (value.audience !== undefined && value.audience.trim().length < 2) errors.audience = "请说明目标用户，方便后续研究与方向生成";
  if (value.templateId !== undefined && !isEntityId(value.templateId)) errors.templateId = "模板链接无效，请重新选择";
  return errors;
}

export async function submitProjectCreation(
  service: ProjectCreationPort,
  value: ProjectCreationFormValue,
): Promise<TemplateInstantiationResult> {
  const errors = validateProjectCreationForm(value);
  if (Object.keys(errors).length > 0) throw new ProjectCreationFormError(errors);
  const inferredConstraints = value.constraints?.trim() ? splitList(value.constraints) : splitList(value.background);
  return service.instantiate({
    name: value.name,
    description: value.description,
    ...(value.audience?.trim() ? { audience: value.audience.trim() } : {}),
    ...(value.background?.trim() ? { context: value.background.trim(), references: [value.background.trim()] } : {}),
    projectType: value.projectType,
    targetOutputs: [value.targetOutput],
    ...(splitList(value.deliverables) ? { deliverables: splitList(value.deliverables) } : {}),
    ...(inferredConstraints ? { constraints: inferredConstraints } : {}),
    ...(splitList(value.keywords) ? { keywords: splitList(value.keywords) } : {}),
    ...(splitList(value.avoid) ? { avoid: splitList(value.avoid) } : {}),
    templateId: value.templateId === undefined ? undefined : isEntityId(value.templateId) ? value.templateId : undefined,
  });
}

export async function submitProjectCreationAndHydrate(
  service: ProjectCreationPort,
  hydration: ProjectRuntimeHydrationPort,
  value: ProjectCreationFormValue,
): Promise<TemplateInstantiationResult> {
  const result = await submitProjectCreation(service, value);
  await hydration.refresh();
  return result;
}

export class ProjectCreationFormError extends Error {
  constructor(readonly fields: Readonly<Record<string, string>>) {
    super("项目表单校验失败");
    this.name = "ProjectCreationFormError";
  }
}

export async function reloadCreatedProject(projectId: ProjectId): Promise<Project | undefined> {
  return new ProjectRepository(getDefaultDatabase()).get(projectId);
}

export interface NewProjectPageProps {
  readonly service?: ProjectCreationPort;
  readonly hydration?: ProjectRuntimeHydrationPort;
}

const defaultRuntimeHydration: ProjectRuntimeHydrationPort = {
  refresh: async () => useMuseStore.getState().refresh(),
  hydrateIndustrialProject: async (projectId) => {
    await useMuseStore.getState().ensureIndustrialProject(projectId);
  },
};

const aiClient = new MuseAiClient();

export function NewProjectPage({ service, hydration = defaultRuntimeHydration }: NewProjectPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template") ?? undefined;
  const quickIdea = searchParams.get("idea")?.trim() ?? "";
  const template = templateId === undefined ? undefined : getPhaseOneTemplate(templateId);
  const creationService = useMemo(() => service ?? createTemplateInstantiationService(), [service]);
  const submittingRef = useRef(false);
  const [mode, setMode] = useState<ProjectCreationMode>("quick");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [operationError, setOperationError] = useState("");
  const [value, setValue] = useState<ProjectCreationFormValue>({
    name: quickIdea ? quickIdea.slice(0, 36) : "",
    description: quickIdea
      ? `围绕“${quickIdea}”进行产品/工业设计，明确用户、场景、核心问题和验证目标。`
      : template?.briefPlaceholder ?? "",
    audience: "",
    background: "",
    deliverables: "",
    constraints: "",
    keywords: "",
    avoid: "",
    projectType: template?.projectType ?? "ui",
    targetOutput: template?.recommendedOutputs[0] ?? "digital_experience",
    templateId,
  });

  const update = <K extends keyof ProjectCreationFormValue>(key: K, next: ProjectCreationFormValue[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors = validateProjectCreationForm(value, { requireAudience: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    setOperationError("");
    try {
      const result = await submitProjectCreationAndHydrate(creationService, hydration, value);
      navigate(`/projects/${result.projectId}/creating`);
    } catch (error: unknown) {
      if (error instanceof ProjectCreationFormError) setErrors(error.fields);
      else setOperationError(error instanceof Error ? error.message : "项目创建失败，请稍后重试");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <AppShell mode="new-project">
      <main className="new-project-page" aria-labelledby="new-project-title">
        <div className="new-project-layout">
        <form className="project-form" onSubmit={(event) => void submit(event)} noValidate>
          <header>
            <p>{template ? "模板策略已载入" : "从真实需求开始"}</p>
            <h1 id="new-project-title">创建创意项目</h1>
            <span>先用自然语言说清楚要设计什么；Muse 会先保存项目，再生成可编辑的项目理解。</span>
          </header>
          <div className="project-creation-mode" role="tablist" aria-label="创建模式">
            <button type="button" role="tab" aria-selected={mode === "quick"} className={mode === "quick" ? "is-active" : ""} onClick={() => setMode("quick")}>
              <strong>Quick Start</strong><span>30 秒建立真实项目</span>
            </button>
            <button type="button" role="tab" aria-selected={mode === "full"} className={mode === "full" ? "is-active" : ""} onClick={() => setMode("full")}>
              <strong>完整定义</strong><span>一次补充全部设计字段</span>
            </button>
          </div>
          {template ? (
            <section className="new-project-template-context" aria-label="当前模板策略">
              <div><StatusPill status="ai">当前模板</StatusPill><strong>{template.name}</strong></div>
              <p>{template.briefPlaceholder}</p>
              <TagList items={[...template.researchStrategy.focus, ...template.moodboardStrategy.territoryHints].slice(0, 6)} />
            </section>
          ) : null}
          <Field label="项目名称" hint="使用清晰、可辨认的项目名称" error={errors.name}>
            <input autoFocus name="project-name" autoComplete="off" value={value.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：可在居家与短途出行使用的便携消毒器" />
          </Field>
          <Field label="想设计什么" hint="可以直接写一个陌生产品命题、问题或机会" error={errors.description}>
            <textarea rows={7} value={value.description} onChange={(event) => update("description", event.target.value)} placeholder={template?.briefPlaceholder ?? "例如：为独自照护婴幼儿的家庭设计一款便携消毒设备，需要兼顾单手操作、收纳和易清洁。"} />
          </Field>
          <div className="two-fields">
            <Field label="目标用户" hint="谁会在什么状态下使用它" error={errors.audience}>
              <input required value={value.audience ?? ""} onChange={(event) => update("audience", event.target.value)} placeholder="例如：独自照护婴幼儿、需要短途携带的家长" />
            </Field>
            <Field label={mode === "full" ? "项目背景 / 使用场景" : "场景 / 限制条件"} hint="可选：地点、频率、尺寸、成本、材料或时间">
              <input value={value.background ?? ""} onChange={(event) => update("background", event.target.value)} placeholder="例如：夜间回家；不能打扰室友；需要低噪且易清洁" />
            </Field>
          </div>
          {mode === "full" ? <>
            <div className="two-fields">
              <Field label="限制条件" hint="尺寸、成本、材料、渠道或时间">
                <input value={value.constraints ?? ""} onChange={(event) => update("constraints", event.target.value)} placeholder="例如：单手操作、可擦洗、控制部件不超过 3 个" />
              </Field>
              <Field label="预期交付物" hint="用逗号或换行分隔">
                <input value={value.deliverables ?? ""} onChange={(event) => update("deliverables", event.target.value)} placeholder="例如：研究证据、三条设计方向、产品概念图、CMF 方案" />
              </Field>
            </div>
            <div className="two-fields">
              <Field label="设计关键词" hint="希望保留的气质与感受">
                <input value={value.keywords ?? ""} onChange={(event) => update("keywords", event.target.value)} placeholder="例如：克制、可靠、轻量、易读" />
              </Field>
            </div>
            <div className="two-fields">
              <Field label="避免项" hint="不希望出现的表达或方案">
                <input value={value.avoid ?? ""} onChange={(event) => update("avoid", event.target.value)} placeholder="例如：过度装饰、复杂菜单、廉价塑料感" />
              </Field>
              <div className="field"><span className="field__label">核心交付物</span><CustomSelect label="核心交付物" value={value.targetOutput} onChange={(next: string) => update("targetOutput", next as ProjectCreationFormValue["targetOutput"])} options={[{value:"digital_experience",label:"产品概念方案"}]} /></div>
            </div>
          </> : null}
          {errors.templateId ? <p role="alert">{errors.templateId}</p> : null}
          {operationError ? <p role="alert">{operationError}</p> : null}
          <Button type="submit" icon={Sparkles} loading={submitting}>创建并理解项目</Button>
        </form>
        <aside className="new-project-guide" aria-labelledby="creation-guide-title">
          <div><p>下一步会发生什么</p><h2 id="creation-guide-title">Muse 将为你整理</h2></div>
          <div className="guide-list">
            {[
              [Boolean(value.name.trim() && value.description.trim().length >= 10 && value.audience?.trim()), "Project Understanding", "只根据这次输入形成项目定义、用户、场景、核心问题与约束"],
              [Boolean(value.name.trim() && value.description.trim().length >= 10), "Design Brief Draft", "生成可编辑的设计简报初稿，不会直接进入后续阶段"],
              [Boolean(value.audience?.trim()), "人工确认闸门", "你可以编辑、删除、修改；确认后才会继续"],
              [Boolean(template || value.targetOutput), "按阶段继续生成", "研究、洞察、方向、概念与 CMF 逐阶段读取已确认上下文"],
            ].map(([ready, title, description]) => (
              <article key={String(title)} data-ready={ready ? "true" : "false"}>
                {ready ? <Check aria-hidden="true" size={18} /> : <Circle aria-hidden="true" size={18} />}
                <div><strong>{title}</strong><p>{description}</p></div>
              </article>
            ))}
          </div>
          <div className="new-project-guide__status" data-tour="provider"><AiProviderStatus client={aiClient}/><p className="new-project-guide__note">未配置 API 时仍可保存和编辑项目，但不会伪造 AI 文本或图片。真实生成只由服务端调用，密钥不会进入浏览器。</p><Link className="new-project-guide__provider-link" to="/settings?tab=provider">查看 API 接入设置</Link></div>
        </aside>
        </div>
      </main>
    </AppShell>
  );
}
