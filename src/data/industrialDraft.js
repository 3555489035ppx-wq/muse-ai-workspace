const clean = (value, fallback = "") => String(value ?? "").trim() || fallback;

const unique = (items) => [...new Set(items.filter(Boolean))];

const makeId = (projectId, kind, index) => `${projectId}-${kind}-${String(index + 1).padStart(2, "0")}`;

function taggedValues(brief, field, label) {
  if (Array.isArray(brief?.[field]) && brief[field].length) return [...brief[field]];
  const prefix = `${label}：`;
  return (Array.isArray(brief?.constraints) ? brief.constraints : [])
    .filter((item) => String(item).startsWith(prefix))
    .flatMap((item) => String(item).slice(prefix.length).split(/[、,，]/).map((value) => value.trim()).filter(Boolean));
}

function projectText(project, brief) {
  return [
    project?.name,
    project?.description,
    brief?.goal,
    brief?.context,
    brief?.audience,
    ...(Array.isArray(brief?.constraints) ? brief.constraints : []),
    ...(Array.isArray(brief?.keywords) ? brief.keywords : []),
    ...(Array.isArray(brief?.avoid) ? brief.avoid : []),
  ]
    .filter(Boolean)
    .join(" ");
}

function inferProductCategory(text) {
  if (/空气|睡眠|夜间|灯光|环境|噪声|安静/.test(text)) return "环境体验产品";
  if (/厨房|收纳|清洁|家电|厨|餐/.test(text)) return "家居与厨房产品";
  if (/出行|旅行|携带|户外|通勤/.test(text)) return "便携出行产品";
  if (/婴|母婴|儿童|照护|护理/.test(text)) return "照护产品";
  if (/健康|医疗|康复|运动/.test(text)) return "健康辅助产品";
  return "日常使用产品";
}

function inferTargetUser(text, category) {
  const described = text.match(/(?:为|面向)([^。；，,]{2,28}?)(?:设计|打造|提供)/)?.[1]?.trim();
  if (described) return described;
  if (category === "环境体验产品") return "需要安静、低打扰环境体验的居家用户";
  if (category === "家居与厨房产品") return "需要高频完成家务任务的家庭用户";
  if (category === "便携出行产品") return "需要在不同地点稳定使用产品的移动用户";
  return `需要长期使用${category}完成日常任务的用户`;
}

function inferNeeds(text, category) {
  const needs = [];
  if (/单手|一只手|抱|照护|移动/.test(text)) needs.push("核心任务应能在受限姿态下连续完成");
  if (/清洁|卫生|维护|拆洗|滤芯/.test(text)) needs.push("高频接触区域需要可见、可达、可清洁");
  if (/收纳|折叠|携带|便携|出行/.test(text)) needs.push("收纳、展开与再次使用之间要保持同一条操作路径");
  if (/安静|夜间|睡眠|环境/.test(text)) needs.push("反馈需要克制，不能用高频视觉或声音打断场景");
  if (/安全|儿童|婴|健康/.test(text)) needs.push("关键状态和风险边界必须能被快速理解");
  return unique([...needs, `${category}的形态、结构与材料需要共同服务于真实使用场景`]).slice(0, 5);
}

function inferUnknowns(text) {
  const unknowns = [
    "关键操作在真实姿态下的连续完成率仍需样机验证",
    "高频接触区域的材料耐久、清洁方式与表面变化需要测试",
  ];
  if (/移动|携带|出行|折叠/.test(text)) unknowns.push("不同放置面、移动过程中的稳定性与受力边界");
  if (/夜间|睡眠|灯|空气/.test(text)) unknowns.push("不同光照和环境噪声下的状态可读性");
  return unknowns;
}

