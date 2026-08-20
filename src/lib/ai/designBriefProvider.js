import { z } from "zod";

const ORIGINS = ["explicit", "inferred", "suggested"];
const DOMAINS = ["product_design", "industrial_design", "brand_design", "spatial_design", "uiux", "mixed_brand_spatial", "general_design"];
const OUTCOME_CATEGORIES = ["Design Output", "Research Output", "Decision Output", "Presentation Output", "Validation Output"];
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = (items) => [...new Set((items ?? []).map(clean).filter(Boolean))];
const clip = (value, max, fallback = "") => {
  const text = clean(value);
  if (!text) return fallback;
  return [...text].length <= max ? text : `${[...text].slice(0, Math.max(1, max - 1)).join("")}…`;
};
const firstClause = (value, max = 80) => clip(clean(value).split(/[。！？；\n]/)[0], max);
const splitList = (value) => Array.isArray(value) ? unique(value) : unique(String(value ?? "").split(/[、,，;；\n]/));
const hasValue = (value) => clean(value) && !/^(待补充|待确认|未知|未填写|暂无|无)$/i.test(clean(value));

const briefItemSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), origin: z.enum(ORIGINS), sourceText: z.string().optional(),
});
const outcomeSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), category: z.enum(OUTCOME_CATEGORIES), sourceText: z.string().optional(), origin: z.literal("explicit"),
});
const suggestedOutcomeSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), category: z.enum(OUTCOME_CATEGORIES), rationale: z.string().min(1), accepted: z.boolean(), origin: z.literal("suggested"),
});
const domainSchema = z.object({ primary: z.enum(DOMAINS), secondary: z.enum(DOMAINS).optional(), mode: z.enum(DOMAINS) });
const designBriefSchema = z.object({
  projectId: z.string().min(1), domain: domainSchema,
  coreDesignQuestion: z.string().min(35).max(100), designObjective: z.string().min(50).max(120),
  coreTension: z.object({
    title: z.string().min(1).max(30), explanation: z.string().min(1).max(140),
    sideA: z.string().min(1).max(60).optional(), sideB: z.string().min(1).max(60).optional(),
    whyConflict: z.string().min(1).max(180).optional(),
    riskIfOverIndexA: z.string().min(1).max(120).optional(), riskIfOverIndexB: z.string().min(1).max(120).optional(),
    researchImplication: z.string().min(1).max(200).optional(),
  }),
  targetUser: z.object({ primary: z.string().min(1).max(80), relevantTraits: z.array(z.string().min(1)).max(5) }),
  referenceContext: z.array(z.string().min(1)).max(8), coreScenario: z.string().min(35).max(180),
  designRequirements: z.array(briefItemSchema).max(8), designConstants: z.array(briefItemSchema).max(8), designExclusions: z.array(briefItemSchema).max(8),
  expectedOutcomes: z.object({ explicit: z.array(outcomeSchema).max(12), suggested: z.array(suggestedOutcomeSchema).max(4) }),
  assumptions: z.array(briefItemSchema.extend({ origin: z.literal("inferred"), status: z.literal("to_validate") })).max(5),
  unknowns: z.array(briefItemSchema.extend({ status: z.literal("unknown") })).max(6),
  initialSuccessCriteria: z.array(briefItemSchema.extend({ status: z.literal("initial").optional() })).max(5),
  researchQuestions: z.array(briefItemSchema.extend({ origin: z.literal("inferred") })).min(3).max(5),
  workflowRequirements: z.array(z.string().min(1)).max(8), status: z.enum(["draft", "confirmed"]), confirmedAt: z.string().nullable().optional(),
});

const workflowPatterns = [
  /moodboard/i, /creative\s*direction/i, /image\s*generation/i, /ai\s*critique/i,
  /生成(?:三个|三条|3条|3个)?(?:方案|方向|图片|图像)/, /生成提示词/, /版本记录/, /请帮我/, /帮我完成/, /输出(?:一套|三条|方案)/,
];
const industrialContamination = /受力|量产|模具|结构工程|产品耐久|连续操作完成率|材料耐久测试|高频接触区域|工业样机/;
const garbageJudgments = /高级|现代|未来|创新|可靠|廉价|美观|科技感/;
const referenceNames = /Manner|Aesop|Gentle\s*Monster|Seesaw|喜茶|无印良品|Apple|Nike/gi;

function readSource({ project = {}, sourceBrief = {}, industrial = {} } = {}) {
  const legacy = project.originalBrief ?? {};
  const old = industrial.brief ?? {};
  const value = (key, fallback = "") => clean(sourceBrief[key]) || clean(legacy[key]) || clean(old[key]) || fallback;
  const values = (key) => unique([...splitList(sourceBrief[key]), ...splitList(legacy[key]), ...splitList(old[key])]);
  const goal = value("goal", value("designGoal", project.description));
  const audience = value("audience", old.targetUser);
  const context = value("context", value("background", old.scenario));
  const deliverables = values("deliverables");
  const constraints = values("constraints");
  const keywords = values("keywords");
  const avoid = values("avoid");
  const unknowns = values("unknowns");
  const fullText = [project.name, project.description, goal, audience, context, ...deliverables, ...constraints, ...keywords, ...avoid, ...unknowns, sourceBrief.workflowRequirements].filter(Boolean).join(" ");
  return { goal, audience, context, deliverables, constraints, keywords, avoid, unknowns, fullText, raw: sourceBrief };
}

