const MAX_TEXT = 260;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const clip = (value, max = MAX_TEXT) => {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};
const unique = (items = []) => [...new Set(items.map(clean).filter(Boolean))];

const pollutedTerms = /Moodboard|Creative Direction|Image Generation|AI Critique|prompt|Prompt|导出|版本记录|视觉生成|图像生成|AI 评审/i;
const mixedDomainForbiddenTerms = /产品功能|产品形态|产品结构|结构工程|维护|耐久|受力|量产|模具|高频接触|连续操作|单手操作|材料耐久|滤芯|进风|抽屉|承重/;
const genericOnlyTerms = /^(高级|现代|创新|简洁|年轻|未来|情绪|体验|文化感)[。！!，,、 ]*$/;

const labels = (items = []) => items.map((item) => clean(item?.label ?? item)).filter(Boolean);

function domainMode(project = {}) {
  const brief = project.designBrief ?? {};
  return brief.domain?.mode || brief.domain?.primary || (project.productDiscipline === "industrial" ? "industrial_design" : "general_design");
}

/**
 * Only confirmed Design Brief fields are allowed into the Insight context.
 * OriginalBrief is intentionally not read here: it contains workflow prose and
 * can pollute downstream judgement with image-generation instructions.
 */
export function buildConfirmedDesignBriefContext(project = {}) {
  const brief = project.designBrief ?? {};
  return {
    coreDesignQuestion: clip(brief.coreDesignQuestion, 240),
    designObjective: clip(brief.designObjective, 240),
    coreTension: clip(brief.coreTension?.explanation || brief.coreTension?.title, 240),
    targetUser: clip(brief.targetUser?.primary, 180),
    scenario: clip(brief.coreScenario, 240),
    designRequirements: labels(brief.designRequirements).slice(0, 8).map((item) => clip(item, 120)),
    exclusions: labels(brief.designExclusions).slice(0, 8).map((item) => clip(item, 120)),
    successCriteria: labels(brief.initialSuccessCriteria).slice(0, 8).map((item) => clip(item, 120)),
  };
}

export function getAcceptedResearchEvidence(project = {}) {
  return (project.researchWorkspace?.evidence ?? []).filter((item) =>
    item.type === "verified"
    && item.userStatus === "accepted"
    && Boolean(item.traceableSource || item.sourceUrl || item.sourceFileId || item.userProvidedSource)
    && Boolean(clean(item.originalExcerpt)),
  );
}

export function getDesignInsightContextSignature(project = {}) {
  const brief = buildConfirmedDesignBriefContext(project);
  const accepted = getAcceptedResearchEvidence(project).map((item) => ({
    id: item.id,
    sourceId: item.sourceId,
    questionIds: item.questionIds,
    lensIds: item.lensIds,
    excerpt: clean(item.originalExcerpt),
    implication: clean(item.designImplication),
  }));
  return JSON.stringify({ projectId: project.id, domain: domainMode(project), brief, accepted });
}

function evidenceText(item) {
  return [item.title, item.originalExcerpt, item.interpretation, item.designImplication, item.sourceName].map(clean).filter(Boolean).join(" ");
}

function shortSignal(items) {
  const source = items.find((item) => clean(item.designImplication))?.designImplication
    || items.find((item) => clean(item.interpretation))?.interpretation
    || items[0]?.originalExcerpt
    || items[0]?.title
    || "用户材料中的重复线索";
  return clip(source, 78).replace(/[。！？.!?]+$/, "");
}

function themeFor(items, index, mode) {
  const text = items.map(evidenceText).join(" ");
  if (mode === "mixed_brand_spatial") {
    const matches = [];
    if (/文化|来源|传统|过程|手作|原料|冲泡|时间/.test(text)) matches.push("culture");
    if (/入口|停留|动线|空间|节点|进入|离开|排队|现场/.test(text)) matches.push("spatial");
    if (/分享|拍摄|社交|讨论|传播|记住|再访/.test(text)) matches.push("social");
    if (/年轻|同质|识别|品牌|认知|记忆|长期/.test(text)) matches.push("brand");
    if (matches.length) return matches[index % matches.length];
    return ["culture", "spatial", "brand", "social", "consistency"][index % 5];
  }
  if (/携带|移动|取用|操作|中断|收纳|放置/.test(text)) return "task";
  if (/清洁|维护|复位|耐久|寿命/.test(text)) return "continuity";
  if (/材料|触点|握持|表面|质感/.test(text)) return "touchpoint";
  return ["task", "context", "continuity", "touchpoint", "consistency"][index % 5];
}