function createBrief({ project, sourceBrief }) {
  const text = projectText(project, sourceBrief);
  const category = inferProductCategory(text);
  const explicitAudience = clean(sourceBrief?.audience, "");
  const targetUser = explicitAudience && !/待补充|未知|未填写/.test(explicitAudience)
    ? explicitAudience
    : inferTargetUser(text, category);
  const rawContext = clean(sourceBrief?.context, "");
  const focus = rawContext.match(/重点验证([^。；]+)/)?.[1]?.trim();
  const scenario = focus
    ? `${targetUser}在真实居家环境中完成${focus}`
    : clean(rawContext, `用户在真实生活场景中使用${category}完成核心任务`);
  const goal = clean(sourceBrief?.goal, clean(project?.description, `为${targetUser}设计一款可被长期使用的${category}`));
  const keywords = taggedValues(sourceBrief, "keywords", "设计关键词");
  const avoid = taggedValues(sourceBrief, "avoid", "避免项");
  const keyNeeds = unique([
    ...inferNeeds(text, category),
    ...(Array.isArray(sourceBrief?.constraints) ? sourceBrief.constraints : []),
  ]).slice(0, 6);
  return {
    goal,
    targetUser,
    scenario,
    keyNeeds,
    unknowns: inferUnknowns(text),
    deliverables: Array.isArray(sourceBrief?.deliverables) && sourceBrief.deliverables.length
      ? [...sourceBrief.deliverables]
      : ["用户研究证据", "三条产品设计方向", "产品概念与 CMF 方案", "可验证的设计评审"],
    constraints: Array.isArray(sourceBrief?.constraints) && sourceBrief.constraints.length
      ? [...sourceBrief.constraints]
      : ["保持来源可追溯", "先验证核心任务，再扩展外观与量产细节"],
    keywords,
    avoid,
    interpretation: `把“${goal}”转译成可观察的使用行为、结构关系和材料决策，而不是只生成一张好看的效果图。`,
    productCategory: category,
  };
}

function createEvidence(projectId, brief) {
  const base = [
    ["场景观察", `用户在${brief.scenario}中先处理最直接的任务，通常不会主动寻找复杂设置。`, "观察记录 / 场景访谈"],
    ["操作路径", `围绕“${brief.keyNeeds[0]}”的连续动作比单个功能数量更能决定产品是否被长期使用。`, "任务拆解 / 使用流程"],
    ["维护记录", `当清洁、收纳或维护被拆成多个不连续步骤时，用户会把任务推迟，产品价值随之下降。`, "维护任务 / 竞品观察"],
    ["空间关系", `产品需要和周围环境共存，${brief.productCategory}的边界、可达性与放置稳定性必须在形态中被读懂。`, "环境观察 / 尺寸记录"],
    ["材料触点", "用户对可靠性的判断来自握持、接触、清洁和复位等重复触点，而不只来自颜色和外观。", "触点分析 / 材料样本"],
  ];
  return base.map(([type, excerpt, source], index) => ({
    id: makeId(projectId, "evidence", index),
    type,
    title: `${type}：${brief.productCategory}的真实使用边界`,
    excerpt,
    meaning: `设计机会：让${brief.keyNeeds[index % brief.keyNeeds.length]}成为可被观察、可被验证的产品判断。`,
    source,
    credibility: index < 2 ? "已记录" : "待验证",
    image: null,
  }));
}

function createInsights(projectId, brief, evidence) {
  const rows = [
    ["先让核心路径被看懂，再增加功能", "复杂功能不能弥补用户在第一步就不知道如何开始的问题。"],
    ["结构关系要替用户记忆一部分流程", "当开合、取放、复位或清洁路径与形态一致时，学习成本会下降。"],
    ["维护必须成为产品体验的一部分", "把最容易被推迟的维护动作变成短路径，才能让长期效果成立。"],
    ["材料差异应该对应不同的接触与风险", "主结构、握持区、清洁区和状态区不应只靠换颜色区分。"],
    ["反馈强度要服从使用场景", "不同生活场景需要不同的光、声和触觉反馈边界，产品不应以高频提示打断用户。"],
  ];
  return rows.map(([statement, rationale], index) => ({
    id: makeId(projectId, "insight", index),
    statement,
    rationale: `${rationale} 当前项目“${brief.goal}”需要把它落实到${brief.keyNeeds[index % brief.keyNeeds.length]}。`,
    opportunity: `围绕${brief.productCategory}建立一条可复现的${["开始", "操作", "维护", "触点", "反馈"][index]}路径。`,
    sourceEvidenceIds: [evidence[index % evidence.length].id, evidence[(index + 1) % evidence.length].id],
    image: null,
  }));
}