function classifyDomain({ project, source, explicitDomain }) {
  const text = `${source.fullText} ${project.productDiscipline ?? ""} ${project.type ?? ""}`;
  if (explicitDomain && DOMAINS.includes(explicitDomain)) return { primary: explicitDomain, mode: explicitDomain };
  const brand = /品牌|视觉识别|标志|logo|海报|传播|茶文化|茶饮|新消费|campaign|packaging|包装|社交传播/i.test(text);
  const spatial = /空间|快闪|入口|店铺|门店|线下|商业区域|展陈|室内|动线|空间体验/i.test(text);
  const uiux = project.type === "ui" || /uiux|app|应用|界面|交互|信息架构|用户流程|可用性|学习平台|网页|小程序|手机端/i.test(text);
  const industrial = project.productDiscipline === "industrial" || /工业设计|产品设计|产品概念|设备|家电|净化器|结构|材料|制造|量产|模具|维护|滤芯/i.test(text);
  if (brand && spatial) return { primary: "brand_design", secondary: "spatial_design", mode: "mixed_brand_spatial" };
  if (industrial) return { primary: "industrial_design", mode: "industrial_design" };
  if (uiux) return { primary: "uiux", mode: "uiux" };
  if (brand) return { primary: "brand_design", mode: "brand_design" };
  if (spatial) return { primary: "spatial_design", mode: "spatial_design" };
  if (/产品|用品|工具/i.test(text)) return { primary: "product_design", mode: "product_design" };
  return { primary: "general_design", mode: "general_design" };
}

function extractWorkflow(source) {
  const candidates = [
    ...splitList(source.raw?.workflowRequirements),
    ...source.deliverables.filter((item) => workflowPatterns.some((pattern) => pattern.test(item))),
    ...source.constraints.filter((item) => workflowPatterns.some((pattern) => pattern.test(item))),
  ];
  if (workflowPatterns.some((pattern) => pattern.test(source.goal))) candidates.push("原始需求包含流程性创作要求，已拆分到 Muse 工作流中");
  ["Moodboard", "Creative Direction", "Image Generation", "AI Critique", "生成三个方向", "生成三条方向", "版本记录", "生成图片"].forEach((label) => {
    if (source.fullText.toLowerCase().includes(label.toLowerCase())) candidates.push(label);
  });
  if (/三个|三条|3个|3条/.test(source.fullText) && /方向|方案/.test(source.fullText)) candidates.push("生成并比较三条创意方向");
  if (/图片|图像|效果图/.test(source.fullText) && /生成|输出/.test(source.fullText)) candidates.push("生成与项目方向一致的产品/空间视觉预览");
  return unique(candidates).slice(0, 8);
}

function stripWorkflow(value) {
  return clean(value)
    .replace(/(?:请帮我|帮我完成|帮我)?(?:生成|输出)(?:一套|三个|三条|3个|3条)?(?:moodboard|creative\s*direction|image\s*generation|ai\s*critique|方案|方向|提示词|图片|效果图)/gi, "")
    .replace(/moodboard|creative\s*direction|image\s*generation|ai\s*critique|版本记录/gi, "")
    .replace(/\s{2,}/g, " ").trim();
}

function detectReferences(text) {
  return unique((text.match(referenceNames) ?? []).map((item) => item.replace(/\s+/g, " "))).slice(0, 8);
}

function targetUser(source, domain) {
  const audience = stripWorkflow(source.audience);
  if (hasValue(audience)) {
    if (/18\s*[–-]\s*28|18至28|18到28/.test(audience)) return "18–28 岁城市年轻用户";
    return clip(audience.replace(referenceNames, "").replace(/[，,、;；]\s*$/, ""), 70, "目标用户待确认");
  }
  if (domain.mode === "mixed_brand_spatial") return "在城市商业空间中接触品牌体验的年轻用户";
  if (domain.primary === "uiux") return "需要完成核心任务的应用用户";
  if (domain.primary === "industrial_design" || domain.primary === "product_design") return "在真实生活场景中长期使用产品的人";
  return "项目所面向的核心使用者";
}

