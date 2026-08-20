const required = (value, code) => {
  if (!value) throw new Error(code);
  return value;
};

const unique = (items) => [...new Set(items)];

const addCompleted = (state, stage) => unique([...(state.completedStages ?? []), stage]);

const decision = (type, payload, at = new Date().toISOString()) => ({
  id: `${type.toLowerCase()}-${at}-${(payload.id ?? payload.reviewId ?? "decision").slice(-6)}`,
  type,
  at,
  ...payload,
});

export function getAvailableConcepts(industrial) {
  if (!industrial.selectedDirectionId) return [];
  return (industrial.conceptCandidates ?? []).filter((item) => item.directionId === industrial.selectedDirectionId);
}

export function buildDeterministicReview(industrial, at = new Date().toISOString()) {
  const direction = required(
    industrial.directions.find((item) => item.id === industrial.selectedDirectionId),
    "DIRECTION_NOT_SELECTED",
  );
  const concept = required(
    (industrial.conceptCandidates ?? []).find((item) => item.id === industrial.selectedConceptId),
    "CONCEPT_NOT_SELECTED",
  );
  const cmf = required(
    industrial.cmfSchemes.find((item) => item.id === industrial.selectedCMFId),
    "CMF_NOT_SELECTED",
  );
  if (concept.directionId !== direction.id) throw new Error("CONCEPT_DIRECTION_MISMATCH");

  const reviewId = `review-${direction.code}-${concept.code}-${cmf.code}`;
  const brief = industrial.brief ?? {};
  const primaryNeed = brief.keyNeeds?.[0] ?? "核心任务连续完成";
  const secondaryNeed = brief.keyNeeds?.[1] ?? "真实场景中的稳定与可维护";
  const unknownBoundary = brief.unknowns?.[0] ?? "关键结构与材料边界仍需样机验证";
  const category = brief.productCategory ?? "产品";
  return {
    id: reviewId,
    createdAt: at,
    mode: "deterministic-mock",
    context: {
      directionId: direction.id,
      direction: `${direction.code} · ${direction.name}`,
      conceptId: concept.id,
      concept: `${concept.code} · ${concept.name}`,
      cmfId: cmf.id,
      cmf: `${cmf.code} · ${cmf.name}`,
    },
    summary: `${concept.name}延续了${direction.name}的设计意图，${cmf.name}把${category}的触点与表面策略落到具体方案；当前最需要验证的是${unknownBoundary}。`,
    strengths: [
      { title: "决策链完整", evidence: `${direction.code} 方向、${concept.code} 概念与 ${cmf.code} CMF 均有上游证据。` },
      { title: "核心任务明确", evidence: `当前方案直接回应“${primaryNeed}”，并将其落到${direction.formLanguage}。` },
    ],
    issues: [
      {
        id: `${reviewId}-structure`,
        dimension: "feasibility",
        severity: "high",
        title: `${direction.name}的核心结构仍缺少工程验证`,
        evidence: concept.risks?.join("；") ?? "待补充风险",
        impact: `如果${primaryNeed}没有在真实姿态下成立，${category}的主要价值会被操作中断抵消。`,
        recommendation: `建立 1:1 结构样机，围绕${primaryNeed}与${secondaryNeed}验证连续操作、受力边界和误操作率。`,
        validationState: "TO_BE_VALIDATED",
        decision: "pending",
      },
      {
        id: `${reviewId}-cmf`,
        dimension: "cmf",
        severity: "medium",
        title: `${cmf.name}的材料边界与长期耐久性未证实`,
        evidence: cmf.parts.map((part) => `${part.part}: ${part.material}/${part.finish}`).join("；"),
        impact: `高频接触后若表面变化影响${secondaryNeed}，用户会难以判断产品是否仍然可靠。`,
        recommendation: `对主体、操作区与维护区分别进行清洁、摩擦、汗液或环境耐久测试，并保留可比对的样件记录。`,
        validationState: "AI_RECOMMENDATION",
        decision: "pending",
      },
      ...[
        ["brief", "Brief 边界需要继续冻结", `当前目标为“${brief.goal ?? primaryNeed}”。`, "目标边界漂移会让后续验证失去同一标准。", "确认不再改变的目标、用户与约束，并标记仍可调整项。", "medium"],
        ["evidence", "关键判断仍需补强来源", unknownBoundary, "如果证据只来自假设，方向选择可能被错误前提驱动。", "为关键设计规则补充一手观察或可追溯行业资料。", "medium"],
        ["direction", "方向规则需要落实到可检查条件", direction.formLanguage, "抽象方向无法约束概念和图片生成。", "把 mustKeep 与 mustAvoid 转成三条可观察的产品规则。", "low"],
        ["concept", "概念机制尚需任务级验证", concept.coreMechanism ?? concept.conceptStatement, "机制若不能缩短核心流程，概念只剩造型差异。", "用低保真结构样机完成一次从开始到复位的完整任务。", "high"],
        ["visual", "视觉基线需要核对产品一致性", industrial.selectedVisualId ?? "尚无视觉基线", "不一致的视觉会误导材料与结构决策。", "对四张视觉逐项核对比例、部件、交互和场景尺度。", "medium"],
        ["interaction", "交互反馈边界需要真实场景测试", secondaryNeed, "过强或过弱反馈都会破坏连续任务。", "在目标场景中测试可发现性、误触和恢复路径。", "medium"],
        ["risk", "最高风险尚未形成停止条件", concept.risks?.join("；") ?? "待补充风险", "没有停止条件时，团队容易把风险带入下一版本。", "定义进入下一版本前必须通过的单一验证门槛。", "high"],
      ].map(([dimension, title, evidence, impact, recommendation, severity], index) => ({ id: `${reviewId}-${dimension}-${index}`, dimension, severity, title, evidence, impact, recommendation, validationState: "TO_BE_VALIDATED", decision: "pending" })),
    ].sort((a, b) => ["brief", "evidence", "direction", "concept", "visual", "interaction", "cmf", "feasibility", "risk"].indexOf(a.dimension) - ["brief", "evidence", "direction", "concept", "visual", "interaction", "cmf", "feasibility", "risk"].indexOf(b.dimension)),
  };
}