function createDirections(projectId, brief) {
  const directions = [
    {
      code: "A",
      name: "安静融入",
      subtitle: "让产品成为环境的一部分",
      formLanguage: "低干扰比例、柔和边界、连续的触点和隐藏式状态反馈",
      keywords: ["低干扰", "环境融合", "长期使用"],
      opportunity: "把产品从一个需要被管理的设备，转成场景中自然存在的工具。",
      hypothesis: `当${brief.productCategory}的状态被放进环境语言里，用户会更愿意长期保留它。`,
      tradeoff: "牺牲部分即时信息密度，换取更稳定的日常陪伴感。",
      validationMetric: "连续使用天数、状态误读率、场景打扰评分",
      cmf: "低饱和主体 + 柔和触点 + 可维护的哑光表面",
    },
    {
      code: "B",
      name: "路径显性",
      subtitle: "把每一次操作都变成可读的结构",
      formLanguage: "明确的分区、可追踪的开合路径、带方向性的握持和取放关系",
      keywords: ["可读结构", "连续操作", "快速理解"],
      opportunity: "把用户需要记忆的步骤转译成产品结构，让第一次使用也能快速完成。",
      hypothesis: `当${brief.keyNeeds[0]}被写进形态与动线上，产品能降低学习与错误成本。`,
      tradeoff: "视觉层级更明确，但需要更严格地控制部件数量和外露关系。",
      validationMetric: "首次任务完成时间、错误次数、操作路径中断率",
      cmf: "主体与操作区分色 + 防滑触点 + 清晰的边界线",
    },
    {
      code: "C",
      name: "模块可维护",
      subtitle: "让维护、替换和扩展成为同一套系统",
      formLanguage: "可拆分模块、独立维护面、可替换部件和清晰的状态窗口",
      keywords: ["模块化", "可维护", "可扩展"],
      opportunity: "把后续维护成本前置到结构设计里，延长产品生命周期。",
      hypothesis: `当${brief.unknowns[1]}能够被独立验证，用户会更信任产品的长期可靠性。`,
      tradeoff: "可维护性提高，但结构接口、密封和装配公差需要更多工程验证。",
      validationMetric: "拆装时间、误装率、清洁完成率、部件寿命",
      cmf: "耐污主体 + 高接触区弹性材料 + 可识别的维护件",
    },
  ];
  return directions.map((item, index) => ({ ...item, id: makeId(projectId, "direction", index), image: null }));
}

function createConcepts(projectId, brief, directions) {
  return directions.flatMap((direction, directionIndex) => [
    {
      directionId: direction.id,
      code: "01",
      name: `${direction.name} · 主路径原型`,
      conceptStatement: `用最少的部件回应“${brief.keyNeeds[directionIndex % brief.keyNeeds.length]}”，先验证核心结构和动作。`,
      coreMechanism: "用单一主动作串联开始、执行、结束与复位，减少并行控制。",
      userExperience: "识别主触点后完成核心任务，再确认状态并回到稳定的复位状态。",
      whyFitsDirection: `它把${direction.name}的核心规则落实到一条连续、可验证的操作路径中。`,
      productExpression: "主体结构围绕主路径组织，操作区与维护区保持清晰边界。",
      evidenceIds: direction.evidenceIds ?? [],
      insightIds: direction.insightIds ?? [],
      advantages: ["任务路径短，形态语言与方向一致"],
      risks: ["需要通过 1:1 样机验证握持、开合和受力边界"],
      validationQuestions: ["用户能否在不换手的情况下完成核心任务？"],
    },
    {
      directionId: direction.id,
      code: "02",
      name: `${direction.name} · 场景适配版`,
      conceptStatement: `把${brief.scenario}中的空间、光线和周边物品纳入产品形态，减少额外布置。`,
      coreMechanism: "通过场景接触面与状态反馈共同确定产品的放置和取用方式。",
      userExperience: "在真实场景中发现产品，按情境完成取用，再回到稳定的场景状态。",
      whyFitsDirection: `它让${direction.name}不只停留在造型语言，而是由真实空间关系决定产品的放置和取用。`,
      spatialExpression: "比例、朝向和反馈强度由真实空间关系决定，而不是独立造型。",
      evidenceIds: direction.evidenceIds ?? [],
      insightIds: direction.insightIds ?? [],
      advantages: ["更贴近真实场景，产品与环境关系清楚"],
      risks: ["外形适配范围变大，可能增加结构复杂度"],
      validationQuestions: ["不同空间与光线下，用户能否快速理解放置和取用关系？"],
    },
    {
      directionId: direction.id,
      code: "03",
      name: `${direction.name} · 维护优先版`,
      conceptStatement: `将${brief.unknowns[1]}前置到结构中，让清洁、替换或复位成为可理解的动作。`,
      coreMechanism: "以独立维护模块、明确拆装方向和状态锁止建立可复现维护路径。",
      userExperience: "识别维护时机，无工具拆出维护件，完成处理并防错复位。",
      whyFitsDirection: `它把${direction.name}的长期使用承诺前置为可重复、可验证的维护路径。`,
      productExpression: "可拆件、主结构与高接触区在视觉和触觉上可辨但仍属于同一系统。",
      evidenceIds: direction.evidenceIds ?? [],
      insightIds: direction.insightIds ?? [],
      advantages: ["长期使用逻辑完整，便于进入工程验证"],
      risks: ["可拆分接口和材料边界需要更多耐久测试"],
      validationQuestions: ["用户能否识别维护时机并在无工具情况下完成防错复位？"],
    },
  ].map((item, conceptIndex) => ({
    ...item,
    id: makeId(projectId, `concept-${directionIndex + 1}`, conceptIndex),
    image: null,
    imageSource: "not-generated",
  })));
}