function relevantTraits(source, domain, user) {
  const text = `${source.fullText} ${user}`;
  if (domain.mode === "mixed_brand_spatial" || domain.primary === "brand_design") {
    return unique([
      /社交|分享|拍照|传播/.test(text) ? "具有生活方式消费和社交分享行为" : "会通过视觉与体验判断品牌是否值得靠近",
      /新消费|年轻|18/.test(text) ? "熟悉新消费品牌体验" : "对品牌识别度与表达一致性敏感",
      /茶|文化|传统/.test(text) ? "愿意在日常消费中接触文化来源" : "关注品牌长期表达而非单次噱头",
    ]).slice(0, 4);
  }
  if (domain.primary === "uiux") return unique(["带着明确任务进入产品", /新手|学习/.test(text) ? "需要低学习成本的引导" : "关注任务完成效率", "会根据反馈调整下一步操作"]).slice(0, 4);
  if (domain.primary === "industrial_design" || domain.primary === "product_design") return unique(["在具体场景中高频使用产品", /维护|清洁/.test(text) ? "关注维护与复位成本" : "关注操作路径是否可理解", /携带|移动/.test(text) ? "需要在不同地点切换使用" : "需要产品与环境稳定共存"]).slice(0, 4);
  return ["有明确的使用目标", "会根据实际体验调整选择"];
}

function inferWhere(context, fullText) {
  const place = context.match(/(上海|北京|深圳|广州|商业区域|商场|门店|快闪空间|卧室|客厅|书桌|厨房|通勤途中|课堂|家中)/)?.[1];
  return place || (fullText.match(/(城市|家庭|办公|线下|线上)/)?.[1] ?? "真实使用场景");
}

function coreScenario({ project, source, domain, user }) {
  const where = inferWhere(source.context, source.fullText);
  const brandName = clean(project.name) || "该项目";
  if (domain.mode === "mixed_brand_spatial") {
    const action = /茶|茶饮/.test(source.fullText) ? "被入口吸引后进入、选择茶饮并产生拍摄或分享行为" : "被入口吸引后进入、体验并产生停留或分享行为";
    return clip(`${user}在${where}经过${brandName}的线下体验空间，${action}。空间需要在短时间内完成品牌识别，同时让用户理解它与同类体验的差异。`, 180);
  }
  if (domain.primary === "brand_design") return clip(`${user}在${where}接触${brandName}的品牌触点，需要在短时间内理解品牌主张、识别视觉差异，并愿意继续了解或使用。`, 180);
  if (domain.primary === "uiux") return clip(`${user}在${where}打开${brandName}完成核心任务，需要快速理解信息层级、得到明确反馈，并在出现不确定时知道如何继续。`, 180);
  if (domain.primary === "industrial_design" || domain.primary === "product_design") return clip(`${user}在${where}使用${brandName}完成核心任务，需要看懂开始、操作与复位路径，并在维护或环境变化时保持可预期。`, 180);
  return clip(`${user}在${where}使用${brandName}完成核心任务，需要快速理解选择依据，并在关键节点获得可验证的反馈。`, 180);
}