const themeCopy = {
  culture: {
    title: "文化来源要通过可参与的过程被理解",
    statement: (signal) => `材料反复指向“${signal}”，文化联系因此需要落在用户能参与和复述的品牌过程里，而不是由符号单独代替。`,
    why: "如果文化来源只能靠装饰解释，用户离开现场后很难保留具体记忆；可参与的过程更容易成为品牌与空间共同拥有的识别线索。",
    implication: "把这条线索转成入口、选择、体验或离场中的一个明确节点，并让同一规则同时出现在品牌触点与空间秩序里。",
    fields: ["coreDesignQuestion", "coreTension", "scenario"],
  },
  spatial: {
    title: "空间判断来自关键节点，而不是信息堆积",
    statement: (signal) => `材料反复指向“${signal}”，说明用户需要在关键节点完成判断，而不是先理解一套完整说明。`,
    why: "当进入、停留和离开之间没有清晰的判断节点，体验会被动线和等待切碎，品牌记忆也会变成零散画面。",
    implication: "为进入、选择、停留和离开各自定义一个可被看见的体验节点，并删掉不能改变下一步行动的装饰信息。",
    fields: ["scenario", "designObjective", "designRequirements"],
  },
  social: {
    title: "传播需要一个可被讲述的体验节点",
    statement: (signal) => `材料反复指向“${signal}”，传播价值更可能来自一次可讲述的体验变化，而不是单独设置拍照画面。`,
    why: "只有画面没有体验原因，分享很难形成长期品牌记忆；用户需要知道自己为什么愿意把这段经历讲给别人。",
    implication: "设计一个有前后变化、能用一句话解释的现场节点，并让它自然连接到品牌主张和空间路径。",
    fields: ["scenario", "designObjective", "successCriteria"],
  },
  brand: {
    title: "年轻感来自品牌行为，而不只是视觉更新",
    statement: (signal) => `材料反复指向“${signal}”，年轻感应由品牌如何与用户相处来建立，而不是只靠颜色或短期风格。`,
    why: "当年轻只被当成一组视觉形容词，方案容易追逐潮流并失去长期识别；可持续的品牌行为更能跨触点复用。",
    implication: "明确品牌在现场如何说话、邀请、回应和被记住，再把这条行为规则转译到视觉、空间和传播触点。",
    fields: ["targetUser", "designObjective", "coreTension"],
  },
  consistency: {
    title: "品牌与空间应该共享一条体验规则",
    statement: (signal) => `材料反复指向“${signal}”，品牌与空间需要共享同一条可验证的体验规则，而不是分别装饰。`,
    why: "触点之间如果只有风格相似、没有共同判断，用户会把它们当成几组漂亮但互不相干的画面。",
    implication: "先定义一条跨触点规则，再用它检查入口、核心体验、传播物和离场记忆是否仍在服务同一个判断。",
    fields: ["coreDesignQuestion", "designRequirements", "successCriteria"],
  },
  task: {
    title: "核心任务需要一条可预期的连续路径",
    statement: (signal) => `材料反复指向“${signal}”，用户需要在关键动作之间保持方向感，而不是重新学习每一步。`,
    why: "动作一旦被打断，用户会把额外成本归因于产品本身，核心价值也会被一次犹豫抵消。",
    implication: "把下一步线索放在当前动作附近，让取用、使用和收回共享同一套可读关系，并用真实任务验证。",
    fields: ["coreScenario", "designRequirements", "successCriteria"],
  },
  continuity: {
    title: "长期价值取决于能否把维护变成短路径",
    statement: (signal) => `材料反复指向“${signal}”，长期使用的关键不是增加提醒，而是降低被推迟的维护成本。`,
    why: "维护一旦被视为额外任务，产品的初始承诺就无法转化为持续效果；短路径更容易在真实节奏中被重复。",
    implication: "把维护入口、清洁边界和复位结果设计成同一条短路径，并明确哪些地方仍需要工程验证。",
    fields: ["coreScenario", "designRequirements", "coreTension"],
  },
  touchpoint: {
    title: "触点差异要回应不同的判断风险",
    statement: (signal) => `材料反复指向“${signal}”，不同触点需要用真实接触关系表达差异，而不是只替换颜色。`,
    why: "颜色可以提示差异，却不能单独解释触感、清洁和长期可靠性；触点关系必须能被使用验证。",
    implication: "分别定义主体、操作区和维护区的接触任务，再让材料、表面和状态反馈共同服务于这些任务。",
    fields: ["designRequirements", "coreScenario", "successCriteria"],
  },
};

function buildClusters(evidence) {
  if (evidence.length <= 1) return evidence.length ? [[evidence[0]]] : [];
  if (evidence.length === 2) return [[evidence[0], evidence[1]], [evidence[1], evidence[0]]];
  const clusters = [];
  for (let index = 0; index < evidence.length; index += 1) {
    const current = evidence[index];
    const currentTopics = new Set([...(current.lensIds ?? []), ...(current.questionIds ?? [])]);
    const partner = evidence.slice(index + 1).find((item) => {
      const topics = new Set([...(item.lensIds ?? []), ...(item.questionIds ?? [])]);
      return ![...currentTopics].some((topic) => topics.has(topic));
    }) ?? evidence[(index + 1) % evidence.length];
    const ids = [current.id, partner.id];
    if (!clusters.some((cluster) => cluster.map((item) => item.id).sort().join("|") === ids.slice().sort().join("|"))) clusters.push([current, partner]);
  }
  return clusters;
}