function createCmfSchemes(projectId, brief, concepts) {
  const materials = [
    ["PC+ABS", "雾灰", "细纹哑光", "降低反光，方便观察污渍与擦拭边界"],
    ["TPE", "深色", "柔触防滑", "用于高频握持与受力区域，提升稳定性"],
    ["PC / 透明件", "低饱和强调色", "半透明或细磨砂", "只承担状态提示，不替代结构关系"],
  ];
  return concepts.flatMap((concept, conceptIndex) => [
    {
      conceptId: concept.id,
      code: "01",
      name: "克制耐用",
      summary: `面向${brief.productCategory}高频使用的低干扰方案，重点验证清洁、握持与长期耐久。`,
      parts: [
        { part: "主体", material: materials[0][0], color: materials[0][1], finish: materials[0][2], rationale: materials[0][3], validationState: "TO_BE_VALIDATED" },
        { part: "操作触点", material: materials[1][0], color: materials[1][1], finish: materials[1][2], rationale: materials[1][3], validationState: "TO_BE_VALIDATED" },
      ],
    },
    {
      conceptId: concept.id,
      code: "02",
      name: "路径强调",
      summary: "用有限的颜色和材料差异帮助用户读懂取放、开合与复位关系。",
      parts: [
        { part: "主体", material: "ABS", color: "暖白 / 石墨", finish: "微纹理", rationale: "保持主体稳定，避免视觉噪声", validationState: "AI_RECOMMENDATION" },
        { part: "路径边界", material: "PC", color: "方向强调色", finish: "半透明", rationale: "让关键动作有可见边界", validationState: "TO_BE_VALIDATED" },
      ],
    },
    {
      conceptId: concept.id,
      code: "03",
      name: "模块区分",
      summary: "为主体、维护模块和高接触区建立不同的触感与可替换策略。",
      parts: [
        { part: "主体", material: "再生 PC", color: "中性灰", finish: "低光泽", rationale: "表达可持续与耐用的长期价值", validationState: "TO_BE_VALIDATED" },
        { part: "维护模块", material: "PP", color: "深灰", finish: "可擦洗纹理", rationale: "把需要频繁处理的部件从主体中读出来", validationState: "TO_BE_VALIDATED" },
      ],
    },
  ].map((item, schemeIndex) => ({ ...item, id: makeId(projectId, `cmf-${conceptIndex + 1}`, schemeIndex), image: null, crop: schemeIndex })));
}