function coreTension({ source, domain }) {
  const text = source.fullText;
  if (domain.mode === "mixed_brand_spatial" && /茶|传统|中国/.test(text)) return {
    title: "文化识别 × 当代表达", sideA: "文化来源可感知", sideB: "当代表达不依赖传统符号",
    explanation: "失去传统符号后，品牌仍需通过茶的过程、时间、材料与空间体验建立文化连接。",
    whyConflict: "去掉传统符号后，文化识别更难被快速理解；过度使用传统符号又会回到同质化模板。",
    riskIfOverIndexA: "容易落入传统新中式模板，削弱年轻品牌的独立辨识度。",
    riskIfOverIndexB: "可能失去中国茶文化来源，变成普通生活方式品牌。",
    researchImplication: "研究哪些非传统线索——茶的过程、时间、材料变化、空间节奏与行为体验——仍能建立文化识别。",
  };
  if (domain.mode === "mixed_brand_spatial") return {
    title: "品牌一致 × 空间体验", sideA: "品牌识别一致", sideB: "现场体验有层次",
    explanation: "视觉系统需要贯穿入口、停留、传播等空间触点，同时保留现场体验的节奏与层次。",
    whyConflict: "品牌规则过强会压平现场体验，现场自由度过高又会让品牌识别断裂。",
    riskIfOverIndexA: "空间变成品牌手册的放大版，缺少真实体验的节奏。",
    riskIfOverIndexB: "触点各自表达，用户无法形成稳定记忆。",
    researchImplication: "研究哪些品牌线索必须保持一致，哪些空间触点可以根据行为和场景变化。",
  };
  if (domain.primary === "brand_design") return {
    title: "识别清晰 × 长期一致", sideA: "快速被认出", sideB: "长期可延展",
    explanation: "品牌需要快速被认出，也要避免把辨识度建立在一次性的视觉噱头上。",
    whyConflict: "短期醒目通常依赖强刺激，长期一致则需要可复用且不疲劳的识别规则。",
    riskIfOverIndexA: "容易依赖单次传播效果，后续触点难以延续。",
    riskIfOverIndexB: "过度保守会失去当前场景的注意力。",
    researchImplication: "研究用户真正记住的识别线索，以及这些线索在不同触点中的稳定边界。",
  };
  if (domain.primary === "spatial_design") return {
    title: "路径清楚 × 体验有度", sideA: "路径清楚", sideB: "体验有度",
    explanation: "空间要让用户自然完成移动与停留，同时保留能被感知的节奏、尺度和情绪变化。",
    whyConflict: "过度强调效率会让空间像通道，过度强调氛围又会增加寻找和决策成本。",
    riskIfOverIndexA: "用户完成任务却没有形成场所记忆。",
    riskIfOverIndexB: "空间体验变得含糊，关键行动需要额外解释。",
    researchImplication: "研究哪些节点需要明确引导，哪些节点可以把判断交给用户探索。",
  };
  if (domain.primary === "uiux") return {
    title: "任务效率 × 理解成本", sideA: "快速完成任务", sideB: "降低理解成本",
    explanation: "用户需要快速完成目标，但界面不能用过量提示和复杂层级换取所谓的功能完整。",
    whyConflict: "更多提示不一定带来更多理解，压缩流程也可能隐藏状态与恢复路径。",
    riskIfOverIndexA: "用户完成得快，却无法解释或恢复错误。",
    riskIfOverIndexB: "信息过多，核心任务被层级拖慢。",
    researchImplication: "研究用户在关键节点需要什么信息，以及哪些提示可以延后或被移除。",
  };
  if (/安静|夜间|睡眠/.test(text)) return {
    title: "状态可读 × 环境低扰", sideA: "状态可读", sideB: "环境低扰",
    explanation: "用户需要知道产品状态，但反馈强度必须服从休息与长期共处的场景。",
    whyConflict: "状态反馈越明显越容易被理解，但也越可能打断当前环境。",
    riskIfOverIndexA: "用户错过关键状态或不知道下一步。",
    riskIfOverIndexB: "提示变成噪声，破坏安静和信任。",
    researchImplication: "研究用户在夜间真正需要确认的状态，以及不同反馈强度的接受边界。",
  };
  if (/单手|携带|移动|清洁|维护/.test(text)) return {
    title: "核心任务 × 长期使用", sideA: "核心任务连续", sideB: "长期维护可承受",
    explanation: "关键操作要被看懂并顺利完成，维护与复位也不能成为长期使用的额外负担。",
    whyConflict: "为高频任务增加结构可能提升即时效率，也可能扩大清洁、收纳和维护成本。",
    riskIfOverIndexA: "日常维护被推迟，长期体验下降。",
    riskIfOverIndexB: "关键任务被繁琐步骤打断。",
    researchImplication: "研究一次任务中哪些步骤必须连续，以及用户愿意为长期维护承担什么成本。",
  };
  return {
    title: "核心价值 × 使用理解", sideA: "回应核心价值", sideB: "让用户理解",
    explanation: "方案既要回应项目真正要改变的问题，也要让用户在场景中理解为什么这样设计。",
    whyConflict: "设计价值如果不能在真实场景中被理解，就无法转化成可持续的使用判断。",
    riskIfOverIndexA: "方案只对团队内部成立，用户难以形成行动依据。",
    riskIfOverIndexB: "为了易懂而牺牲真正需要解决的问题。",
    researchImplication: "研究用户如何描述问题、理解现有方案，以及哪些事实能改变当前判断。",
  };
}

function completeCoreTension(value = {}) {
  const tension = value.coreTension ?? {};
  if (tension.sideA && tension.sideB && tension.whyConflict && tension.riskIfOverIndexA && tension.riskIfOverIndexB && tension.researchImplication) return value;
  const title = clean(tension.title);
  if (/文化识别|中国茶|传统/.test(title)) {
    return { ...value, coreTension: {
      ...tension,
      sideA: tension.sideA || "文化来源可感知", sideB: tension.sideB || "当代表达不依赖传统符号",
      whyConflict: tension.whyConflict || "去掉传统符号后，文化识别更难被快速理解；过度使用传统符号又会回到同质化模板。",
      riskIfOverIndexA: tension.riskIfOverIndexA || "容易落入传统新中式模板，削弱年轻品牌的独立辨识度。",
      riskIfOverIndexB: tension.riskIfOverIndexB || "可能失去中国茶文化来源，变成普通生活方式品牌。",
      researchImplication: tension.researchImplication || "研究哪些非传统线索——茶的过程、时间、材料变化、空间节奏与行为体验——仍能建立文化识别。",
    } };
  }
  const [left, right] = title.split("×").map(clean);
  return { ...value, coreTension: {
    ...tension,
    sideA: tension.sideA || left || "核心价值", sideB: tension.sideB || right || "使用理解",
    whyConflict: tension.whyConflict || "两侧判断需要在研究中找到可被验证的边界。",
    riskIfOverIndexA: tension.riskIfOverIndexA || "可能让方案牺牲另一侧的长期价值。",
    riskIfOverIndexB: tension.riskIfOverIndexB || "可能让方案失去当前项目的核心价值。",
    researchImplication: tension.researchImplication || "研究应优先寻找能改变这组取舍的事实。",
  } };
}

