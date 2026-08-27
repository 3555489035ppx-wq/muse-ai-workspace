const MAX_EXCERPT = 900;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const clip = (value, max = MAX_EXCERPT) => {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};
const unique = (items = []) => [...new Set(items.map(clean).filter(Boolean))];
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const DAYTIDE_SIGNALS = /DAYTIDE|昼汐|茶饮|新茶饮|快闪/iu;

// Verified public-source regression fixture for the DAYTIDE portfolio project.
// These are candidate records: Muse never accepts them on the user's behalf.
export const DAYTIDE_PUBLIC_EVIDENCE = [
  {
    id: "daytide-e01",
    sourceId: "daytide-source-ccfa-market",
    title: "新茶饮已进入高频日常消费市场",
    sourceTitle: "CCFA 新茶饮研究报告：2023 年市场规模预计达 1498 亿元",
    sourcePublisher: "中国连锁经营协会（CCFA）",
    sourceUrl: "https://www.ccfa.org.cn/portal/cn/xiangxi.jsp?id=444980",
    sourceDate: "2023-09-20",
    originalExcerpt: "中国连锁经营协会与美团联合发布的《2023 新茶饮研究报告》指出，2023 年新茶饮市场规模预计达到 1498 亿元。",
    fact: "新茶饮已形成大规模、持续发生的消费市场，而不是只在节庆场景出现。",
    interpretation: "DAYTIDE 的快闪体验应进入城市日常节奏，而不是把茶文化做成一次性的陈列主题。",
    designImplication: "优先验证能嵌入通勤、午后与社交停留的体验机制，并让品牌与空间共享同一套时间线索。",
    limitations: "行业规模数据不能直接证明上海 18—28 岁人群的具体偏好，仍需现场访谈或行为观察补充。",
    questionIndex: 0,
    lensIndex: 1,
  },
  {
    id: "daytide-e02",
    sourceId: "daytide-source-naixue-tea",
    title: "年轻消费者越来越在意茶底本身",
    sourceTitle: "奈雪发布茶饮消费洞察：87% 消费者更关注茶底",
    sourcePublisher: "中国连锁经营协会（转载奈雪公开信息）",
    sourceUrl: "https://www.ccfa.org.cn/portal/cn/xiangxi.jsp?id=445184&type=2",
    sourceDate: "2024-01-11",
    originalExcerpt: "公开消费洞察显示，87% 的消费者比过去更关注茶底，90 后消费者占比约一半。",
    fact: "消费者对茶饮的判断正在从表面口味扩展到茶底、原料与制作过程。",
    interpretation: "文化来源可以通过可感知的茶底与制作过程建立，而不必依赖书法、青花等传统符号。",
    designImplication: "把茶底、冲泡时间或原料变化转化为用户可参与、可复述的现场节点。",
    limitations: "信息来自品牌公开洞察，样本结构与调查方法披露有限，应避免把百分比直接外推为所有用户。",
    questionIndex: 1,
    lensIndex: 0,
  },
  {
    id: "daytide-e03",
    sourceId: "daytide-source-zjic-scenario",
    title: "茶饮消费被通勤、办公与社交场景重新组织",
    sourceTitle: "新茶饮消费向日常化与多场景延伸",
    sourcePublisher: "浙江省经济信息中心",
    sourceUrl: "https://zjic.zj.gov.cn/ywdh/202605/t20260526_24092308.shtml",
    sourceDate: "2026-05-26",
    originalExcerpt: "公开行业观察将通勤、办公和社交列为年轻消费者饮茶的重要日常场景，并指出消费正从单次尝鲜转向稳定习惯。",
    fact: "年轻用户的茶饮行为跨越通勤、办公和社交，不同时间段对应不同的停留与交流需求。",
    interpretation: "快闪空间需要用节奏与参与深度区分时段，而不是把所有访客导向同一种打卡路径。",
    designImplication: "建立可快速经过、可短暂停留、可参与分享的分层体验，让品牌在不同城市节奏中保持一致。",
    limitations: "这是区域性行业观察，不等于 DAYTIDE 目标人群的直接访谈结论；需用上海现场数据校验。",
    questionIndex: 2,
    lensIndex: 3,
  },
];