export function createIndustrialDraftState({ project, sourceBrief }) {
  const brief = createBrief({ project, sourceBrief });
  const evidence = createEvidence(project.id, brief);
  const insights = createInsights(project.id, brief, evidence);
  const directions = createDirections(project.id, brief);
  const concepts = createConcepts(project.id, brief, directions);
  const cmfSchemes = createCmfSchemes(project.id, brief, concepts);
  return {
    schemaVersion: 1,
    prototypeMode: "local-draft",
    ai: { mode: "local", lastOperation: null, lastRunId: null, lastModel: null, updatedAt: null },
    currentStage: "brief",
    briefConfirmed: false,
    selectedInsightIds: [],
    selectedDirectionId: null,
    directionLocked: false,
    selectedConceptId: null,
    selectedVisualId: null,
    selectedCMFId: null,
    currentReviewId: null,
    currentVersionId: null,
    completedStages: [],
    decisions: [],
    brief,
    evidence,
    insights,
    directions,
    conceptCandidates: concepts,
    generatedVisuals: [],
    cmfSchemes,
    reviews: [],
    versionStory: [],
  };
}

function arrayFrom(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function stringList(value) {
  return Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean) : [];
}

/** Canonical ProductConcept mapper used when loading older local projects. */
export function canonicalizeConceptCandidate(value, index = 0, directionId = null, fallback = null) {
  const row = value && typeof value === "object" ? value : {};
  const userExperience = clean(row.userExperience ?? row.formAndInteraction, stringList(row.userFlow).join(" → "));
  const coreMechanism = clean(row.coreMechanism, fallback?.coreMechanism ?? "待补充核心机制");
  return {
    id: clean(row.id, fallback?.id ?? `${directionId ?? "concept"}-candidate-${index + 1}`),
    directionId: clean(row.directionId, directionId ?? fallback?.directionId ?? ""),
    code: clean(row.code, fallback?.code ?? String(index + 1).padStart(2, "0")),
    name: clean(row.name ?? row.title, fallback?.name ?? `产品概念 ${index + 1}`),
    conceptStatement: clean(row.conceptStatement ?? row.productDefinition ?? row.intent, fallback?.conceptStatement ?? "待补充概念陈述"),
    coreMechanism,
    userExperience,
    whyFitsDirection: clean(row.whyFitsDirection ?? row.intent ?? row.productDefinition, fallback?.whyFitsDirection ?? "待补充方向匹配理由"),
    brandExpression: clean(row.brandExpression, fallback?.brandExpression ?? "") || undefined,
    spatialExpression: clean(row.spatialExpression, fallback?.spatialExpression ?? "") || undefined,
    productExpression: clean(row.productExpression ?? row.formAndInteraction, fallback?.productExpression ?? "") || undefined,
    digitalExpression: clean(row.digitalExpression, fallback?.digitalExpression ?? "") || undefined,
    evidenceIds: stringList(row.evidenceIds).length ? stringList(row.evidenceIds) : [...(fallback?.evidenceIds ?? [])],
    insightIds: stringList(row.insightIds).length ? stringList(row.insightIds) : [...(fallback?.insightIds ?? [])],
    advantages: stringList(row.advantages).length ? stringList(row.advantages) : [clean(row.strength, fallback?.advantages?.[0] ?? "待补充优势")],
    risks: stringList(row.risks).length ? stringList(row.risks) : [clean(row.risk, fallback?.risks?.[0] ?? "待补充风险")],
    validationQuestions: stringList(row.validationQuestions ?? row.validation).length
      ? stringList(row.validationQuestions ?? row.validation)
      : [...(fallback?.validationQuestions ?? [`如何在真实使用中验证：${coreMechanism}`])],
    image: row.image ?? fallback?.image ?? null,
    imageSource: clean(row.imageSource, fallback?.imageSource ?? "not-generated"),
    contentOrigin: clean(row.contentOrigin, fallback?.contentOrigin ?? "user"),
    imageRunId: row.imageRunId ?? fallback?.imageRunId,
    status: clean(row.status, fallback?.status ?? "candidate"),
  };
}

export function migrateIndustrialConceptCandidates(industrial) {
  if (!industrial) return [];
  // Keep one canonical internal collection. A legacy `concepts` collection is
  // only preferred when it carries a traceable live image that the old
  // canonical collection has not migrated yet; otherwise it is a one-time
  // compatibility fallback and is discarded after hydration.
  const canonical = Array.isArray(industrial.conceptCandidates) ? industrial.conceptCandidates : [];
  const legacy = Array.isArray(industrial.concepts) ? industrial.concepts : [];
  const canonicalHasLiveVisual = canonical.some((item) => item?.contentOrigin === "real_ai" || ["live-ai", "live-ai-edit"].includes(item?.imageSource));
  const legacyHasLiveVisual = legacy.some((item) => ["live-ai", "live-ai-edit"].includes(item?.imageSource) || item?.contentOrigin === "real_ai");
  const source = legacy.length && legacyHasLiveVisual && !canonicalHasLiveVisual
    ? legacy
    : canonical.length ? canonical : legacy;
  return source.map((item, index) => canonicalizeConceptCandidate(item, index, item?.directionId ?? null, item));
}