function designObjective({ project, source, domain, tension, user }) {
  const name = clean(project.name) || "项目";
  const text = source.fullText;
  if (domain.mode === "mixed_brand_spatial" && /茶|茶饮|茶文化/.test(text)) {
    return `建立一套可贯穿${name}品牌视觉、快闪空间与传播触点的统一设计语言，在文化识别、城市年轻用户的当代表达与长期品牌价值之间取得平衡。`;
  }
  if (domain.mode === "mixed_brand_spatial") return `建立一套可贯穿${name}品牌视觉与空间体验的统一设计语言，让${user}在真实触点中快速理解品牌，并形成可持续延展的体验记忆。`;
  if (domain.primary === "brand_design") return `为${name}建立清晰且可延展的品牌识别系统，让${user}在主要传播触点中形成稳定认知，同时保留长期表达的一致性。`;
  if (domain.primary === "spatial_design") return `围绕${name}的核心体验建立可被理解的空间秩序，使${user}能够自然完成进入、行动与停留，并感知场所真正的价值。`;
  if (domain.primary === "uiux") return `让${name}在核心使用场景中帮助${user}更快完成任务，通过清晰的信息结构、反馈和状态设计降低理解与操作成本。`;
  if (domain.primary === "industrial_design" || domain.primary === "product_design") return `为${user}建立一件围绕核心场景展开的${name}产品方案，让形态、交互触点与维护关系共同支持可理解、可验证的长期使用。`;
  return `围绕${name}真正要解决的问题，建立一套让${user}能够理解、使用并验证的设计方案，并将关键取舍转化为可追踪的判断。`;
}

function coreQuestion({ project, source, domain, user }) {
  const name = clean(project.name) || "该项目";
  const text = source.fullText;
  if (domain.mode === "mixed_brand_spatial" && /茶|传统|中国/.test(text)) return `如何在不借用传统东方符号的情况下，让${name}通过品牌与空间体验建立可识别的中国茶文化联系，同时保持面向城市年轻用户的当代表达？`;
  if (domain.mode === "mixed_brand_spatial") return `如何让${name}在品牌识别与空间体验之间形成统一关系，同时为${user}创造值得进入、停留并继续传播的线下体验？`;
  if (domain.primary === "brand_design") return `如何让${name}在关键品牌触点中形成清晰、可延展且不依赖短期潮流的识别与记忆？`;
  if (domain.primary === "spatial_design") return `如何让${name}通过空间秩序、体验路径与关键触点，帮助${user}自然理解并参与其中？`;
  if (domain.primary === "uiux") return `如何让${name}在核心任务中减少用户的理解与操作成本，同时提供足够清晰的反馈和继续行动的依据？`;
  if (domain.primary === "industrial_design" || domain.primary === "product_design") return `如何让${name}在真实使用场景中把核心操作、状态反馈与长期维护组织成一条可理解的产品路径？`;
  return `如何让${name}回应核心使用问题，并在真实场景中形成可被理解、验证和持续改进的设计判断？`;
}

function makeItem(projectId, kind, index, label, origin = "inferred", sourceText = undefined, extra = {}) {
  return { id: `${projectId}-brief-${kind}-${String(index + 1).padStart(2, "0")}`, label: clip(label, 120), origin, ...(sourceText ? { sourceText: clip(sourceText, 160) } : {}), ...extra };
}

function classifyOutcome(label) {
  const text = clean(label);
  if (/研究|访谈|观察|证据|竞品/.test(text)) return "Research Output";
  if (/方向|决策|比较|规则|策略/.test(text)) return "Decision Output";
  if (/验证|测试|指标|评审|样机/.test(text)) return "Validation Output";
  if (/海报|社交|传播|展示|展板|提案|演示/.test(text)) return "Presentation Output";
  return "Design Output";
}