export function transitionIndustrialState(industrial, event) {
  const at = event.at ?? new Date().toISOString();
  switch (event.type) {
    case "BRIEF_CONFIRMED":
      return {
        ...industrial,
        briefConfirmed: true,
        currentStage: "research",
        completedStages: addCompleted(industrial, "brief"),
        decisions: [...industrial.decisions, decision(event.type, { id: "brief", label: "确认工业设计 Brief" }, at)],
      };
    case "INSIGHT_TOGGLED": {
      required(industrial.briefConfirmed, "BRIEF_NOT_CONFIRMED");
      const exists = industrial.insights.some((item) => item.id === event.insightId);
      required(exists, "INSIGHT_NOT_FOUND");
      const selected = industrial.selectedInsightIds.includes(event.insightId)
        ? industrial.selectedInsightIds.filter((id) => id !== event.insightId)
        : [...industrial.selectedInsightIds, event.insightId];
      return { ...industrial, selectedInsightIds: selected, currentStage: "insight" };
    }
    case "INSIGHTS_CONFIRMED":
      required(industrial.selectedInsightIds.length > 0, "INSIGHT_NOT_SELECTED");
      return {
        ...industrial,
        currentStage: "direction",
        completedStages: addCompleted(industrial, "insight"),
        decisions: [...industrial.decisions, decision(event.type, { id: industrial.selectedInsightIds[0], insightIds: industrial.selectedInsightIds, label: "确认机会点" }, at)],
      };
    case "DIRECTION_LOCKED": {
      required(industrial.briefConfirmed, "BRIEF_NOT_CONFIRMED");
      required(industrial.selectedInsightIds.length > 0, "INSIGHT_NOT_SELECTED");
      const direction = required(industrial.directions.find((item) => item.id === event.directionId), "DIRECTION_NOT_FOUND");
      return {
        ...industrial,
        selectedDirectionId: direction.id,
        directionLocked: true,
        selectedConceptId: null,
        selectedVisualId: null,
        selectedCMFId: null,
        currentReviewId: null,
        currentStage: "concept",
        completedStages: addCompleted(industrial, "direction"),
        decisions: [...industrial.decisions, decision(event.type, { id: direction.id, label: `锁定方向 ${direction.code} · ${direction.name}` }, at)],
      };
    }
    case "CONCEPT_SELECTED": {
      required(industrial.directionLocked && industrial.selectedDirectionId, "DIRECTION_NOT_LOCKED");
      const concept = required((industrial.conceptCandidates ?? []).find((item) => item.id === event.conceptId), "CONCEPT_NOT_FOUND");
      if (concept.directionId !== industrial.selectedDirectionId) throw new Error("CONCEPT_DIRECTION_MISMATCH");
      const parentVersion = industrial.versionStory.at(-1) ?? null;
      return {
        ...industrial,
        selectedConceptId: concept.id,
        selectedVisualId: null,
        selectedCMFId: null,
        currentReviewId: null,
        currentStage: "concept",
        versionStory: [...industrial.versionStory, { id: `concept-${concept.id}-${at}`, number: industrial.versionStory.length + 1, parentVersionId: parentVersion?.id ?? null, label: `概念基线 · ${concept.name}`, image: null, whatChanged: "从三条概念候选中确认唯一概念基线。", why: concept.whyFitsDirection, reviewTrigger: "概念选择", retained: ["已确认的设计方向与证据链"], nextValidation: concept.validationQuestions ?? ["验证概念机制是否能支持核心任务"], contentOrigin: concept.contentOrigin ?? "user" }],
        decisions: [...industrial.decisions, decision(event.type, { id: concept.id, label: `选择概念 ${concept.code} · ${concept.name}` }, at)],
      };
    }
    case "VISUAL_SELECTED": {
      required(industrial.selectedConceptId, "CONCEPT_NOT_SELECTED");
      const visual = required((industrial.generatedVisuals ?? []).find((item) => item.id === event.visualId), "VISUAL_NOT_FOUND");
      if (visual.conceptId !== industrial.selectedConceptId) throw new Error("VISUAL_CONCEPT_MISMATCH");
      const visualLabel = visual.variation ?? visual.variant ?? "演示视觉";
      const visualImage = visual.imageUrl ?? visual.imagePath ?? visual.image ?? null;
      const parentVersion = industrial.versionStory.at(-1) ?? null;
      return {
        ...industrial,
        selectedVisualId: visual.id,
        currentStage: "cmf",
        completedStages: addCompleted(industrial, "concept"),
        versionStory: [...industrial.versionStory, { id: `visual-${visual.id}-${at}`, number: industrial.versionStory.length + 1, parentVersionId: parentVersion?.id ?? null, label: `视觉基线 · ${visualLabel}`, image: visualImage, whatChanged: "从与当前概念绑定的视觉中确认用于 CMF 与评审的视觉基线。", why: "让后续材料、颜色和受控编辑继承同一产品身份。", reviewTrigger: "概念视觉选择", retained: ["概念机制、产品身份与方向规则"], nextValidation: ["核对视觉比例、结构与场景尺度"], contentOrigin: visual.contentOrigin ?? (visual.visualMode === "demo-asset" ? "demo_seed" : "real_ai") }],
        decisions: [...industrial.decisions, decision(event.type, { id: visual.id, conceptId: visual.conceptId, label: `选择视觉 ${visualLabel}` }, at)],
      };
    }
    case "CMF_SELECTED": {
      required(industrial.selectedConceptId, "CONCEPT_NOT_SELECTED");
      const cmf = required(industrial.cmfSchemes.find((item) => item.id === event.cmfId), "CMF_NOT_FOUND");
      return {
        ...industrial,
        selectedCMFId: cmf.id,
        currentReviewId: null,
        currentStage: "review",
        completedStages: addCompleted(industrial, "cmf"),
        decisions: [...industrial.decisions, decision(event.type, { id: cmf.id, label: `选择 CMF ${cmf.code} · ${cmf.name}` }, at)],
      };
    }
    case "REVIEW_CREATED": {
      const review = event.review ?? buildDeterministicReview(industrial, at);
      return {
        ...industrial,
        reviews: [...industrial.reviews.filter((item) => item.id !== review.id), review],
        currentReviewId: review.id,
        currentStage: "review",
        completedStages: addCompleted(industrial, "review"),
        decisions: [...industrial.decisions, decision(event.type, { id: review.id, reviewId: review.id, label: "完成证据化 Review" }, at)],
      };
    }
    case "REVISION_CREATED": {
      required(industrial.currentReviewId, "REVIEW_NOT_CREATED");
      required(event.versionId, "VERSION_ID_REQUIRED");
      const review = industrial.reviews.find((item) => item.id === industrial.currentReviewId);
      const issue = review?.issues.find((item) => item.id === event.issueId) ?? review?.issues[0];
      const parentVersion = industrial.versionStory.at(-1) ?? null;
      return {
        ...industrial,
        currentVersionId: event.versionId,
        currentStage: "versions",
        completedStages: unique([...addCompleted(industrial, "versions"), "decision-map"]),
        versionStory: [...industrial.versionStory, {
          id: event.versionId,
          number: Math.max(0, ...industrial.versionStory.map((item) => Number(item.number)).filter(Number.isFinite)) + 1,
          parentVersionId: parentVersion?.id ?? null,
          label: "Review 后结构验证版",
          image: event.image ?? null,
          whatChanged: issue?.recommendation ?? "依据评审意见建立下一轮验证版本。",
          why: issue?.impact ?? "让风险进入可追踪的设计迭代。",
          reviewTrigger: issue?.title ?? "评审问题",
          retained: event.retained ?? ["已确认的概念、CMF 与上游证据"],
          nextValidation: event.nextValidation ?? ["完成评审建议对应的样机或对比测试"],
          contentOrigin: event.contentOrigin ?? "user",
        }],
        decisions: [...industrial.decisions, decision(event.type, { id: event.versionId, issueId: issue?.id, label: "采纳评审意见并创建新版本" }, at)],
      };
    }
    default:
      throw new Error(`UNKNOWN_INDUSTRIAL_EVENT:${event.type}`);
  }
}

export function buildIndustrialExport(project) {
  const industrial = required(project?.industrial, "INDUSTRIAL_STATE_MISSING");
  const direction = industrial.directions.find((item) => item.id === industrial.selectedDirectionId) ?? null;
  const concept = (industrial.conceptCandidates ?? []).find((item) => item.id === industrial.selectedConceptId) ?? null;
  const cmf = industrial.cmfSchemes.find((item) => item.id === industrial.selectedCMFId) ?? null;
  const review = industrial.reviews.find((item) => item.id === industrial.currentReviewId) ?? null;
  return {
    schema: "muse-industrial-export/v1",
    generatedAt: new Date().toISOString(),
    project: { id: project.id, name: project.name, description: project.description },
    brief: industrial.brief,
    evidence: industrial.evidence,
    insights: industrial.insights.filter((item) => industrial.selectedInsightIds.includes(item.id)),
    direction,
    concept,
    cmf,
    review,
    versions: industrial.versionStory,
    decisions: industrial.decisions,
    validationBoundary: "本包为可交互 Prototype；结构、材料、UV-C 安全与制造结论仍需工程验证。",
  };
}