export function mergeIndustrialBrief(industrial, value) {
  if (!value || typeof value !== "object") return industrial;
  const next = { ...industrial.brief };
  for (const key of ["goal", "targetUser", "scenario", "interpretation", "productCategory"]) {
    if (typeof value[key] === "string" && value[key].trim()) next[key] = value[key].trim();
  }
  for (const key of ["keyNeeds", "unknowns", "deliverables", "constraints", "keywords", "avoid"]) {
    if (Array.isArray(value[key]) && value[key].length) next[key] = value[key].filter(Boolean).map(String).slice(0, 8);
  }
  return { ...industrial, brief: next, contentOrigin: "real_ai" };
}

export function mergeIndustrialResearch(industrial, value) {
  const rawEvidence = arrayFrom(value?.evidence);
  const rawInsights = arrayFrom(value?.insights);
  if (rawEvidence.length < 3 || rawInsights.length < 3) return industrial;
  const evidence = rawEvidence.slice(0, 6).map((item, index) => ({
    ...industrial.evidence[index % industrial.evidence.length],
    id: makeId(industrial.evidence[0]?.id?.split("-evidence-")[0] ?? "ai", "ai-evidence", index),
    type: clean(item.type, "研究证据"), title: clean(item.title, `研究证据 ${index + 1}`),
    excerpt: clean(item.excerpt ?? item.observation, "AI 生成的研究观察，待人工确认。"),
    meaning: clean(item.meaning ?? item.designMeaning, "需要进入后续设计判断的证据。"),
    source: clean(item.source, "AI 结构化研究，待补原始来源"),
    credibility: clean(item.credibility, "待验证"), image: null, contentOrigin: "real_ai",
  }));
  const insights = rawInsights.slice(0, 6).map((item, index) => ({
    ...industrial.insights[index % industrial.insights.length],
    id: makeId(evidence[0].id.split("-ai-evidence-")[0], "ai-insight", index),
    statement: clean(item.statement ?? item.title, `设计洞察 ${index + 1}`),
    rationale: clean(item.rationale, "基于研究证据生成，等待设计师确认。"),
    opportunity: clean(item.opportunity, "转化为可验证的产品设计机会。"),
    sourceEvidenceIds: [evidence[index % evidence.length].id], image: null, contentOrigin: "real_ai",
  }));
  return { ...industrial, evidence, insights, selectedInsightIds: [], contentOrigin: "real_ai", ai: { ...industrial.ai, mode: "live", lastOperation: "research", updatedAt: new Date().toISOString() } };
}

export function mergeIndustrialDirections(industrial, value) {
  const rows = arrayFrom(value?.directions ?? value?.items);
  if (rows.length < 3) return industrial;
  const directions = rows.slice(0, 3).map((item, index) => ({
    ...industrial.directions[index],
    contentOrigin: "real_ai",
    name: clean(item.name ?? item.title, industrial.directions[index].name),
    subtitle: clean(item.subtitle, industrial.directions[index].subtitle),
    formLanguage: clean(item.formLanguage ?? item.form, industrial.directions[index].formLanguage),
    keywords: Array.isArray(item.keywords) ? item.keywords.filter(Boolean).map(String).slice(0, 5) : industrial.directions[index].keywords,
    opportunity: clean(item.opportunity, industrial.directions[index].opportunity),
    hypothesis: clean(item.hypothesis, industrial.directions[index].hypothesis),
    tradeoff: clean(item.tradeoff, industrial.directions[index].tradeoff),
    validationMetric: clean(item.validationMetric ?? item.validation, industrial.directions[index].validationMetric),
    image: null,
  }));
  return { ...industrial, directions, ai: { ...industrial.ai, mode: "live", lastOperation: "direction", updatedAt: new Date().toISOString() } };
}