function outcomes({ project, source, domain }) {
  const explicit = unique([...source.deliverables, ...splitList(project.outputTypes)]).filter((item) => !/digital_experience|brand_identity|social_media|poster|packaging/.test(item));
  const explicitRows = explicit.slice(0, 12).map((label, index) => ({ id: `${project.id}-outcome-${String(index + 1).padStart(2, "0")}`, label: clip(label, 70), category: classifyOutcome(label), sourceText: label, origin: "explicit" }));
  const existing = new Set(explicitRows.map((item) => item.label));
  const suggestions = [];
  const add = (label, category, rationale) => { if (!existing.has(label) && !suggestions.some((item) => item.label === label)) suggestions.push({ id: `${project.id}-suggested-outcome-${String(suggestions.length + 1).padStart(2, "0")}`, label, category, rationale, accepted: false, origin: "suggested" }); };
  if (domain.mode === "mixed_brand_spatial") {
    add("品牌—空间视觉系统规则", "Decision Output", "项目同时包含品牌与空间触点，需要把视觉、材质、图形和空间语言统一为可复用的系统。");
    if (!explicit.some((item) => /方向|创意|概念/.test(item))) add("创意方向比较板", "Decision Output", "保留不同方向及最终选择依据，避免只留下一个无法回溯的最终效果。");
    add("核心体验路径", "Research Output", "快闪项目的价值不只在视觉表达，还需要说明用户进入、停留、选择和离开的体验变化。");
  } else if (domain.primary === "industrial_design" || domain.primary === "product_design") {
    if (!explicit.some((item) => /概念|造型|产品/.test(item))) add("产品概念与形态决策", "Design Output", "将核心问题转译为可比较的产品形态，而不让研究与后续方案脱节。");
    if (!explicit.some((item) => /验证|测试|评审/.test(item))) add("关键使用路径验证记录", "Validation Output", "保留核心场景中的验证方法与结果，帮助后续判断回到证据而不是偏好。");
  } else if (domain.primary === "uiux") {
    if (!explicit.some((item) => /流程|原型|交互/.test(item))) add("核心任务流程原型", "Design Output", "用可操作的流程承接信息结构与交互判断，便于在研究后验证任务是否成立。");
    add("可用性验证记录", "Validation Output", "把关键任务、反馈和失败状态的验证结果留下，方便后续迭代有据可循。");
  } else {
    add("设计判断与验证记录", "Validation Output", "保留从问题到方案的判断依据，让项目结果可以被解释和复盘。");
  }
  return { explicit: explicitRows, suggested: suggestions.slice(0, 4) };
}

function requirements({ project, source, domain }) {
  const explicit = source.constraints.filter((item) => hasValue(item) && !workflowPatterns.some((pattern) => pattern.test(item)) && !/^设计关键词|^避免项/.test(item));
  const result = explicit.map((item, index) => makeItem(project.id, "requirement", index, item, "explicit", item));
  const text = source.fullText;
  const inferred = [];
  if (domain.mode === "mixed_brand_spatial") {
    inferred.push("品牌与空间共享同一核心概念", /社交|分享|传播/.test(text) ? "线下体验需要支持自然的社交传播" : "关键触点需要形成连续的体验记忆");
  } else if (domain.primary === "brand_design") inferred.push("视觉识别需要在主要传播触点中保持一致");
  else if (domain.primary === "spatial_design") inferred.push("空间路径、分区与材料语言需要共同支持体验节奏");
  else if (domain.primary === "uiux") inferred.push("核心任务的入口、反馈和异常状态需要形成可理解的连续流程");
  else if (domain.primary === "industrial_design" || domain.primary === "product_design") inferred.push("形态、触点与维护关系需要共同服务真实使用场景");
  inferred.forEach((item, index) => { if (!result.some((row) => row.label === item)) result.push(makeItem(project.id, "requirement", result.length + index, item)); });
  return result.slice(0, 8);
}

function constantsAndExclusions({ project, source }) {
  const explicitConstraints = source.constraints.filter((item) => hasValue(item) && !workflowPatterns.some((pattern) => pattern.test(item)) && !/避免|禁止|不使用|不要|不能/.test(item));
  const constants = explicitConstraints.slice(0, 8).map((item, index) => makeItem(project.id, "constant", index, item, "explicit", item));
  const exclusions = source.avoid.filter(hasValue).map((item, index) => makeItem(project.id, "exclusion", index, item, "explicit", item));
  return { constants, exclusions: exclusions.slice(0, 8) };
}

function assumptionsAndUnknowns({ project, source, domain, user }) {
  const assumptions = [];
  const addAssumption = (label) => { if (!assumptions.some((item) => item.label === label)) assumptions.push({ ...makeItem(project.id, "assumption", assumptions.length, label, "inferred"), origin: "inferred", status: "to_validate" }); };
  if (domain.mode === "mixed_brand_spatial" && /茶|传统|文化/.test(source.fullText)) addAssumption("目标用户可以在不依赖传统东方符号的情况下，通过茶的过程、时间或材料感知文化来源。");
  if (domain.mode === "mixed_brand_spatial") addAssumption("年轻用户对社交传播性与长期品牌感的判断并非完全冲突。");
  if (domain.primary === "brand_design") addAssumption("核心视觉线索可以在不同传播触点中保持识别，而不依赖单一媒介尺寸。");
  if (domain.primary === "uiux") addAssumption("用户能通过一条清晰的任务路径完成主要目标，并理解关键反馈。");
  if (domain.primary === "industrial_design" || domain.primary === "product_design") addAssumption("核心操作路径能够在真实姿态与空间限制下被连续完成。");
  const unknowns = [];
  const addUnknown = (label, origin = "inferred") => { if (!unknowns.some((item) => item.label === label)) unknowns.push({ ...makeItem(project.id, "unknown", unknowns.length, label, origin), status: "unknown" }); };
  source.unknowns.filter(hasValue).forEach((item) => addUnknown(item, "explicit"));
  const text = source.fullText;
  if ((domain.primary === "brand_design" || domain.mode === "mixed_brand_spatial") && !/logo|标志|品牌资产|视觉规范/.test(text)) addUnknown("品牌是否已有 Logo、基础视觉资产或既有使用规范？");
  if (domain.mode === "mixed_brand_spatial" && !/预算|成本|搭建/.test(text)) addUnknown("本轮是否已有搭建预算、场地尺寸或空间平面？");
  if (domain.mode === "mixed_brand_spatial" && !/重点|优先|品牌|空间/.test(source.goal)) addUnknown("品牌识别与空间体验哪个是本轮更优先的判断？");
  if (domain.primary === "uiux" && !/平台|端|设备|数据/.test(text)) addUnknown("产品平台、使用设备和已有数据约束是什么？");
  if ((domain.primary === "industrial_design" || domain.primary === "product_design") && !/尺寸|成本|制造|材料/.test(text)) addUnknown("尺寸、成本、材料或制造条件是否已有明确边界？");
  if (!hasValue(source.audience)) addUnknown("目标用户的具体特征和优先级仍需确认。");
  return { assumptions: assumptions.slice(0, 5), unknowns: unknowns.slice(0, 6) };
}