function contextRepetition(text, context) {
  const candidates = [
    context.coreDesignQuestion,
    context.designObjective,
    context.coreTension,
    context.scenario,
    ...context.designRequirements,
    ...context.exclusions,
    ...context.successCriteria,
  ].filter((item) => item.length >= 12);
  return candidates.some((item) => text.includes(item));
}

function isSupportedForbiddenTerm(text, evidence) {
  const sourceText = evidence.map(evidenceText).join(" ");
  return !mixedDomainForbiddenTerms.test(text) || mixedDomainForbiddenTerms.test(sourceText);
}

export function qualityReviewDesignInsights({ project = {}, insights = [], evidence = getAcceptedResearchEvidence(project) } = {}) {
  const errors = [];
  const context = buildConfirmedDesignBriefContext(project);
  const mode = domainMode(project);
  const acceptedIds = new Set(evidence.map((item) => item.id));
  for (const insight of insights) {
    const text = [insight.title, insight.insightStatement, insight.patternSummary, insight.whyItMatters, insight.designImplication].join(" ");
    if (!insight.evidenceIds?.some((id) => acceptedIds.has(id))) errors.push(`${insight.id}: missing accepted evidence`);
    if (pollutedTerms.test(text)) errors.push(`${insight.id}: workflow or image-generation pollution`);
    if (contextRepetition(text, context)) errors.push(`${insight.id}: repeats confirmed brief`);
    if (genericOnlyTerms.test(clean(insight.insightStatement))) errors.push(`${insight.id}: generic language`);
    if (mode === "mixed_brand_spatial" && !isSupportedForbiddenTerm(text, evidence.filter((item) => insight.evidenceIds.includes(item.id)))) errors.push(`${insight.id}: mixed brand/spatial domain contamination`);
  }
  return { ok: errors.length === 0, errors };
}

function makeInsight({ project, cluster, index }) {
  const mode = domainMode(project);
  const theme = themeFor(cluster, index, mode);
  const copy = themeCopy[theme] ?? themeCopy.consistency;
  const signal = shortSignal(cluster);
  const evidenceIds = cluster.map((item) => item.id);
  const evidenceSources = unique(cluster.map((item) => item.sourceName || item.sourceId));
  const evidenceStrength = cluster.length >= 2 && evidenceSources.length >= 2 ? "strong" : cluster.length >= 2 ? "medium" : "preliminary";
  const statement = copy.statement(signal);
  return {
    id: `${project.id || "project"}-insight-v2-${String(index + 1).padStart(2, "0")}`,
    title: copy.title,
    insightStatement: statement,
    patternSummary: `来自${cluster.map((item) => `“${clip(item.title, 42)}”`).join("与")}的材料共同指向：${signal}。`,
    inferenceType: cluster.length >= 2 ? "cross_evidence_pattern" : "single_evidence_hypothesis",
    whyItMatters: copy.why,
    designImplication: copy.implication,
    evidenceIds,
    sourceEvidenceIds: evidenceIds,
    evidenceStrength,
    relatedBriefFields: copy.fields,
    status: "candidate",
    userEdited: false,
    evidenceSourceCount: evidenceSources.length,
  };
}

export function generateDesignInsights(project = {}) {
  const evidence = getAcceptedResearchEvidence(project);
  const context = buildConfirmedDesignBriefContext(project);
  if (!evidence.length) {
    return { context, contextSignature: getDesignInsightContextSignature(project), evidence, insights: [], quality: { ok: true, errors: [] }, gate: { acceptedEvidenceCount: 0, recommendedMinimum: 2, ready: false } };
  }
  const clusters = buildClusters(evidence);
  const desiredCount = evidence.length >= 5 ? 4 : evidence.length >= 3 ? 3 : evidence.length === 2 ? 2 : 1;
  const insights = clusters.slice(0, desiredCount).map((cluster, index) => makeInsight({ project, cluster, index }));
  const quality = qualityReviewDesignInsights({ project, insights, evidence });
  return {
    context,
    contextSignature: getDesignInsightContextSignature(project),
    evidence,
    insights: quality.ok ? insights : insights.filter((item) => !quality.errors.some((error) => error.startsWith(`${item.id}:`))),
    quality,
    gate: { acceptedEvidenceCount: evidence.length, recommendedMinimum: 2, ready: evidence.length >= 2 },
  };
}