export function mergeIndustrialConcepts(industrial, value) {
  const rows = arrayFrom(value?.concepts ?? value?.items);
  if (rows.length < 2 || !industrial.selectedDirectionId) return industrial;
  const allCandidates = migrateIndustrialConceptCandidates(industrial);
  const current = allCandidates.filter((item) => item.directionId === industrial.selectedDirectionId);
  const selected = rows.slice(0, 3).map((row, index) => ({
    ...canonicalizeConceptCandidate(row, index, industrial.selectedDirectionId, current[index] ?? null),
    contentOrigin: "real_ai",
  }));
  const selectedIds = new Set(selected.map((item) => item.id));
  const conceptCandidates = [
    ...allCandidates.filter((item) => item.directionId !== industrial.selectedDirectionId && !selectedIds.has(item.id)),
    ...selected,
  ];
  return { ...industrial, conceptCandidates, selectedConceptId: selected.some((item) => item.id === industrial.selectedConceptId) ? industrial.selectedConceptId : null, ai: { ...industrial.ai, mode: "live", lastOperation: "concept", updatedAt: new Date().toISOString() } };
}

export function mergeIndustrialCmf(industrial, value) {
  const rows = arrayFrom(value?.cmfSchemes ?? value?.cmf ?? value?.items);
  if (rows.length < 3 || !industrial.selectedConceptId) return industrial;
  const current = industrial.cmfSchemes.filter((item) => !item.conceptId || item.conceptId === industrial.selectedConceptId).slice(0, 3);
  if (current.length < 3) return industrial;
  const cmfSchemes = industrial.cmfSchemes.map((item) => {
    const index = current.findIndex((candidate) => candidate.id === item.id);
    if (index < 0 || !rows[index]) return item;
    const row = rows[index];
    return { ...item, name: clean(row.name ?? row.title, item.name), summary: clean(row.summary, item.summary), parts: Array.isArray(row.parts) && row.parts.length ? row.parts.slice(0, 4).map((part, partIndex) => ({ ...item.parts[partIndex % item.parts.length], ...part, part: clean(part.part, item.parts[partIndex % item.parts.length].part), material: clean(part.material, item.parts[partIndex % item.parts.length].material), color: clean(part.color, item.parts[partIndex % item.parts.length].color), finish: clean(part.finish, item.parts[partIndex % item.parts.length].finish), rationale: clean(part.rationale, item.parts[partIndex % item.parts.length].rationale) })) : item.parts, image: null, contentOrigin: "real_ai" };
  });
  return { ...industrial, cmfSchemes, contentOrigin: "real_ai", ai: { ...industrial.ai, mode: "live", lastOperation: "cmf", updatedAt: new Date().toISOString() } };
}

export function normalizeIndustrialReview(industrial, value, fallback) {
  if (!value || typeof value !== "object") return fallback;
  const reviewId = fallback.id;
  const sourceIssues = arrayFrom(value.dimensions ?? value.issues);
  const issues = sourceIssues.slice(0, 9).map((item, index) => ({
    ...fallback.issues[index % fallback.issues.length], id: `${reviewId}-ai-${index + 1}`,
    dimension: clean(item.dimension, fallback.issues[index % fallback.issues.length].dimension ?? "risk"),
    severity: item.severity === "high" ? "high" : item.severity === "low" ? "low" : "medium",
    title: clean(item.title ?? item.finding, fallback.issues[index % fallback.issues.length].title),
    evidence: clean(item.evidence, fallback.issues[index % fallback.issues.length].evidence),
    impact: clean(item.impact ?? item.finding, fallback.issues[index % fallback.issues.length].impact),
    recommendation: clean(item.recommendation ?? item.action, fallback.issues[index % fallback.issues.length].recommendation),
    validationState: "AI_RECOMMENDATION",
    decision: "pending",
  }));
  return { ...fallback, mode: "live-ai", contentOrigin: "real_ai", summary: clean(value.summary, fallback.summary), strengths: arrayFrom(value.strengths).slice(0, 4).map((item, index) => ({ title: clean(item.title, fallback.strengths[index % fallback.strengths.length].title), evidence: clean(item.evidence, fallback.strengths[index % fallback.strengths.length].evidence) })), issues: issues.length >= 9 ? issues : fallback.issues };
}