function successCriteria({ project, source, domain }) {
  const labels = [];
  if (domain.mode === "mixed_brand_spatial" && /茶|传统|文化/.test(source.fullText)) labels.push("文化连接：不依赖传统东方符号仍能建立清晰的茶文化来源。", "方向差异：后续创意方向在核心概念上真正不同。", "系统一致：品牌、空间与传播触点共享一套设计逻辑。", "长期价值：视觉辨识度不完全依赖一次性社交媒体效果。");
  else if (domain.mode === "mixed_brand_spatial") labels.push("品牌与空间一致：主要触点能够共享同一核心概念。", "体验路径清楚：用户能自然完成进入、体验与离开。", "方向可比较：不同方案的差异来自策略而不是换色。", "传播可延展：现场体验能转译为后续传播资产。");
  else if (domain.primary === "uiux") labels.push("任务成立：目标用户能完成核心任务。", "状态可读：关键反馈、异常和下一步行动都能被理解。", "路径可用：主要流程不依赖额外解释。", "验证可追溯：每个关键判断都能回到用户证据。");
  else if (domain.primary === "industrial_design" || domain.primary === "product_design") labels.push("核心任务成立：目标用户能在真实场景中完成主要操作。", "结构关系可读：开始、使用、维护与复位路径能够被理解。", "方向可比较：方案差异来自产品取舍而不是表面换色。", "验证可追溯：关键形态判断都有对应的场景与验证方法。");
  else labels.push("核心价值可理解：目标用户能够说出方案解决了什么问题。", "方案可比较：不同方向体现清晰的设计取舍。", "系统可延展：关键触点能够共享一套设计逻辑。");
  return labels.slice(0, 5).map((label, index) => ({ ...makeItem(project.id, "criterion", index, label, "inferred"), status: "initial" }));
}

function researchQuestions({ project, source, domain, user }) {
  const name = clean(project.name) || "该项目";
  if (domain.mode === "mixed_brand_spatial" && /茶|传统|文化/.test(source.fullText)) {
    return [
      `在不使用传统东方符号的情况下，哪些体验或视觉线索仍能让${user}联想到中国茶文化？`,
      "目标用户如何区分“年轻化品牌”与“短期潮流品牌”？",
      `${name}快闪空间中的哪些触点最影响第一次品牌识别？`,
      "潮汐、时间、茶叶舒展等概念中，哪一个最具有跨视觉和空间的延展能力？",
    ].map((label, index) => makeItem(project.id, "research-question", index, label, "inferred"));
  }
  if (domain.mode === "mixed_brand_spatial") return [
    "用户在第一次接触时如何理解品牌与空间之间的关系？",
    "哪些入口、动线和停留触点最能影响体验记忆？",
    "哪些视觉规则可以在空间与传播媒介之间稳定延展？",
  ].map((label, index) => makeItem(project.id, "research-question", index, label, "inferred"));
  if (domain.primary === "uiux") return [
    `用户完成${name}核心任务时最容易在哪一步犹豫或中断？`,
    "哪些信息、状态或反馈能够帮助用户继续行动？",
    "不同用户的任务路径是否存在需要被优先支持的差异？",
  ].map((label, index) => makeItem(project.id, "research-question", index, label, "inferred"));
  if (domain.primary === "industrial_design" || domain.primary === "product_design") return [
    "用户在真实场景中如何开始、完成和复位核心操作？",
    "哪些结构或触点会造成误解、换手、维护或放置障碍？",
    "不同使用条件下，用户如何判断产品状态与下一步行动？",
  ].map((label, index) => makeItem(project.id, "research-question", index, label, "inferred"));
  return [
    `目标用户如何描述${name}当前真正要解决的问题？`,
    "哪些场景与行为最能改变当前设计判断？",
    "哪些方向差异值得在下一阶段被比较与验证？",
  ].map((label, index) => makeItem(project.id, "research-question", index, label, "inferred"));
}

