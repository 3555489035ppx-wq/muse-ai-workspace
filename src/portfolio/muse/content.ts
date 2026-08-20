export const productScreens = {
  overview: "/portfolio/muse/screens/01-overview.png",
  brief: "/portfolio/muse/screens/02-brief.png",
  evidence: "/portfolio/muse/screens/03-evidence.png",
  insight: "/portfolio/muse/screens/04-insight.png",
  direction: "/portfolio/muse/screens/05-direction.png",
  concept: "/portfolio/muse/screens/06-concept.png",
  material: "/portfolio/muse/screens/07-material.png",
  review: "/portfolio/muse/screens/08-review.png",
  version: "/portfolio/muse/screens/09-version.png",
  decisionMap: "/portfolio/muse/screens/10-decision-map.png",
} as const;

export const workflow = [
  { number: "01", title: "Frame", zh: "定义问题", copy: "把模糊需求转成可验证的设计目标。" },
  { number: "02", title: "Ground", zh: "建立证据", copy: "从用户、竞品与约束中提取可追溯依据。" },
  { number: "03", title: "Direct", zh: "形成方向", copy: "让 AI 生成可比较、有取舍的策略方向。" },
  { number: "04", title: "Make", zh: "推进概念", copy: "把方向转换为概念、CMF 与视觉探索。" },
  { number: "05", title: "Decide", zh: "评审决策", copy: "保留版本差异、评审依据与最终决定。" },
] as const;
export const aiFlow = [
  ["Input", "项目 Brief、研究证据、设计约束"],
  ["Context", "当前阶段、上游决策、已确认与已否定项"],
  ["Processing", "归类证据、发现模式、比较策略差异"],
  ["Output", "结构化 Insight、Direction、Review 建议"],
  ["Interaction", "编辑、引用、拒绝、重生成、锁定"],
  ["State", "空、处理中、结果不足、成功、失败"],
  ["Persistence", "保存到项目记录并关联来源"],
  ["Next Step", "将确认结果传入下一阶段"],
  ["Human-in-the-loop", "方向选择与最终版本始终由设计师确认"],
] as const;

export const iterations = [
  {
    issue: "AI 长文看似完整，却难以快速判断。",
    change: "将输出拆成信号、依据、机会与风险四类短卡。",
    effect: "设计师可以扫描、比较，并逐条确认。",
  },
  {
    issue: "Evidence 与 Direction 之间缺少可见关系。",
    change: "建立 Evidence → Insight → Direction 引用链。",
    effect: "每个策略结论都能回到它的来源。",
  },
  {
    issue: "三条方向只有标题不同，实质差异不足。",
    change: "为每条方向补充 Strategic Difference 与 Trade-off。",
    effect: "评审从偏好讨论转向可解释的取舍。",
  },
] as const;

export const showreelTimeline = [
  { start: 0, end: 4, key: "logo", label: "Muse", screen: productScreens.overview },
  { start: 4, end: 10, key: "problem", label: "创意工作不是缺少灵感，而是缺少连续的决策上下文。", screen: productScreens.brief },
  { start: 10, end: 18, key: "evidence", label: "Ground the work", screen: productScreens.evidence },
  { start: 18, end: 25, key: "insight", label: "Turn signals into insight", screen: productScreens.insight },
  { start: 25, end: 36, key: "direction", label: "Compare directions, not adjectives", screen: productScreens.direction },
  { start: 36, end: 44, key: "concept", label: "Move from strategy to form", screen: productScreens.concept },
  { start: 44, end: 50, key: "review", label: "Keep critique attached to the work", screen: productScreens.review },
  { start: 50, end: 56, key: "map", label: "One traceable decision system", screen: productScreens.decisionMap },
  { start: 56, end: 60, key: "end", label: "Muse — context for creative decisions", screen: productScreens.overview },
] as const;