export const RESEARCH_SOURCE_TYPES = ["user_paste", "user_upload", "url", "document", "external_search"];
export const RESEARCH_EVIDENCE_TYPES = ["verified", "candidate"];
export const RESEARCH_EVIDENCE_STATUSES = ["unreviewed", "accepted", "rejected", "saved"];
export const RESEARCH_ASSISTANT_STATUSES = ["idle", "processing", "success", "partial", "error"];
export const RESEARCH_SEARCH_STATUSES = ["idle", "searching", "success", "empty", "error"];

const SEARCH_NOTE = "搜索结果只会导入候选来源，不会自动成为已验证证据。请打开原文核对后再采纳。";

function searchResultId(url, index = 0) {
  const hash = [...String(url)].reduce((value, character) => ((value * 33) ^ character.charCodeAt(0)) >>> 0, 5381);
  return `search-result-${hash.toString(36)}-${index + 1}`;
}

export function createResearchSearchState(overrides = {}) {
  return {
    schemaVersion: 1,
    status: "idle",
    query: null,
    questionId: null,
    provider: null,
    runId: null,
    searchedAt: null,
    results: [],
    errorMessage: null,
    note: SEARCH_NOTE,
    ...overrides,
  };
}

export function normalizeResearchSearchResults(results = [], query = "", provider = "") {
  const seen = new Set();
  return (Array.isArray(results) ? results : [])
    .map((item, index) => {
      const url = clean(item?.url);
      if (!/^https:\/\//i.test(url) || seen.has(url)) return null;
      seen.add(url);
      const rawContent = clip(item?.rawContent, 8000);
      const snippet = clip(item?.snippet || rawContent, 700);
      if (!clean(item?.title) || !snippet) return null;
      return {
        id: clean(item?.id) || searchResultId(url, index),
        title: clip(item.title, 240),
        url,
        publisher: clip(item.publisher || (() => { try { return new URL(url).hostname; } catch { return "公开网页"; } })(), 120),
        publishedAt: clean(item?.publishedAt || item?.published_date) || null,
        snippet,
        rawContent: rawContent || undefined,
        contentStatus: item?.contentStatus === "full" || rawContent ? "full" : "snippet",
        score: Number.isFinite(Number(item?.score)) ? Number(item.score) : undefined,
        favicon: clean(item?.favicon) || null,
        query: clean(query) || undefined,
        provider: clean(provider) || undefined,
        retrievedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

const lensSets = {
  mixed_brand_spatial: [
    ["culture", "用户与文化语境", "研究用户如何理解文化来源，以及哪些生活经验会影响识别。"],
    ["brand", "品牌认知", "研究品牌在真实触点中被如何看见、记住与区分。"],
    ["competitor", "竞品与视觉语言", "研究同类品牌如何组织符号、材料、叙事与体验，而不是只收集风格图。"],
    ["spatial", "空间与体验", "研究进入、停留、选择、离开的路径和空间节奏。"],
    ["social", "传播行为", "研究用户为什么拍摄、分享、讨论或忽略现场体验。"],
    ["expression", "文化表达", "研究非传统符号如何承载来源、气质和当代表达。"],
  ],
  brand_design: [
    ["audience", "用户与认知", "研究用户如何识别、理解和记忆品牌。"],
    ["brand", "品牌语境", "研究品牌主张、触点和长期一致性。"],
    ["competitor", "竞品与差异", "研究同类品牌的表达惯例和差异空间。"],
    ["behavior", "传播行为", "研究品牌如何被使用、分享和再解释。"],
  ],
  spatial_design: [
    ["user", "用户与行为", "研究用户在空间中的进入、移动、停留和离开。"],
    ["path", "路径与节奏", "研究空间节点如何影响选择、理解和体验节奏。"],
    ["context", "场所语境", "研究场所、文化和运营条件对体验的影响。"],
    ["touchpoint", "触点与传播", "研究关键触点如何被看见、使用和记住。"],
  ],
  industrial_design: [
    ["use", "用户与任务", "研究真实使用姿态、动作顺序、误解和中断。"],
    ["context", "场景与环境", "研究放置、携带、收纳和环境条件对产品路径的影响。"],
    ["competitor", "竞品与操作语言", "研究同类产品如何组织结构、交互和维护关系。"],
    ["maintenance", "维护与长期使用", "研究清洁、维护、复位和耐久感知。"],
    ["material", "材料与触点", "研究材料、表面和触点如何影响使用判断。"],
  ],
  product_design: [
    ["use", "用户与任务", "研究用户如何完成核心任务，以及哪里会犹豫或中断。"],
    ["context", "场景与环境", "研究真实放置、移动、收纳和环境限制。"],
    ["competitor", "竞品与操作语言", "研究同类产品形成的使用预期。"],
    ["maintenance", "长期使用", "研究维护、复位和持续使用成本。"],
  ],
  uiux: [
    ["task", "用户与核心任务", "研究用户目标、任务顺序和完成标准。"],
    ["flow", "流程与信息结构", "研究理解、选择、反馈和恢复路径。"],
    ["context", "使用情境", "研究设备、时间、注意力和环境对操作的影响。"],
    ["accessibility", "可用性与包容", "研究不同能力和不确定状态下的可用性。"],
  ],
  general_design: [
    ["user", "用户与场景", "研究谁在什么情境下遇到问题。"],
    ["behavior", "行为与需求", "研究真实行为、动机和阻碍。"],
    ["context", "语境与限制", "研究环境、文化和资源限制。"],
    ["comparison", "同类方案", "研究现有方案的惯例和机会。"],
  ],
};

const questionFallbacks = {
  mixed_brand_spatial: [
    "用户如何理解这个品牌的文化来源，又会把哪些线索视为过时或同质化？",
    "用户在真实空间中从进入到离开经历了哪些关键触点？",
    "同类品牌如何把文化表达转化为可记忆的视觉与空间体验？",
    "哪些现场体验会促使用户停留、拍摄、分享或再次到访？",
  ],
  industrial_design: [
    "用户如何完成核心任务，哪些动作会造成换手、中断或误操作？",
    "产品在携带、放置、收纳和维护时有哪些真实限制？",
    "同类产品如何组织结构、反馈和维护路径，用户形成了什么预期？",
  ],
  uiux: [
    "用户在核心任务中如何理解信息、做出选择并确认结果？",
    "哪些状态、错误和恢复路径会让用户失去继续行动的依据？",
    "不同设备和能力条件下，哪些交互成本最需要被验证？",
  ],
  default: [
    "谁在什么情境下遇到这个问题，真实行为是什么？",
    "现有方案如何被理解和使用，哪里造成了阻碍？",
    "哪些事实足以改变当前的设计判断？",
  ],
};

function domainMode(brief = {}, project = {}) {
  return brief.domain?.mode || brief.domain?.primary || (project.productDiscipline === "industrial" ? "industrial_design" : "general_design");
}

function isDaytideResearchCase(project = {}, brief = {}) {
  const text = [project.name, project.title, brief.designObjective, brief.coreScenario, brief.coreDesignQuestion]
    .map(clean).join(" ");
  return DAYTIDE_SIGNALS.test(text) && domainMode(brief, project) === "mixed_brand_spatial";
}

function publicFixtureRecords(project = {}, brief = {}, questions = getResearchQuestions(brief, project), lenses = getResearchLenses(brief, project)) {
  if (!isDaytideResearchCase(project, brief)) return { sources: [], evidence: [] };
  const capturedAt = "2026-08-14T00:00:00.000Z";
  const sources = DAYTIDE_PUBLIC_EVIDENCE.map((item) => ({
    id: item.sourceId,
    type: "external_search",
    name: item.sourceTitle,
    sourceTitle: item.sourceTitle,
    sourcePublisher: item.sourcePublisher,
    sourceUrl: item.sourceUrl,
    sourceDate: item.sourceDate,
    originalExcerpt: item.originalExcerpt,
    userProvidedSource: false,
    capturedAt,
    limitations: item.limitations,
  }));
  const evidence = DAYTIDE_PUBLIC_EVIDENCE.map((item) => ({
    ...item,
    type: "candidate",
    userStatus: "unreviewed",
    verificationStatus: "source_checked",
    sourceType: "external_search",
    sourceTypeLabel: "外部检索",
    sourceName: item.sourceTitle,
    traceableSource: true,
    confidence: "medium",
    questionIds: [questions[item.questionIndex % Math.max(questions.length, 1)]?.id].filter(Boolean),
    lensIds: [lenses[item.lensIndex % Math.max(lenses.length, 1)]?.id].filter(Boolean),
    capturedAt,
    createdAt: capturedAt,
  }));
  return { sources, evidence };
}

export function getResearchLenses(brief = {}, project = {}) {
  const mode = domainMode(brief, project);
  return (lensSets[mode] || lensSets.general_design).map(([id, label, description]) => ({ id, label, description, domain: mode }));
}

export function getResearchQuestions(brief = {}, project = {}) {
  const projectName = clean(project.name);
  const explicit = (brief.researchQuestions ?? [])
    .map((item, index) => {
      let label = clean(item.label || item);
      if (projectName) label = label.replace(`${projectName}快闪空间`, "快闪空间").replace(`${projectName}的快闪空间`, "快闪空间");
      return { id: item.id || `${project.id || "project"}-rq-${index + 1}`, label, origin: "confirmed_brief" };
    })
    .filter((item) => item.label);
  if (explicit.length >= 3) return explicit.slice(0, 5);
  const mode = domainMode(brief, project);
  const fallback = questionFallbacks[mode] || questionFallbacks.default;
  return [...explicit, ...fallback.map((label, index) => ({ id: `${project.id || "project"}-rq-inferred-${index + 1}`, label, origin: "inferred_from_brief" }))].slice(0, 5);
}

export function createResearchAssistant(overrides = {}) {
  return {
    schemaVersion: 1,
    status: "idle",
    source: "none",
    provider: null,
    model: null,
    runId: null,
    generatedAt: null,
    questionPlans: [],
    gaps: [],
    nextActions: [],
    errorMessage: null,
    note: "AI 只生成研究线索与执行计划，不代表已经找到或验证真实来源。",
    ...overrides,
  };
}

export function normalizeResearchAssistantResult(result = {}, questions = []) {
  const questionById = new Map((questions ?? []).map((question) => [clean(question.id), question]));
  const questionPlans = (Array.isArray(result.questionPlans) ? result.questionPlans : [])
    .map((item) => {
      const questionId = clean(item?.questionId);
      const question = questionById.get(questionId);
      const querySuggestions = unique(item?.querySuggestions).slice(0, 4);
      const preferredSources = unique(item?.preferredSources).slice(0, 4);
      if (!question || querySuggestions.length < 2 || preferredSources.length < 1) return null;
      return {
        id: `research-plan-${questionId}`,
        questionId,
        question: question.label,
        whyThisMatters: clip(item.whyThisMatters, 420),
        evidenceNeed: clip(item.evidenceNeed, 420),
        querySuggestions,
        preferredSources,
      };
    })
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.questionId === item.questionId) === index);
  return {
    questionPlans,
    gaps: unique(result.gaps).slice(0, 8),
    nextActions: unique(result.nextActions).slice(0, 6),
  };
}

function sourceIdentity(source = {}) {
  return source.sourceUrl || source.sourceFileId || source.id || "unknown-source";
}

export function hasTraceableSource(source = {}, evidence = {}) {
  return Boolean(
    source.userProvidedSource || evidence.userProvidedSource ||
    source.sourceUrl || evidence.sourceUrl ||
    source.sourceFileId || evidence.sourceFileId,
  );
}

export function createResearchWorkspace({ project = {}, brief = {} } = {}) {
  const questions = getResearchQuestions(brief, project);
  const lenses = getResearchLenses(brief, project);
  const hypotheses = createHypotheses({ project, brief, questions });
  const fixture = publicFixtureRecords(project, brief, questions, lenses);
  return recomputeResearchWorkspace({
    schemaVersion: 3,
    projectId: project.id,
    mode: fixture.evidence.length ? "public_source_fixture" : "limited",
    providerStatus: fixture.evidence.length ? "fixture_ready" : "unavailable",
    status: fixture.evidence.length ? "reviewing" : "idle",
    questions,
    lenses,
    sources: fixture.sources,
    evidence: fixture.evidence,
    hypotheses,
    researchAssistant: createResearchAssistant(),
    researchSearch: createResearchSearchState(),
    evidenceLimited: false,
    plan: questions.map((question, index) => ({ id: `${question.id}-plan`, questionId: question.id, order: index + 1, status: "waiting", label: `围绕 ${question.label} 寻找可追溯来源` })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function migrateResearchWorkspace(existing, { project = {}, brief = {} } = {}) {
  const base = createResearchWorkspace({ project, brief });
  if (!existing) return base;
  const questions = getResearchQuestions(brief, project);
  const lenses = getResearchLenses(brief, project);
  return recomputeResearchWorkspace({
    ...base,
    ...existing,
    schemaVersion: 3,
    projectId: project.id,
    mode: existing.mode || "limited",
    providerStatus: existing.providerStatus || "unavailable",
    questions,
    lenses,
    sources: mergeById(base.sources, Array.isArray(existing.sources) ? existing.sources : []),
    evidence: mergeById(base.evidence, Array.isArray(existing.evidence) ? existing.evidence.filter((item) => hasTraceableSource(item) && clean(item.originalExcerpt)).map((item) => ({ ...item, type: item.type === "verified" ? "verified" : "candidate" })) : []),
    hypotheses: Array.isArray(existing.hypotheses) && existing.hypotheses.length ? existing.hypotheses : base.hypotheses,
    plan: Array.isArray(existing.plan) ? existing.plan : base.plan,
    researchSearch: createResearchSearchState(existing.researchSearch || {}),
  });
}

function mergeById(fallback = [], saved = []) {
  const savedById = new Map(saved.map((item) => [item.id, item]));
  return [...fallback.map((item) => ({ ...item, ...(savedById.get(item.id) || {}) })), ...saved.filter((item) => !fallback.some((base) => base.id === item.id))];
}

export function createResearchSource(input = {}) {
  const kind = input.kind || "user_paste";
  const sourceUrl = clean(input.sourceUrl);
  const excerpt = clip(input.originalExcerpt || input.excerpt);
  const source = {
    id: input.id || uid("source"),
    type: RESEARCH_SOURCE_TYPES.includes(kind) ? kind : "user_paste",
    name: clean(input.name || input.sourceName || (kind === "url" ? sourceUrl : "用户提供材料")),
    sourceUrl: sourceUrl || null,
    sourceFileId: clean(input.sourceFileId) || null,
    mimeType: clean(input.mimeType) || null,
    originalExcerpt: excerpt,
    sourceTitle: clean(input.sourceTitle) || undefined,
    sourcePublisher: clean(input.sourcePublisher) || undefined,
    sourceDate: clean(input.sourceDate) || undefined,
    contentStatus: input.contentStatus === "full" ? "full" : input.contentStatus === "snippet" ? "snippet" : undefined,
    searchQuery: clean(input.searchQuery) || undefined,
    searchProvider: clean(input.searchProvider) || undefined,
    searchResultId: clean(input.searchResultId) || undefined,
    userProvidedSource: Boolean(input.userProvidedSource ?? (kind === "user_paste" || kind === "user_upload")),
    capturedAt: input.capturedAt || new Date().toISOString(),
    thumbnailUrl: input.thumbnailUrl || null,
    limitations: clean(input.limitations) || (kind === "external_search"
      ? (input.contentStatus === "full" ? "内容由搜索服务抓取，仍需打开原文核对上下文、发布日期与适用范围。" : "当前只保留搜索摘要，必须打开原文并补充原始摘录后才可采纳。")
      : kind === "url" && !excerpt ? "仅记录链接，尚未读取原始内容。" : "内容来自用户提供材料，事实范围以原始材料为准。"),
  };
  return source;
}

function sourceTypeLabel(type) {
  return ({ user_paste: "用户粘贴", user_upload: "用户上传", url: "外部链接", document: "文档来源", external_search: "外部检索" })[type] || "来源";
}

function interpretationFor({ source, question, brief }) {
  if (!source.originalExcerpt) return "等待读取原始来源；Muse 不会根据链接名称推断事实。";
  const context = brief.coreScenario || brief.designObjective || "当前项目目标";
  return `这段材料与“${question?.label || "当前研究问题"}”相关。Muse 仅基于你提供的原文整理：它可以帮助判断材料中出现的行为、语境或限制是否会影响${context}，仍需要人工确认适用范围。`;
}

export function createCandidateEvidence({ project = {}, brief = {}, source, questionIds = [] } = {}) {
  const questions = getResearchQuestions(brief, project);
  const lenses = getResearchLenses(brief, project);
  const linkedQuestionIds = unique(questionIds).filter((id) => questions.some((question) => question.id === id));
  const question = questions.find((item) => item.id === linkedQuestionIds[0]) || questions[0];
  const traceable = hasTraceableSource(source);
  const excerpt = clip(source.originalExcerpt);
  return {
    id: uid("evidence"),
    sourceId: source.id,
    type: "candidate",
    userStatus: "unreviewed",
    verificationStatus: "unverified",
    title: source.name || "待命名来源",
    sourceType: source.type,
    sourceTypeLabel: sourceTypeLabel(source.type),
    sourceName: source.name,
    sourceTitle: source.sourceTitle || source.name,
    sourcePublisher: source.sourcePublisher || null,
    sourceDate: source.sourceDate || null,
    sourceUrl: source.sourceUrl,
    sourceFileId: source.sourceFileId,
    contentStatus: source.contentStatus,
    searchQuery: source.searchQuery,
    searchProvider: source.searchProvider,
    searchResultId: source.searchResultId,
    userProvidedSource: source.userProvidedSource,
    originalExcerpt: excerpt,
    fact: excerpt,
    interpretation: interpretationFor({ source, question, brief }),
    designImplication: excerpt ? "待人工确认：这段材料是否足以改变设计判断？" : "读取原始来源后再形成设计启示。",
    limitations: source.limitations,
    confidence: "low",
    questionIds: linkedQuestionIds.length ? linkedQuestionIds : question ? [question.id] : [],
    lensIds: (source.lensIds || inputLensIds(question, questions, lenses)).filter(Boolean),
    traceableSource: traceable,
    capturedAt: source.capturedAt,
    createdAt: new Date().toISOString(),
  };
}

function inputLensIds(question, questions, lenses) {
  if (!lenses.length) return [];
  const questionIndex = Math.max(0, questions.findIndex((item) => item.id === question?.id));
  return [lenses[questionIndex % lenses.length].id];
}

export function createHypotheses({ project = {}, brief = {}, questions = getResearchQuestions(brief, project) } = {}) {
  const assumptions = (brief.assumptions ?? []).map((item) => clean(item.label || item)).filter(Boolean);
  const fallback = [
    `如果围绕“${questions[0]?.label || "核心研究问题"}”成立，方案需要在真实使用情境中提供可被理解的线索。`,
    `如果围绕“${questions[1]?.label || questions[0]?.label || "第二个研究问题"}”成立，现有同类方案可能存在可被重新组织的体验机会。`,
  ];
  return unique([...assumptions, ...fallback]).slice(0, 4).map((label, index) => ({
    id: `${project.id || "project"}-hypothesis-${index + 1}`,
    label,
    status: "unverified",
    derivedFromQuestionIds: [questions[index % Math.max(1, questions.length)]?.id].filter(Boolean),
    whyItMatters: "它会影响后续设计方向，但当前不能当作已验证事实。",
    howToValidate: "补充带有原始记录、来源链接或用户材料的证据，并由你决定是否采纳。",
  }));
}

export function recomputeResearchWorkspace(workspace) {
  const evidence = workspace.evidence || [];
  const accepted = evidence.filter((item) => item.userStatus === "accepted" && item.type === "verified");
  const acceptedQuestionIds = new Set(accepted.flatMap((item) => item.questionIds || []));
  const acceptedSourceIds = new Set(accepted.map((item) => item.sourceId || sourceIdentity(item)));
  const coverage = (workspace.lenses || []).map((lens) => {
    const related = accepted.filter((item) => (item.lensIds || []).includes(lens.id));
    return { ...lens, acceptedEvidenceCount: related.length, status: related.length ? "covered" : "open" };
  });
  const insightGate = {
    acceptedEvidenceCount: accepted.length,
    questionCount: acceptedQuestionIds.size,
    sourceCount: acceptedSourceIds.size,
    ready: accepted.length >= 2 && acceptedQuestionIds.size >= 2 && acceptedSourceIds.size >= 2,
  };
  const researchSummary = accepted.length
    ? `已采纳 ${accepted.length} 条证据，覆盖 ${acceptedQuestionIds.size} 个研究问题、${acceptedSourceIds.size} 个独立来源。未被证据支持的判断仍保留为假设。`
    : "尚未有已采纳证据；当前页面只保留研究问题、用户材料和待验证假设。";
  return { ...workspace, coverage, insightGate, researchSummary, updatedAt: new Date().toISOString(), status: accepted.length ? "reviewing" : "collecting" };
}

export function updateResearchEvidence(workspace, evidenceId, patch = {}) {
  const evidence = (workspace.evidence || []).map((item) => item.id === evidenceId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
  return recomputeResearchWorkspace({ ...workspace, evidence });
}

export function acceptResearchEvidence(workspace, evidenceId) {
  const item = (workspace.evidence || []).find((evidence) => evidence.id === evidenceId);
  if (!item) return { ok: false, error: "EVIDENCE_NOT_FOUND" };
  if (item.contentStatus === "snippet") return { ok: false, error: "EVIDENCE_NEEDS_ORIGINAL_EXCERPT" };
  if (!hasTraceableSource(item) || !clean(item.originalExcerpt)) return { ok: false, error: "EVIDENCE_NEEDS_SOURCE" };
  return { ok: true, workspace: updateResearchEvidence(workspace, evidenceId, { type: "verified", verificationStatus: "verified", userStatus: "accepted", confidence: "medium" }) };
}

export function evidenceAction(workspace, evidenceId, action) {
  const patch = action === "reject" ? { userStatus: "rejected" } : action === "save" ? { userStatus: "saved" } : { userStatus: "unreviewed" };
  return updateResearchEvidence(workspace, evidenceId, patch);
}

export function researchQualityReview(workspace) {
  const errors = [];
  for (const item of workspace.evidence || []) {
    if (item.type === "verified" && (!hasTraceableSource(item) || !clean(item.originalExcerpt))) errors.push(`${item.id}: verified evidence has no traceable source`);
  }
  return { ok: errors.length === 0, errors };
}

export function researchSourceTypeLabel(type) {
  return sourceTypeLabel(type);
}