function overlapRatio(a, b) {
  const left = clean(a); const right = clean(b);
  if (!left || !right) return 0;
  const grams = (value) => new Set([...value].slice(0, -1).map((_, index) => [...value].slice(index, index + 2).join("")));
  const aGrams = grams(left); const bGrams = grams(right);
  let same = 0; aGrams.forEach((item) => { if (bGrams.has(item)) same += 1; });
  return same / Math.max(1, Math.min(aGrams.size, bGrams.size));
}

export function qualityReview(brief, originalText = "") {
  const errors = [];
  const primary = brief.domain.primary;
  const mainText = [brief.designObjective, brief.coreDesignQuestion, brief.coreScenario].join(" ");
  if ([brief.designObjective, brief.coreDesignQuestion, brief.coreScenario].some((item) => overlapRatio(item, originalText) > 0.78)) errors.push("核心输出与原始 Brief 长文本重合度过高");
  if ((primary === "brand_design" || primary === "spatial_design" || brief.domain.mode === "mixed_brand_spatial") && industrialContamination.test(mainText) && !/受力|量产|模具|结构工程|产品耐久|连续操作完成率|材料耐久测试|高频接触区域|工业样机/.test(originalText)) errors.push("品牌/空间 Brief 被工业模板污染");
  if (garbageJudgments.test([brief.designObjective, brief.coreDesignQuestion, brief.coreScenario].join(" "))) errors.push("核心判断包含未解释的空泛形容词");
  if (brief.researchQuestions.length < 3 || brief.researchQuestions.length > 5) errors.push("研究问题数量不在 3–5 个范围内");
  if ([brief.designObjective, brief.coreDesignQuestion, brief.coreScenario].some((item) => workflowPatterns.some((pattern) => pattern.test(item)))) errors.push("流程要求污染核心设计输出");
  return { ok: errors.length === 0, errors };
}

function normalizeBrief(value) {
  const parsed = designBriefSchema.safeParse(completeCoreTension(value));
  if (parsed.success) return parsed.data;
  return completeCoreTension(value);
}

export function createDesignBrief({ project = {}, sourceBrief = {}, industrial = {}, projectOverview, domain: explicitDomain } = {}) {
  const source = readSource({ project, sourceBrief, industrial });
  const domain = classifyDomain({ project, source, explicitDomain });
  const workflowRequirements = extractWorkflow(source);
  const user = targetUser(source, domain);
  const tension = coreTension({ source, domain });
  const originalText = source.fullText;
  const brief = {
    projectId: project.id ?? "project",
    domain,
    coreDesignQuestion: coreQuestion({ project, source, domain, user }),
    designObjective: designObjective({ project, source, domain, tension, user }),
    coreTension: tension,
    targetUser: { primary: user, relevantTraits: relevantTraits(source, domain, user) },
    referenceContext: detectReferences(originalText),
    coreScenario: coreScenario({ project, source, domain, user }),
    designRequirements: requirements({ project, source, domain }),
    ...(() => { const boundary = constantsAndExclusions({ project, source }); return { designConstants: boundary.constants, designExclusions: boundary.exclusions }; })(),
    expectedOutcomes: outcomes({ project, source, domain }),
    ...assumptionsAndUnknowns({ project, source, domain, user }),
    initialSuccessCriteria: successCriteria({ project, source, domain }),
    researchQuestions: researchQuestions({ project, source, domain, user }),
    workflowRequirements,
    status: "draft",
    confirmedAt: null,
  };
  const normalized = normalizeBrief(brief);
  const review = qualityReview(normalized, originalText);
  if (!review.ok) {
    return { ...normalized, designObjective: clean(normalized.designObjective).replace(industrialContamination, "核心使用关系"), designBriefQuality: review };
  }
  return { ...normalized, designBriefQuality: review, projectOverview: Boolean(projectOverview) };
}

export function validateDesignBrief(value, originalText = "") {
  const schemaResult = designBriefSchema.safeParse(completeCoreTension(value));
  if (!schemaResult.success) return { ok: false, errors: schemaResult.error.issues.map((issue) => issue.message), data: value };
  const review = qualityReview(schemaResult.data, originalText);
  return { ...review, data: schemaResult.data };
}

export function designBriefInstruction(project, sourceBrief = {}, industrial = {}) {
  const source = readSource({ project, sourceBrief, industrial });
  return `将以下原始设计需求转换为 Design Brief V2。先分类领域，再分离流程要求、用户事实、设计约束、预期成果、假设和未知；不要复制原文，不要把流程要求当作设计目标。\n项目：${project?.name ?? "未命名"}\n原始需求：${source.fullText}`;
}

export { designBriefSchema as DesignBriefSchema };
export { completeCoreTension };
