import { z } from "zod";

const MAX = {
  projectSummary: 70,
  designGoal: 100,
  conflictTitle: 12,
  conflictExplanation: 90,
  keywords: 6,
  list: 5,
  deliverables: 6,
  successCriteria: 4,
  openQuestions: 3,
  outcomeDefinition: 120,
};

const outcomeCategories = ["Design Output", "Research Output", "Decision Output", "Presentation Output", "Validation Output"];
const originSchema = z.enum(["explicit", "inferred", "suggested"]);
const overviewItemSchema = z.object({ id: z.string().min(1), label: z.string().min(1), origin: originSchema, sourceText: z.string().optional() });
const explicitOutcomeSchema = z.object({ id: z.string().min(1), label: z.string().min(1), category: z.enum(outcomeCategories), sourceText: z.string().optional(), origin: z.literal("explicit") });
const suggestedOutcomeSchema = z.object({ id: z.string().min(1), label: z.string().min(1), category: z.enum(outcomeCategories), rationale: z.string().min(1), accepted: z.boolean(), origin: z.literal("suggested") });

const ProjectOverviewSchema = z.object({
  projectName: z.string().min(1),
  projectType: z.array(z.string().min(1)).min(1).max(4),
  location: z.string().nullable(),
  timeContext: z.string().nullable(),
  projectSummary: z.string().min(1).max(MAX.projectSummary),
  designGoal: z.string().min(1).max(MAX.designGoal),
  coreConflict: z.object({
    title: z.string().min(1).max(MAX.conflictTitle),
    explanation: z.string().min(1).max(MAX.conflictExplanation),
    sideA: z.string().min(1).max(60).optional(),
    sideB: z.string().min(1).max(60).optional(),
    whyConflict: z.string().min(1).max(180).optional(),
    riskIfOverIndexA: z.string().min(1).max(120).optional(),
    riskIfOverIndexB: z.string().min(1).max(120).optional(),
    researchImplication: z.string().min(1).max(200).optional(),
  }),
  targetUser: z.object({
    primary: z.string().min(1),
    traits: z.array(z.string().min(1)).max(4),
  }),
  keywords: z.array(z.string().min(1)).min(1).max(MAX.keywords),
  mustKeep: z.array(z.string().min(1)).max(MAX.list),
  mustAvoid: z.array(z.string().min(1)).max(MAX.list),
  deliverables: z.array(z.string().min(1)).max(MAX.deliverables),
  successCriteria: z.array(z.string().min(1)).max(MAX.successCriteria),
  openQuestions: z.array(z.string().min(1)).max(MAX.openQuestions),
  confidenceNotes: z.array(z.string().min(1)).max(4).optional(),
  designConstants: z.array(overviewItemSchema).max(8).optional(),
  designExclusions: z.array(overviewItemSchema).max(8).optional(),
  expectedOutcomes: z.object({ explicit: z.array(explicitOutcomeSchema).max(12), suggested: z.array(suggestedOutcomeSchema).max(4) }).optional(),
  outcomeDefinition: z.string().min(1).max(MAX.outcomeDefinition).optional(),
});

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function unique(items) {
  const seen = new Set();
  return items.map(clean).filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function clip(value, max, fallback = "待确认") {
  const text = clean(value);
  if (!text) return fallback;
  if ([...text].length <= max) return text;
  return `${[...text].slice(0, Math.max(1, max - 1)).join("")}…`;
}

function firstClause(value, max = 80) {
  return clip(clean(value).split(/[。！？；\n]/)[0], max, "");
}

function listValue(value) {
  if (Array.isArray(value)) return unique(value);
  return unique(String(value ?? "").split(/[、,，;；\n]/));
}

function taggedList(brief, field, label) {
  const direct = listValue(brief?.[field]);
  const tagged = listValue(brief?.constraints)
    .filter((item) => item.startsWith(`${label}：`) || item.startsWith(`${label}:`))
    .flatMap((item) => listValue(item.replace(new RegExp(`^${label}[：:]`), "")));
  return unique([...direct, ...tagged]);
}

function readOriginalBrief(project, sourceBrief) {
  const snapshot = project?.originalBrief;
  const raw = sourceBrief ?? {};
  const rawText = (key, fallback = "") => clean(raw[key]) || clean(snapshot?.[key]) || fallback;
  const rawList = (key) => Array.isArray(raw[key]) && raw[key].length ? listValue(raw[key]) : listValue(snapshot?.[key]);
  return {
    goal: rawText("goal", clean(snapshot?.designGoal || project?.description)),
    audience: rawText("audience"),
    context: rawText("context", clean(raw.background)),
    deliverables: rawList("deliverables"),
    constraints: rawList("constraints"),
    keywords: taggedList({ ...raw, keywords: raw.keywords?.length ? raw.keywords : snapshot?.keywords }, "keywords", "设计关键词"),
    avoid: taggedList({ ...raw, avoid: raw.avoid?.length ? raw.avoid : snapshot?.avoid }, "avoid", "避免项"),
  };
}

function textOf(project, brief, industrial) {
  return [
    project?.name,
    project?.description,
    brief.goal,
    brief.audience,
    brief.context,
    ...brief.deliverables,
    ...brief.constraints,
    ...brief.keywords,
    ...brief.avoid,
    industrial?.brief?.productCategory,
    industrial?.brief?.goal,
    industrial?.brief?.targetUser,
    industrial?.brief?.scenario,
    ...(industrial?.brief?.keyNeeds ?? []),
  ].filter(Boolean).join(" ");
}

function inferCategory(text) {
  if (/茶|茶饮|茶具|茶文化|饮茶/.test(text)) return "茶文化产品与视觉系统";
  if (/空气|睡眠|夜间|灯光|环境|噪声|安静/.test(text)) return "环境体验产品";
  if (/厨房|收纳|清洁|家电|厨|餐/.test(text)) return "家居与厨房产品";
  if (/出行|旅行|携带|户外|通勤/.test(text)) return "便携出行产品";
  if (/婴|母婴|儿童|照护|护理/.test(text)) return "照护产品";
  if (/健康|医疗|康复|运动/.test(text)) return "健康辅助产品";
  if (/品牌|视觉|字体|标志|海报|编辑/.test(text)) return "品牌与视觉系统";
  return "日常使用产品";
}

function inferProjectType(project, text, category) {
  if (project?.productDiscipline === "industrial" || /产品|工业|家电|设备|结构|材料|形态/.test(text)) {
    return ["产品设计", "工业设计"];
  }
  if (category === "品牌与视觉系统") return ["品牌设计", "视觉系统"];
  if (project?.type === "editorial") return ["编辑设计", "视觉系统"];
  if (project?.type === "campaign") return ["传播设计", "品牌设计"];
  return ["体验设计", "视觉系统"];
}

function simplifyProjectName(name) {
  return clean(name).replace(/的设计决策工作台|的工业设计工作流|项目$/, "").trim() || "未命名项目";
}

function inferLocation(text) {
  const match = text.match(/(?:地点|场所|位于|在)([^，。；\s]{2,12}(?:市|区|店|馆|园|家|室内|户外))/);
  return match?.[1] ? clip(match[1], 18, null) : null;
}

function inferTimeContext(text) {
  const match = text.match(/(清晨|早晨|白天|傍晚|夜间|深夜|周末|工作日|通勤|短途出行|日常使用|高频使用|换季|春季|夏季|秋季|冬季)/);
  return match?.[1] ? clip(match[1], 18, null) : null;
}

function inferPrimaryUser(brief, industrial, category) {
  const explicit = brief.audience && !/待补充|未提供|未知|未填写/.test(brief.audience) ? brief.audience : "";
  if (explicit) return clip(explicit, 48);
  const industrialUser = clean(industrial?.brief?.targetUser);
  if (industrialUser && !/待补充|未知/.test(industrialUser)) return clip(industrialUser, 48);
  return `需要长期使用${category}完成日常任务的用户`;
}

function inferTraits(text, primary) {
  const traits = [];
  if (/独自|单人|一只手|受限姿态/.test(`${text} ${primary}`)) traits.push("操作资源受限");
  if (/夜间|睡眠|安静|低打扰/.test(text)) traits.push("对环境打扰敏感");
  if (/清洁|卫生|维护|滤芯|耐污/.test(text)) traits.push("关注清洁与维护");
  if (/携带|出行|通勤|收纳/.test(text)) traits.push("需要移动或收纳");
  if (/儿童|婴|照护|安全/.test(text)) traits.push("关注状态与安全");
  if (!traits.length) traits.push("使用场景需要进一步确认");
  return unique(traits).slice(0, 4);
}

function inferKeywords(brief, industrial, category) {
  const explicit = unique([
    ...brief.keywords,
    ...(industrial?.brief?.keywords ?? []),
  ]).filter((item) => !/^设计关键词[：:]/.test(item));
  const derived = [];
  if (/茶|茶饮|茶具|茶文化/.test(category)) derived.push("文化识别", "当代表达", "日常饮用", "材质秩序");
  if (/工业|产品|家电|设备|厨房|出行|照护/.test(`${category} ${brief.goal}`)) derived.push("操作路径", "结构关系", "长期使用");
  if (/清洁|维护|滤芯/.test(`${brief.context} ${brief.constraints.join(" ")}`)) derived.push("易清洁");
  if (/携带|收纳|出行/.test(textOf({}, brief, industrial))) derived.push("便携收纳");
  return unique([...explicit, ...derived, category]).slice(0, MAX.keywords).map((item) => clip(item, 8));
}

function inferSummary({ brief, category, primary, text }) {
  if (/茶|茶饮|茶具|茶文化/.test(text)) {
    return "把传统茶文化转译成贴近日常使用的产品与视觉系统，在保留文化识别的同时建立当代、克制且可持续的体验。";
  }
  const context = firstClause(brief.context, 26);
  const goal = firstClause(brief.goal, 32);
  return clip(`围绕${primary}在${context || "真实生活场景"}中的使用需求，${goal || `建立一套可被理解、使用和验证的${category}方案`}。`, MAX.projectSummary, "项目目标与场景待确认。");
}

function inferDesignGoal({ brief, category, primary, text, industrial }) {
  const goal = firstClause(brief.goal, 54);
  const need = firstClause(industrial?.brief?.keyNeeds?.[0] || brief.constraints[0], 28);
  if (/茶|茶饮|茶具|茶文化/.test(text)) {
    return "建立一套围绕日常饮茶场景的产品设计语言，在保留文化识别的同时降低使用门槛，并让形态、材质与视觉秩序形成可验证的整体。";
  }
  return clip(`${goal || `为${primary}设计一款${category}`}；优先解决${need || "核心使用任务"}，并把结构、触点与材料决策落到可验证的方案中。`, MAX.designGoal, "先明确目标用户、核心场景与验证边界，再进入具体方案。");
}

function inferConflict({ brief, category, text, industrial }) {
  if (/茶|茶饮|茶具|茶文化/.test(text) || (/传统/.test(text) && /当代|现代/.test(text))) {
    return {
      title: "文化识别 × 当代表达",
      explanation: "既要让用户一眼感到文化来源，又不能停留在传统符号堆叠，需要把识别度转成当代可用的形态、材质与视觉秩序。",
    };
  }
  if (/单手|一只手|抱|照护/.test(text) && /清洁|维护|收纳/.test(text)) {
    return {
      title: "连续操作 × 易维护",
      explanation: "产品要在受限姿态下保持一条连续操作路径，同时让清洁、收纳与复位不被复杂结构打断。",
    };
  }
  if (/安静|夜间|睡眠/.test(text) && /提醒|状态|反馈/.test(text)) {
    return {
      title: "状态可读 × 低打扰",
      explanation: "用户需要快速知道产品状态，但夜间与休息场景不接受高频光声提醒，反馈强度必须服从环境。",
    };
  }
  const need = firstClause(industrial?.brief?.keyNeeds?.[0] || brief.constraints[0], 28);
  return {
    title: category === "日常使用产品" ? "功能完整 × 操作克制" : "核心任务 × 长期使用",
    explanation: `方案需要回应${need || "核心使用任务"}，又不能用更多功能和复杂结构增加学习、维护或长期使用成本。`,
  };
}

function inferMustKeep(brief, industrial, text) {
  const explicit = brief.constraints.filter((item) => !/^设计关键词[：:]/.test(item) && !/^避免项[：:]/.test(item));
  const needs = industrial?.brief?.keyNeeds ?? [];
  const rows = [...explicit, ...needs].filter((item) => !/暂无额外限制|待补充|待确认|待.*验证|未知/.test(item));
  if (rows.length) return unique(rows).slice(0, MAX.list).map((item) => clip(item, 46));
  if (/茶|茶饮|茶具|茶文化/.test(text)) return ["文化来源可被识别", "日常使用门槛低", "形态与材质保持一致"];
  return ["核心使用场景", "可追溯的设计判断", "可验证的产品路径"];
}

function inferMustAvoid(brief) {
  return unique(brief.avoid)
    .filter((item) => !/待补充|未知|暂无/.test(item))
    .slice(0, MAX.list)
    .map((item) => clip(item, 46));
}

function inferDeliverables(brief, project) {
  const rows = unique([...brief.deliverables, ...(project?.outputTypes ?? [])])
    .filter((item) => !/digital_experience|brand_identity|poster|social_media|packaging/.test(item));
  return rows.length ? rows.slice(0, MAX.deliverables).map((item) => clip(item, 36)) : ["项目简报", "研究证据", "设计方向", "产品概念", "材料与色彩", "设计评审"];
}

function outcomeCategory(label) {
  if (/研究|访谈|观察|证据|竞品/.test(label)) return "Research Output";
  if (/方向|决策|比较|规则|策略/.test(label)) return "Decision Output";
  if (/验证|测试|评审|指标|样机/.test(label)) return "Validation Output";
  if (/海报|社交|传播|展示|提案|演示/.test(label)) return "Presentation Output";
  return "Design Output";
}

function makeOverviewItem(project, kind, index, label, origin = "inferred", sourceText) {
  return { id: `${project?.id ?? "project"}-overview-${kind}-${String(index + 1).padStart(2, "0")}`, label: clip(label, 70), origin, ...(sourceText ? { sourceText: clip(sourceText, 160) } : {}) };
}

function inferExpectedOutcomes(brief, project, text) {
  const explicit = inferDeliverables(brief, project).map((label, index) => ({
    id: `${project?.id ?? "project"}-overview-outcome-${String(index + 1).padStart(2, "0")}`,
    label,
    category: outcomeCategory(label),
    sourceText: label,
    origin: "explicit",
  }));
  const existing = new Set(explicit.map((item) => item.label));
  const suggested = [];
  const add = (label, category, rationale) => {
    if (existing.has(label) || suggested.some((item) => item.label === label)) return;
    suggested.push({ id: `${project?.id ?? "project"}-overview-suggestion-${String(suggested.length + 1).padStart(2, "0")}`, label, category, rationale, accepted: false, origin: "suggested" });
  };
  const brand = /品牌|视觉|标志|传播|茶文化|茶饮|新消费/.test(text);
  const spatial = /空间|快闪|入口|门店|商业区域|线下/.test(text);
  const uiux = /app|应用|界面|交互|信息架构|可用性/i.test(text);
  if (brand && spatial) {
    add("品牌—空间视觉系统规则", "Decision Output", "项目同时包含品牌与空间触点，需要把视觉、材质、图形和空间语言统一为可复用的系统。");
    if (!explicit.some((item) => /方向|创意|概念/.test(item.label))) add("创意方向比较板", "Decision Output", "保留不同方向及最终选择依据，避免只留下一个无法回溯的最终效果。");
    add("核心体验路径", "Research Output", "快闪项目不仅需要视觉表达，还需要说明用户进入、停留、选择和离开的体验变化。");
  } else if (uiux) {
    if (!explicit.some((item) => /流程|原型|交互/.test(item.label))) add("核心任务流程原型", "Design Output", "用可操作的流程承接信息结构与交互判断，便于在研究后验证任务是否成立。");
    add("可用性验证记录", "Validation Output", "保留关键任务与失败状态的验证结果，让后续迭代有据可循。");
  } else if (/工业|产品|设备|家电|结构|材料/.test(text)) {
    if (!explicit.some((item) => /概念|造型|产品/.test(item.label))) add("产品概念与形态决策", "Design Output", "将核心问题转译为可比较的产品形态，避免研究与后续方案脱节。");
    if (!explicit.some((item) => /验证|测试|评审/.test(item.label))) add("关键使用路径验证记录", "Validation Output", "保留核心场景中的验证方法与结果，使产品判断能够回到证据。");
  } else {
    add("设计判断与验证记录", "Validation Output", "保留从问题到方案的判断依据，让项目结果可以被解释和复盘。");
  }
  return { explicit: explicit.slice(0, 12), suggested: suggested.slice(0, 4) };
}

function inferDesignConstants(brief, industrial, text, project) {
  const explicit = unique([
    ...brief.constraints,
    ...(industrial?.brief?.keyNeeds ?? []),
  ]).filter((item) => !/^设计关键词[：:]/.test(item) && !/^避免项[：:]/.test(item) && !/待补充|待确认|未知|暂无/.test(item));
  const rows = explicit.slice(0, MAX.list).map((item, index) => makeOverviewItem(project, "constant", index, item, "explicit", item));
  if (rows.length) return rows;
  return [makeOverviewItem(project, "constant", 0, /茶|茶饮|茶文化/.test(text) ? "中国茶文化来源" : "核心使用场景", "inferred")];
}

function inferDesignExclusions(brief, project) {
  return unique(brief.avoid).filter((item) => !/待补充|未知|暂无/.test(item)).slice(0, MAX.list).map((item, index) => makeOverviewItem(project, "exclusion", index, item, "explicit", item));
}

function inferOutcomeDefinition({ project, text, primary }) {
  if (/茶|茶饮|茶文化/.test(text)) return "项目应形成一套由明确设计逻辑驱动的产品与视觉系统，能够解释其与目标用户、日常使用和中国茶文化来源之间的关系。";
  if (/品牌|空间|快闪|传播/.test(text)) return "项目应形成一套可被解释、延展并验证的品牌与体验系统，关键触点共享同一设计逻辑，并能回应目标用户的真实场景。";
  if (/app|应用|界面|交互/i.test(text)) return "项目应形成一条可被目标用户理解和完成的核心任务路径，并能用研究证据解释信息、反馈与交互取舍。";
  return `项目应形成一套围绕${primary || "目标用户"}与真实场景展开的完整设计结果，关键形态、触点与判断能够被解释、验证并进入后续决策。`;
}

function inferSuccessCriteria({ text }) {
  const rows = [];
  if (/单手|一只手|连续|路径|操作/.test(text)) rows.push("核心路径可连续完成，关键操作不依赖额外协助");
  if (/清洁|维护|滤芯|耐污/.test(text)) rows.push("高频接触与维护区域可达、可清洁且能被正确复位");
  if (/夜间|睡眠|安静/.test(text)) rows.push("状态反馈可读，但不会在目标场景中造成明显打扰");
  if (/茶|茶饮|茶具|茶文化/.test(text)) rows.push("文化识别、日常可用性与材料秩序能够被同一方案解释");
  if (!rows.length) rows.push("方案能被目标用户理解并在真实场景中完成核心任务");
  return unique(rows).slice(0, MAX.successCriteria).map((item) => clip(item, 58));
}

function inferOpenQuestions({ brief, text, industrial }) {
  const questions = [];
  if (!brief.audience || /待补充|未知|未填写/.test(brief.audience)) questions.push("目标用户的具体特征和优先级是否需要进一步确认？");
  if (!brief.context || /待补充|未知|未填写/.test(brief.context)) questions.push("产品最常出现的地点、频率和触发时刻是什么？");
  if (!brief.constraints.length || brief.constraints.every((item) => /暂无额外限制/.test(item))) questions.push("是否存在尚未提供的尺寸、成本、材料或时间约束？");
  questions.push(...brief.constraints.filter((item) => /待补充|待确认|待.*验证|未知/.test(item)).map((item) => `待确认：${item}`));
  questions.push(...(industrial?.brief?.unknowns ?? []).map((item) => `待确认：${item}`));
  if (/茶|茶饮|茶具|茶文化/.test(text) && !/用户|受众|消费者/.test(brief.audience)) questions.push("文化识别更应服务哪类饮茶人群和使用习惯？");
  return unique(questions).slice(0, MAX.openQuestions);
}

function normalize(value) {
  const constants = Array.isArray(value.designConstants) ? value.designConstants : unique(value.mustKeep).map((label, index) => ({ id: `overview-constant-${index + 1}`, label, origin: "inferred" }));
  const exclusions = Array.isArray(value.designExclusions) ? value.designExclusions : unique(value.mustAvoid).map((label, index) => ({ id: `overview-exclusion-${index + 1}`, label, origin: "explicit" }));
  const expectedOutcomes = value.expectedOutcomes ?? {
    explicit: unique(value.deliverables).map((label, index) => ({ id: `overview-outcome-${index + 1}`, label, category: outcomeCategory(label), sourceText: label, origin: "explicit" })),
    suggested: [],
  };
  const next = {
    projectName: clip(value.projectName, 60, "未命名项目"),
    projectType: unique(value.projectType).slice(0, 4),
    location: value.location ? clip(value.location, 18, null) : null,
    timeContext: value.timeContext ? clip(value.timeContext, 18, null) : null,
    projectSummary: clip(value.projectSummary, MAX.projectSummary, "项目目标与场景待确认。"),
    designGoal: clip(value.designGoal, MAX.designGoal, "先明确目标用户、核心场景与验证边界，再进入具体方案。"),
    coreConflict: {
      title: clip(value.coreConflict?.title, MAX.conflictTitle, "核心任务 × 长期使用"),
      explanation: clip(value.coreConflict?.explanation, MAX.conflictExplanation, "方案需要回应核心使用任务，又不能用复杂结构增加长期使用成本。"),
      ...(value.coreConflict?.sideA ? { sideA: clip(value.coreConflict.sideA, 60) } : {}),
      ...(value.coreConflict?.sideB ? { sideB: clip(value.coreConflict.sideB, 60) } : {}),
      ...(value.coreConflict?.whyConflict ? { whyConflict: clip(value.coreConflict.whyConflict, 180) } : {}),
      ...(value.coreConflict?.riskIfOverIndexA ? { riskIfOverIndexA: clip(value.coreConflict.riskIfOverIndexA, 120) } : {}),
      ...(value.coreConflict?.riskIfOverIndexB ? { riskIfOverIndexB: clip(value.coreConflict.riskIfOverIndexB, 120) } : {}),
      ...(value.coreConflict?.researchImplication ? { researchImplication: clip(value.coreConflict.researchImplication, 200) } : {}),
    },
    targetUser: {
      primary: clip(value.targetUser?.primary, 48, "目标用户待确认"),
      traits: unique(value.targetUser?.traits).slice(0, 4),
    },
    keywords: unique(value.keywords).slice(0, MAX.keywords),
    mustKeep: unique(value.mustKeep).slice(0, MAX.list),
    mustAvoid: unique(value.mustAvoid).slice(0, MAX.list),
    deliverables: unique(value.deliverables).slice(0, MAX.deliverables),
    successCriteria: unique(value.successCriteria).slice(0, MAX.successCriteria),
    openQuestions: unique(value.openQuestions).slice(0, MAX.openQuestions),
    designConstants: constants.map((item, index) => ({ id: clean(item.id) || `overview-constant-${index + 1}`, label: clip(item.label ?? item, 70), origin: ["explicit", "inferred", "suggested"].includes(item.origin) ? item.origin : "inferred", ...(item.sourceText ? { sourceText: clip(item.sourceText, 160) } : {}) })).slice(0, 8),
    designExclusions: exclusions.map((item, index) => ({ id: clean(item.id) || `overview-exclusion-${index + 1}`, label: clip(item.label ?? item, 70), origin: ["explicit", "inferred", "suggested"].includes(item.origin) ? item.origin : "explicit", ...(item.sourceText ? { sourceText: clip(item.sourceText, 160) } : {}) })).slice(0, 8),
    expectedOutcomes: {
      explicit: unique(expectedOutcomes.explicit?.map((item) => item.label ?? item)).slice(0, 12).map((label, index) => ({ id: clean(expectedOutcomes.explicit?.[index]?.id) || `overview-outcome-${index + 1}`, label, category: outcomeCategory(label), sourceText: clean(expectedOutcomes.explicit?.[index]?.sourceText) || label, origin: "explicit" })),
      suggested: (expectedOutcomes.suggested ?? []).map((item, index) => ({ id: clean(item.id) || `overview-suggestion-${index + 1}`, label: clip(item.label, 70), category: outcomeCategories.includes(item.category) ? item.category : "Design Output", rationale: clip(item.rationale, 140), accepted: Boolean(item.accepted), origin: "suggested" })).slice(0, 4),
    },
    outcomeDefinition: clip(value.outcomeDefinition, MAX.outcomeDefinition, "项目应形成一套围绕目标用户与真实场景展开的完整设计结果，关键判断能够被解释、验证并进入后续决策。"),
  };
  if (value.confidenceNotes?.length) next.confidenceNotes = unique(value.confidenceNotes).slice(0, 4);
  return next;
}

export function validateProjectOverview(value) {
  const result = ProjectOverviewSchema.safeParse(normalize(value));
  return result.success ? result.data : normalize(value);
}

export function createOriginalBriefSnapshot({ project, sourceBrief }) {
  const brief = readOriginalBrief(project, sourceBrief);
  return {
    schemaVersion: 1,
    projectName: clean(project?.name),
    designGoal: brief.goal,
    audience: brief.audience,
    context: brief.context,
    deliverables: brief.deliverables,
    constraints: brief.constraints.filter((item) => !/^设计关键词[：:]/.test(item) && !/^避免项[：:]/.test(item)),
    keywords: brief.keywords,
    avoid: brief.avoid,
  };
}

export function createProjectOverview({ project, sourceBrief, industrial }) {
  const brief = readOriginalBrief(project, sourceBrief);
  const text = textOf(project, brief, industrial);
  const category = inferCategory(text);
  const primary = inferPrimaryUser(brief, industrial, category);
  const overview = {
    projectName: simplifyProjectName(project?.name),
    projectType: inferProjectType(project, text, category),
    location: inferLocation(text),
    timeContext: inferTimeContext(text),
    projectSummary: inferSummary({ brief, category, primary, text }),
    designGoal: inferDesignGoal({ brief, category, primary, text, industrial }),
    coreConflict: inferConflict({ brief, category, text, industrial }),
    targetUser: { primary, traits: inferTraits(text, primary) },
    keywords: inferKeywords(brief, industrial, category),
    mustKeep: inferMustKeep(brief, industrial, text),
    mustAvoid: inferMustAvoid(brief),
    deliverables: inferDeliverables(brief, project),
    successCriteria: inferSuccessCriteria({ text }),
    openQuestions: inferOpenQuestions({ brief, text, industrial }),
    designConstants: inferDesignConstants(brief, industrial, text, project),
    designExclusions: inferDesignExclusions(brief, project),
    expectedOutcomes: inferExpectedOutcomes(brief, project, text),
    outcomeDefinition: inferOutcomeDefinition({ project, text, primary }),
    confidenceNotes: [
      ...(!brief.audience || /待补充|未知|未填写/.test(brief.audience) ? ["目标用户来自项目类型与场景推断，仍需人工确认。"] : []),
      ...(!brief.context || /待补充|未知|未填写/.test(brief.context) ? ["地点、频率或时间上下文未在原始需求中提供。"] : []),
    ].slice(0, 4),
  };
  return validateProjectOverview(overview);
}

export { ProjectOverviewSchema };
