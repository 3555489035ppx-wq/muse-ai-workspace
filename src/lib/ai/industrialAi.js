import { MuseAiClient } from "../api/museAiClient.js";
import { buildDirectionContext, formatDirectionContext } from "./designDirectionProvider.js";
import { buildProjectBrain, serializeStageContext } from "../../services/ai/index.js";
import { validateAiResult } from "../../services/ai/schemas.js";

const client = new MuseAiClient();

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `muse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function liveReady(capabilities, kind) {
  return Boolean(capabilities?.providers?.[kind]?.ready);
}

const purposeStages = { overview: "brief", research: "research", research_plan: "research", insight: "insight", direction: "direction", exploration: "concept", concept: "concept", visual_brief: "visual", moodboard: "cmf", cmf: "cmf", review: "review", version: "version", decision_map: "decision-map", prompt: "visual", project_brain: "brief" };

function conceptCount(value) {
  return Array.isArray(value?.concepts) ? value.concepts.length : 0;
}

function logConceptGeneration({ stage, response, validationResult, persistedConceptCount = 0, renderedConceptCount = 0 }) {
  console.info("[ConceptGeneration]", JSON.stringify({
    stage,
    "HTTP status": response?.trace?.httpStatus ?? 0,
    provider: response?.trace?.providerId ?? "unknown",
    model: response?.trace?.model ?? "unknown",
    rawContentLength: response?.trace?.rawContentLength ?? 0,
    parsedConceptCount: conceptCount(response?.result),
    validationResult,
    persistedConceptCount,
    renderedConceptCount,
  }));
}

export function validateIndustrialImage(url, options = {}) {
  const { minWidth = 768, minHeight = 512, timeoutMs = 15_000 } = options;
  if (!url || typeof Image === "undefined") return Promise.resolve({ ok: true, width: 0, height: 0 });
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout", width: 0, height: 0 }), timeoutMs);
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      finish({ ok: width >= minWidth && height >= minHeight, reason: width >= minWidth && height >= minHeight ? undefined : "low-resolution", width, height });
    };
    image.onerror = () => finish({ ok: false, reason: "unreadable", width: 0, height: 0 });
    image.src = url;
  });
}

function hashSeed(value) {
  return [...String(value ?? "")].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[char]));
}

export function createLocalIndustrialVisual({ project, prompt }) {
  const seed = hashSeed(`${project?.id ?? "project"}:${project?.name ?? ""}:${prompt}`);
  const variant = seed % 3;
  const accent = ["#90b9d7", "#b89a6e", "#9bb6a7"][variant];
  const accentSoft = ["#314b63", "#5b4838", "#3d5449"][variant];
  const body = ["#e4e7e4", "#d6d0c3", "#cbd2d0"][variant];
  const bodyShadow = ["#9aa7aa", "#a49b8e", "#8f9b98"][variant];
  const angle = 18 + (seed % 12);
  const lightX = 130 + (seed % 860);
  const lightY = 96 + (seed % 360);
  const lightR = 26 + (seed % 48);
  const lightOpacity = 0.08 + ((seed % 7) / 100);
  const title = escapeXml(project?.name || "产品概念");
  const shell = variant === 0
    ? `<rect x="394" y="198" width="412" height="370" rx="86" fill="url(#body)"/><rect x="435" y="244" width="330" height="108" rx="32" fill="#151b21" opacity=".92"/><circle cx="600" cy="298" r="18" fill="${accent}"/><rect x="490" y="406" width="220" height="26" rx="13" fill="${accent}" opacity=".92"/><path d="M450 198 C450 128 505 102 600 102 C695 102 750 128 750 198" fill="none" stroke="${accent}" stroke-width="22" stroke-linecap="round"/>`
    : variant === 1
      ? `<rect x="368" y="224" width="464" height="300" rx="54" fill="url(#body)"/><path d="M398 314 H802" stroke="${accent}" stroke-width="24" opacity=".95"/><rect x="470" y="364" width="260" height="72" rx="22" fill="#171b20"/><circle cx="600" cy="400" r="16" fill="${accent}"/><path d="M430 224 L484 144 H716 L770 224" fill="none" stroke="${accentSoft}" stroke-width="18" stroke-linejoin="round"/>`
      : `<path d="M430 222 Q430 176 480 176 H720 Q770 176 770 222 V536 Q770 582 720 582 H480 Q430 582 430 536 Z" fill="url(#body)"/><rect x="482" y="270" width="236" height="116" rx="34" fill="#12181e"/><circle cx="532" cy="328" r="18" fill="${accent}"/><circle cx="668" cy="328" r="18" fill="${accentSoft}"/><path d="M460 432 H740" stroke="${accent}" stroke-width="18"/><path d="M455 176 C455 112 500 84 600 84 C700 84 745 112 745 176" fill="none" stroke="${accent}" stroke-width="20" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="${title}产品概念研究图"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d141a"/><stop offset=".55" stop-color="${accentSoft}"/><stop offset="1" stop-color="#11161b"/></linearGradient><linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${body}"/><stop offset=".7" stop-color="#f3f1eb"/><stop offset="1" stop-color="${bodyShadow}"/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="24"/></filter><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0b1014" stop-opacity="0"/><stop offset="1" stop-color="#070a0d" stop-opacity=".8"/></linearGradient></defs><rect width="1200" height="800" fill="url(#bg)"/><g opacity=".18" stroke="#dbe4e7" stroke-width="1"><path d="M80 130 H1120 M80 230 H1120 M80 330 H1120 M80 430 H1120 M80 530 H1120 M80 630 H1120"/><path d="M180 70 V680 M340 70 V680 M500 70 V680 M660 70 V680 M820 70 V680 M980 70 V680"/></g><path d="M${lightX - 150} ${lightY + 90} C${lightX - 50} ${lightY - 20} ${lightX + 80} ${lightY + 44} ${lightX + 150} ${lightY - 64}" fill="none" stroke="${accent}" stroke-width="${3 + (seed % 5)}" stroke-linecap="round" opacity="${lightOpacity}"/><circle cx="${lightX}" cy="${lightY}" r="${lightR}" fill="${accent}" opacity="${lightOpacity}"/><ellipse cx="600" cy="645" rx="330" ry="54" fill="#05080a" opacity=".72" filter="url(#shadow)"/><g transform="rotate(${angle} 600 400)">${shell}</g><path d="M0 560 C260 510 410 670 640 590 C840 520 1010 600 1200 548 V800 H0 Z" fill="url(#floor)"/><circle cx="930" cy="174" r="92" fill="${accent}" opacity=".12"/><circle cx="930" cy="174" r="62" fill="none" stroke="${accent}" stroke-width="2" opacity=".45"/></svg>`;
  const frameSvg = svg
    .replace('width="1200" height="800" viewBox="0 0 1200 800"', 'width="1200" height="675" viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid meet"')
    .replace('<rect width="1200" height="800"', '<rect width="1200" height="675"')
    .replace('V800 H0 Z', 'V675 H0 Z');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(frameSvg)}`;
}

export async function requestIndustrialStructured({ project, purpose, instruction, schemaHint, enableSearch = false }) {
  try {
    const capabilities = await client.capabilities();
    if (!liveReady(capabilities, "text")) return { source: "unavailable", result: null, capabilities };
    const brain = buildProjectBrain(project);
    const stage = purposeStages[purpose] ?? "brief";
    const request = (content, suffix = "") => client.structured({
      projectId: project.id,
      purpose,
      instruction: `${content}\n\n以下是该阶段唯一可用的 ProjectBrain 压缩上下文。不得读取未确认阶段，也不得改写 userLockedFields：\n${serializeStageContext(brain, stage)}`,
      schemaHint,
      enableSearch,
      idempotencyKey: `industrial-${project.id}-${purpose}-${uuid()}${suffix}`,
    });
    let response = await request(instruction);
    let validation = validateAiResult(purpose, response.result);
    if (!validation.success) {
      response = await request(`${instruction}\n\n上一次输出未通过结构校验：${validation.error}。请只修正 JSON 结构并完整重试一次。`, "-retry");
      validation = validateAiResult(purpose, response.result);
    }
    if ((purpose === "concept" || purpose === "exploration") && !validation.success) {
      logConceptGeneration({ stage: "validation", response, validationResult: `failed:${validation.error}` });
    }
    if (!validation.success) return { source: "error", ok: response.ok === true, parsed: response.trace?.parsed === true, validation: { success: false, error: validation.error }, errorCode: "SCHEMA_VALIDATION_FAILED", result: null, error: new Error(`AI_SCHEMA_INVALID:${validation.error}`), capabilities };
    if (purpose === "concept" || purpose === "exploration") logConceptGeneration({ stage: "validation", response, validationResult: "success" });
    return { source: "live", ok: response.ok === true, parsed: response.trace?.parsed === true, validation: { success: true }, result: validation.data, trace: response.trace, capabilities };
  } catch (error) {
    if (purpose === "concept" || purpose === "exploration") logConceptGeneration({ stage: "error", response: null, validationResult: `failed:${error instanceof Error ? error.message : "unknown"}` });
    const errorCode = String(error?.code ?? (error instanceof Error ? error.name : "PROVIDER_FAILURE"));
    return error instanceof TypeError ? { source: "unavailable", ok: false, parsed: false, validation: { success: false, error: "provider-unavailable" }, errorCode: "BFF_UNREACHABLE", result: null, error } : { source: "error", ok: false, parsed: false, validation: { success: false, error: error instanceof Error ? error.message : "provider-error" }, errorCode, result: null, error };
  }
}

export async function requestIndustrialResearchSearch({ project, query, questionId, maxResults = 5 }) {
  try {
    const capabilities = await client.capabilities();
    const searchCapability = capabilities?.providers?.search;
    if (!liveReady(capabilities, "search")) return {
      source: "unavailable",
      result: null,
      capabilities,
      errorCode: searchCapability?.configured ? "SEARCH_PROVIDER_DISABLED" : "SEARCH_PROVIDER_NOT_CONFIGURED",
    };
    const result = await client.researchSearch({
      projectId: project.id,
      query,
      questionId,
      maxResults,
      idempotencyKey: `industrial-search-${project.id}-${uuid()}`,
    });
    return { source: "live", result, capabilities };
  } catch (error) {
    return { source: error instanceof TypeError ? "unavailable" : "error", result: null, error };
  }
}

export async function requestIndustrialImage({ project, prompt, negativePrompt = "重复产品、错误结构、漂浮部件、额外按钮、文字水印、畸变手指、卡通渲染" }) {
  try {
    const capabilities = await client.capabilities();
    if (!liveReady(capabilities, "image")) return { source: "unavailable", result: null, capabilities };
    const result = await client.generateImage({
      projectId: project.id,
      stage: "concept",
      promptVersionId: uuid(),
      prompt,
      negativePrompt,
      idempotencyKey: `industrial-image-${project.id}-${uuid()}`,
    });
    return { source: "live", result, capabilities };
  } catch (error) {
    return { source: error instanceof TypeError ? "unavailable" : "error", result: null, error };
  }
}

export async function requestIndustrialImageEdit({ project, prompt, sourceAssetUrls, stage = "cmf", negativePrompt = "重复产品、改变设计身份、无关结构、文字水印、畸变、卡通渲染" }) {
  try {
    const capabilities = await client.capabilities();
    if (!liveReady(capabilities, "image")) return { source: "unavailable", result: null, capabilities };
    const result = await client.editImage({ projectId: project.id, stage, promptVersionId: uuid(), prompt, negativePrompt, sourceAssetUrls, idempotencyKey: `industrial-image-edit-${project.id}-${uuid()}` });
    return { source: "live", result, capabilities };
  } catch (error) {
    return { source: error instanceof TypeError ? "unavailable" : "error", result: null, error };
  }
}

export function briefInstruction(project, industrial) {
  return `请将下面的工业设计输入整理成可确认的 Design Brief。不要编造具体用户访谈数字；把未知内容明确标为待验证。\n项目名称：${project.name}\n原始目标：${industrial.brief.goal}\n目标用户：${industrial.brief.targetUser}\n使用场景：${industrial.brief.scenario}\n产品类别：${industrial.brief.productCategory}\n当前关键需求：${industrial.brief.keyNeeds.join("；")}\n约束：${industrial.brief.constraints.join("；")}\n设计关键词：${(industrial.brief.keywords ?? []).join("；") || "未提供"}\n避免项：${(industrial.brief.avoid ?? []).join("；") || "未提供"}`;
}

function researchEvidenceInput(project, industrial) {
  const records = project?.researchWorkspace?.evidence ?? industrial?.evidence ?? [];
  return records.slice(0, 12).map((item, index) => ({
    id: item.id ?? `${project?.id ?? "project"}-evidence-${index + 1}`,
    sourceId: item.sourceId ?? null,
    title: item.title ?? item.sourceTitle ?? `研究材料 ${index + 1}`,
    sourceTitle: item.sourceTitle ?? item.sourceName ?? "用户提供材料",
    sourceType: item.sourceType ?? item.type ?? "user_paste",
    originalExcerpt: item.originalExcerpt ?? item.fact ?? item.excerpt ?? "",
  }));
}

export function overviewInstruction(project, industrial, sourceBrief = {}) {
  const original = project?.originalBrief ?? {};
  return `请把原始项目输入整理为可确认的 Project Overview。只输出 JSON，不输出 Markdown，不生成图片，不重写原始需求，不添加与项目无关的工作流说明。保留用户明确输入的目标、用户、场景、限制与交付物；可以做产品设计语境下的归纳，但推断内容必须进入 openQuestions 或 confidenceNotes。核心冲突必须具体到本项目的使用任务、结构、材料、文化或体验取舍，不能使用“功能与美观”这类空泛表达。\n项目：${project.name}\n原始目标：${original.designGoal ?? industrial?.brief?.goal ?? "未提供"}\n原始用户：${original.audience ?? industrial?.brief?.targetUser ?? "未提供"}\n原始场景：${original.context ?? industrial?.brief?.scenario ?? "未提供"}\n原始交付物：${JSON.stringify(original.deliverables ?? project.outputTypes ?? [])}\n原始限制：${JSON.stringify(original.constraints ?? industrial?.brief?.constraints ?? [])}\n设计关键词：${JSON.stringify(original.keywords ?? industrial?.brief?.keywords ?? [])}\n避免项：${JSON.stringify(original.avoid ?? industrial?.brief?.avoid ?? [])}\n输出字段：projectName、projectType、location、timeContext、projectSummary、designGoal、coreConflict、targetUser、keywords、mustKeep、mustAvoid、deliverables、successCriteria、openQuestions。`;
}

export function researchInstruction(project, industrial) {
  const records = researchEvidenceInput(project, industrial);
  return `请对已有研究材料做真实的 Research Interpretation（研究解读），不要创造新的来源、访谈、数据、链接或外部事实。输出 {"evidence":[...]}，evidence 数量必须与输入材料一致或更少；每一条必须使用输入中的 id 或 sourceId，保留 originalExcerpt/fact 的原文事实，只补充 interpretation、designImplication 和 limitation。不要输出新的证据卡片，不要把设计建议伪装成事实。\n项目：${project.name}\n目标：${industrial.brief.goal}\n用户：${industrial.brief.targetUser}\n场景：${industrial.brief.scenario}\n设计问题：${industrial.brief.keyNeeds.join("；")}\n输入材料：${JSON.stringify(records)}`;
}

export function researchPlanInstruction(project, industrial) {
  const workspace = project?.researchWorkspace ?? {};
  const questions = (workspace.questions ?? []).map((item) => ({ id: item.id, question: item.label }));
  const lenses = (workspace.lenses ?? []).map((item) => ({ id: item.id, label: item.label, description: item.description }));
  const existingSources = (workspace.sources ?? []).slice(0, 8).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    hasExcerpt: Boolean(item.originalExcerpt),
    sourceUrl: item.sourceUrl ?? null,
  }));
  return `你是 Muse 的 AI Research Assistant（研究助手），负责把模糊的设计命题转成用户可以立即执行的研究计划。只输出 JSON，不输出 Markdown。\n\n重要边界：你不能联网，也不能声称已经找到任何真实来源；禁止编造访谈、统计数字、竞品事实、文章标题、链接、发布日期或用户结论。querySuggestions 只能是检索词，不是检索结果；preferredSources 只能写来源类型。所有判断都必须写成待验证的研究方向，不得把 AI 推断当成 evidence（研究证据）。\n\n请为每个输入的 research question 生成一条 questionPlan：保留原 questionId，不新增或改写研究问题；说明 whyThisMatters、evidenceNeed、2—4 个具体检索词、2—4 种优先来源类型。检索词要包含本项目的用户、场景或产品语境，避免“用户需求”“行业趋势”这类空词。再给出 gaps（信息缺口）与 nextActions（用户下一步动作）。如果已有来源，只能说明哪些问题尚未覆盖，不能把来源名称当成事实。\n\n项目：${project.name}\n设计目标：${industrial.brief.goal}\n目标用户：${industrial.brief.targetUser}\n核心场景：${industrial.brief.scenario}\n设计问题：${industrial.brief.keyNeeds.join("；")}\n研究问题：${JSON.stringify(questions)}\n研究镜头：${JSON.stringify(lenses)}\n已有来源摘要：${JSON.stringify(existingSources)}\n输出结构：{"questionPlans":[{"questionId":"existing-question-id","whyThisMatters":"string","evidenceNeed":"string","querySuggestions":["string"],"preferredSources":["string"]}],"gaps":["string"],"nextActions":["string"]}`;
}

export function insightInstruction(project, industrial) {
  const accepted = (project?.researchWorkspace?.evidence ?? industrial?.evidence ?? []).filter((item) => item.userStatus === "accepted" || item.accepted === true || item.status === "accepted");
  const evidence = accepted.map((item) => ({ id: item.id, title: item.title, sourceTitle: item.sourceTitle ?? item.sourceName, fact: item.originalExcerpt ?? item.fact, interpretation: item.interpretation, designImplication: item.designImplication }));
  return `请基于已确认 Design Brief 与已保留研究证据，生成 2 至 4 条可确认的 Design Insight。每条洞察必须由至少一条输入 evidenceIds 支撑，并说明为什么重要、对设计意味着什么。不要重复简报，不要生成图片，不要写 Moodboard、Creative Direction、Image Generation 或评审流程内容；不要引用不存在的 evidence id。洞察必须与项目具体产品、用户和场景相关。\n项目：${project.name}\n设计目标：${industrial.brief.goal}\n核心用户：${industrial.brief.targetUser}\n核心场景：${industrial.brief.scenario}\n已保留证据：${JSON.stringify(evidence)}`;
}

export function directionInstruction(project, industrial) {
  const context = buildDirectionContext(project);
  return `你是 Muse 的设计战略引擎。请只基于已确认的 Design Brief、已采纳的研究证据和已确认的设计洞察，先生成 5 个候选战略，再筛选 3 个真正不同的方向。方向不是颜色换皮，不生成图片，不返回缩略图，不使用原始输入中的工作流说明。每个方向必须包含 thesis、strategicIdea、userValue、evidenceIds、insightIds、领域相关逻辑、advantages、tradeoffs、risks、validationQuestions、successSignals、mustKeep、mustAvoid、supportLevel。证据不足时明确标记 preliminary，不能编造来源。三个方向要在战略优先级上有真实差异，并且每个方向都能回溯到已采纳证据和已确认洞察。\n${formatDirectionContext(context)}`;
}

export function conceptInstruction(project, industrial, direction) {
  const context = buildDirectionContext(project);
  const locked = project.lockedDirection;
  const directionRules = locked?.designRules?.join("；") || direction.mustKeep?.join("；") || direction.strategicIdea || direction.thesis;
  return `围绕已锁定的设计战略生成 3 个可比较的产品概念。概念页只能读取已确认 Design Brief、已采纳研究证据、已确认设计洞察和 Locked Direction；不要回读 Original Brief，不要重新发散成无关方案。每个概念必须严格区分字段语义：conceptStatement 是一句话定义，coreMechanism 只讲设计如何工作，userExperience 只讲用户如何操作和感受到什么，whyFitsDirection 只讲如何继承上一层方向，productExpression / spatialExpression / brandExpression / digitalExpression 只讲形态、结构或界面如何具体变化。四个核心字段不得复制、改写同一句话或只替换名词；若字段高度相似，请重新生成。概念编号使用 Concept 01 / Concept 02 / Concept 03，不使用 AA / AB / AC。图片如果在后续阶段生成，必须与当前概念、场景和设计战略一致，并且通过尺寸、可加载性和重复视觉校验。\n${formatDirectionContext(context)}\nLocked Direction：${direction.name}\n方向主张：${locked?.thesis || direction.thesis}\n必须保持的设计规则：${directionRules}\n方向证据：${(locked?.evidenceIds || direction.evidenceIds || []).join("、") || "暂无已采纳证据"}\n方向洞察：${(locked?.insightIds || direction.insightIds || []).join("、") || "暂无已确认洞察"}`;
}

export function cmfInstruction(project, industrial, concept) {
  const domain = buildProjectBrain(project).domain;
  const domainRules = domain === "brand-spatial"
    ? "这是品牌与空间项目。3 套方案必须分别说明 Color Logic、空间 Material Logic、透明/半透明/哑光/反射等 Surface、Lighting、图形与材料关系、Sensory Character。parts 请使用入口、核心装置、导视/触点等空间部位。"
    : domain === "digital"
      ? "这是数字产品。3 套方案必须形成 Visual System：语义色彩、Typography、层级与间距、组件表面、状态反馈、Motion/Interaction Style。parts 请使用导航、内容层、关键操作、系统状态等界面层，不得强行填写塑料、金属或耐久性。"
      : "这是工业产品。必须区分主体、握持/操作区、清洁或维护区的材料、颜色、表面处理、触感风险与验证方式；颜色变化不能替代材料差异。";
  return `为当前已选概念生成 3 套可验证的材料、颜色与表面处理决策，不生成图片，不输出拼贴图或 Moodboard。${domainRules}\n每个部位都必须说明为什么服务概念、材料和颜色如何区分、触感与清洁风险是什么、验证目标是什么，不能只写高级感。若没有真实工程数据，validation 只能写“建议验证/验证目标”，不能伪造已验证结论。每套方案至少包含 2 个部位、颜色语义、finish、rationale、risk、validation；三套方案必须在材料逻辑或维护策略上真正不同。\n项目：${project.name}\n目标：${industrial.brief.goal}\n概念：${concept.name} / ${concept.conceptStatement}\n核心机制：${concept.coreMechanism}\n关键要求：${industrial.brief.keyNeeds.join("；")}\n设计关键词：${(industrial.brief.keywords ?? []).join("；") || "未提供"}\n避免项：${(industrial.brief.avoid ?? []).join("；") || "未提供"}\n未知边界：${industrial.brief.unknowns.join("；")}`;
}

export function reviewInstruction(project, industrial, direction, concept, cmf) {
  return `请检查以下完整方案，必须逐一输出 9 个维度：brief、evidence、direction、concept、visual、interaction、cmf、feasibility、risk。不要给装饰性总分。每个维度必须包含 finding、evidence、action、severity，证据不足时明确写待验证。当前 Text AI 没有接收图片像素，visual 维度只能检查视觉生成元数据、概念一致性规则与人工待验证项；禁止声称已经看过图片内容。\n项目：${project.name}\nBrief：${industrial.brief.goal}\n方向：${direction.name} / ${direction.hypothesis}\n概念：${concept.name} / ${concept.conceptStatement}\nSelected Visual metadata：${industrial.selectedVisualId || "未选择"}\nCMF：${cmf.name} / ${cmf.summary}\n设计关键词：${(industrial.brief.keywords ?? []).join("；") || "未提供"}\n避免项：${(industrial.brief.avoid ?? []).join("；") || "未提供"}\n关键未知：${industrial.brief.unknowns.join("；")}`;
}

export function versionInstruction(project, industrial, issue, selectedVisual) {
  const evidenceIds = (industrial?.selectedEvidenceIds ?? industrial?.evidence ?? []).map((item) => typeof item === "string" ? item : item.id).filter(Boolean).slice(0, 12);
  const insightIds = (industrial?.selectedInsightIds ?? industrial?.insights ?? []).map((item) => typeof item === "string" ? item : item.id).filter(Boolean).slice(0, 8);
  return `请为已接受的设计评审问题生成一条可追踪的版本说明。只输出版本说明 JSON，不生成图片，不重新设计项目，不增加未被评审要求的变化。必须明确 whatChanged、why、reviewTrigger、retained，并尽量引用现有 evidenceIds 与 insightIds。\n项目：${project.name}\n评审问题：${issue?.title ?? "待确认问题"}\n证据：${issue?.evidence ?? "待补充"}\n影响：${issue?.impact ?? "待补充"}\n采纳动作：${issue?.recommendation ?? "建立下一轮验证版本"}\n当前视觉：${JSON.stringify({ id: selectedVisual?.id, stage: selectedVisual?.stage, variation: selectedVisual?.variation ?? selectedVisual?.variant, visualMode: selectedVisual?.visualMode })}\n可引用 evidenceIds：${JSON.stringify(evidenceIds)}\n可引用 insightIds：${JSON.stringify(insightIds)}`;
}

export function visualBriefInstruction(project, industrial, direction, concept) {
  const domain = buildProjectBrain(project).domain;
  const domainRules = domain === "brand-spatial"
    ? "输出高质量品牌空间与体验触点视觉。保持同一个空间概念、核心装置、行为路径与品牌性格，明确尺度、空间分区、材料、光环境、人物行为、镜头和构图；不要做成海报拼贴。"
    : domain === "digital"
      ? "输出高质量数字产品界面与交互系统视觉。保持同一个信息架构、核心任务、组件系统与视觉语言，明确屏幕状态、交互步骤、排版、语义色彩、组件、设备场景和构图；不要生成无法实现的科幻 HUD。"
      : "输出高质量工业产品设计视觉。保持同一个产品身份与可制造结构，明确主体、真实场景、结构、材料、交互、镜头、光线与构图；不得添加无关零件。";
  return `把已锁定方向与已选概念转译成可直接用于图像生成的 Visual Generation Brief。${domainRules}\n四张图必须共享同一设计身份，不得添加品牌文字、水印或无关装饰。\n项目：${project.name}\n设计目标：${industrial.brief.goal}\n真实场景：${industrial.brief.scenario}\n锁定方向：${direction.name} / ${direction.formLanguage}\n已选概念：${concept.name}\n概念定义：${concept.conceptStatement}\n核心机制：${concept.coreMechanism}\n用户体验：${concept.userExperience}\n产品表达：${concept.productExpression ?? concept.spatialExpression ?? concept.brandExpression ?? "保持与方向一致"}`;
}

export const industrialSchemaHints = {
  overview: { projectName: "string", projectType: ["产品设计"], location: "string|null", timeContext: "string|null", projectSummary: "string", designGoal: "string", coreConflict: { title: "string", explanation: "string" }, targetUser: { primary: "string", traits: ["string"] }, keywords: ["string"], mustKeep: ["string"], mustAvoid: ["string"], deliverables: ["string"], successCriteria: ["string"], openQuestions: ["string"] },
  brief: { goal: "string", targetUser: "string", scenario: "string", keyNeeds: ["string"], unknowns: ["string"], interpretation: "string", keywords: ["string"], avoid: ["string"] },
  research: { evidence: [{ id: "existing-evidence-id", sourceId: "existing-source-id", title: "string", fact: "original fact", interpretation: "string", designImplication: "string", limitation: "string" }] },
  researchPlan: { questionPlans: [{ questionId: "existing-question-id", whyThisMatters: "string", evidenceNeed: "string", querySuggestions: ["string"], preferredSources: ["string"] }], gaps: ["string"], nextActions: ["string"] },
  insight: { insights: [{ id: "string", title: "string", insightStatement: "string", whyItMatters: "string", designImplication: "string", evidenceIds: ["accepted-evidence-id"], evidenceStrength: "strong|medium|preliminary", relatedBriefFields: ["string"] }] },
  direction: { candidates: [{ strategyKey: "string", name: "string", thesis: "string", strategicIdea: "string" }], directions: [{ code: "A|B|C", name: "string", thesis: "string", strategicIdea: "string", userValue: "string", evidenceIds: ["accepted-evidence-id"], insightIds: ["confirmed-insight-id"], brandLogic: "string", culturalLogic: "string", visualLogic: "string", spatialLogic: "string", experienceLogic: "string", interactionLogic: "string", formLogic: "string", materialLogic: "string", advantages: ["string"], tradeoffs: ["string"], risks: ["string"], validationQuestions: ["string"], successSignals: ["string"], mustKeep: ["string"], mustAvoid: ["string"], supportLevel: "supported|partial|preliminary", status: "candidate" }] },
  concept: { concepts: [{ id: "string", name: "string", conceptStatement: "string", coreMechanism: "string", userExperience: "string", whyFitsDirection: "string", brandExpression: "string", spatialExpression: "string", productExpression: "string", digitalExpression: "string", evidenceIds: ["string"], insightIds: ["string"], advantages: ["string"], risks: ["string"], validationQuestions: ["string"] }] },
  visualBrief: { subject: "string", scene: "string", form: "string", materials: "string", interaction: "string", camera: "string", lighting: "string", composition: "string", constraints: ["string"], negativePrompt: "string" },
  cmf: { cmfSchemes: [{ code: "01|02|03", name: "string", summary: "string", parts: [{ part: "string", material: "string", color: "string", finish: "string", rationale: "string", risk: "string", validation: "string" }] }] },
  review: { summary: "string", strengths: [{ title: "string", evidence: "string" }], dimensions: [{ dimension: "brief|evidence|direction|concept|visual|interaction|cmf|feasibility|risk", finding: "string", evidence: "string", action: "string", severity: "low|medium|high" }] },
  version: { changeSummary: "string", whatChanged: "string", why: "string", retained: ["string"], reviewTrigger: "string", evidenceIds: ["string"], insightIds: ["string"] },
};
