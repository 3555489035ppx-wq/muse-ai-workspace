import { buildConfirmedDesignBriefContext, getAcceptedResearchEvidence } from "./designInsightProvider.js";

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = (items = []) => [...new Set(items.map(clean).filter(Boolean))];
const clip = (value, max = 220) => {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};
const labels = (items = []) => items.map((item) => clean(item?.label ?? item)).filter(Boolean);
const arrayOf = (value) => Array.isArray(value) ? value.map(clean).filter(Boolean) : value ? [clean(value)] : [];

const POLLUTED_TERMS = /Moodboard|Creative Direction|Image Generation|AI Critique|prompt|Prompt|图像生成|视觉生成|生成图片|图片生成/i;
const MIXED_FORBIDDEN_TERMS = /产品功能|产品形态|产品结构|结构工程|维护|耐久|受力|量产|模具|高频接触|连续操作|单手操作|材料耐久|滤芯|进风|抽屉|承重/;

const DOMAIN_LABELS = {
  mixed_brand_spatial: "品牌与空间",
  brand_design: "品牌设计",
  spatial_design: "空间设计",
  industrial_design: "工业设计",
  product_design: "产品设计",
  uiux: "UI/UX",
  general_design: "综合设计",
};

const DOMAIN_LANES = {
  mixed_brand_spatial: [
    {
      strategyKey: "cultural-process",
      name: "过程成义",
      subtitle: "让文化来源通过可参与的过程被理解",
      keywords: ["文化来源", "参与过程", "品牌记忆"],
      strategicIdea: "把文化来源转译成用户能够进入、停留、参与和复述的体验次序，让品牌价值通过行为被记住。",
      brandLogic: "品牌不靠符号单独解释自己，而是通过一次可复述的体验过程建立识别。",
      culturalLogic: "保留来源中的真实线索，同时把解释权交给用户的参与和分享。",
      visualLogic: "视觉语言围绕过程节点建立层级，避免把文化压缩成装饰图案。",
      spatialLogic: "入口、参与、停留和离开形成一条有节奏的体验路径。",
      experienceLogic: "用户在关键节点做出选择，并在结束时带走一个能够复述的记忆点。",
      interactionLogic: "用轻量提示引导参与，不把用户变成被动阅读者。",
      formLogic: "空间与触点保持开放、可进入、可停留的关系，不追求孤立的造型中心。",
      materialLogic: "材料只承担触感、光线和氛围的层次，所有差异都要服务于体验节点。",
      advantages: ["文化来源能被真实体验，而不是停留在说明文字", "品牌与空间拥有共同的叙事规则"],
      tradeoffs: ["体验设计需要更完整的现场编排", "传播效果依赖用户是否愿意复述"],
      risks: ["参与路径过长会削弱即时理解", "文化表达可能被简化成一次性活动"],
      validationQuestions: ["用户能否说出自己经历的关键节点？", "离开后是否仍能复述品牌与文化的关系？"],
      successSignals: ["关键节点被主动参与", "用户能够用自己的话复述体验"],
      mustKeep: ["来源可追溯", "过程可参与", "记忆点可复述"],
      mustAvoid: ["只靠符号装饰", "把文化解释写成单向说明", "脱离场景的漂亮画面"],
    },
    {
      strategyKey: "city-rhythm",
      name: "时序共振",
      subtitle: "让品牌体验和城市生活的时间感同频",
      keywords: ["城市节奏", "时间层次", "再访理由"],
      strategicIdea: "根据用户在城市中的进入、等待、停留和离开建立体验节奏，使品牌在日常流动中被自然识别。",
      brandLogic: "品牌以稳定的节奏和回应方式被识别，而不是依赖一次强烈的视觉冲击。",
      culturalLogic: "把文化来源放进当代城市时间里，让传统与今天的使用方式发生联系。",
      visualLogic: "用克制的层次和留白表达时间变化，保持识别线索在不同节奏中连续。",
      spatialLogic: "不同停留时长对应不同的空间密度，用户可以自然选择自己的节奏。",
      experienceLogic: "短暂停留也能完成理解，深度停留则获得更多可探索内容。",
      interactionLogic: "信息在用户需要时出现，不用持续提示打断行走和交流。",
      formLogic: "空间节点保持可见的方向关系，让城市流动和停留可以同时成立。",
      materialLogic: "表面与光线根据时间层次产生微妙变化，不用高饱和颜色制造差异。",
      advantages: ["适配城市用户不同的停留时长", "能把一次访问延展成长期再访关系"],
      tradeoffs: ["需要处理多种时间状态", "即时传播的冲击力不会特别强"],
      risks: ["节奏过于含蓄导致用户错过重点", "不同节点之间的识别线索可能不够连续"],
      validationQuestions: ["用户在短暂停留时能否理解核心价值？", "不同停留时长是否都能获得完整体验？"],
      successSignals: ["短停用户完成核心理解", "长停用户主动探索并愿意再次到访"],
      mustKeep: ["不同停留时长都可成立", "城市流动中的识别连续性", "节奏克制"],
      mustAvoid: ["把所有人带入同一种节奏", "用持续提示制造紧迫感", "只服务拍照传播"],
    },
    {
      strategyKey: "ritual-participation",
      name: "共同动作",
      subtitle: "把一次使用变成可记住的共同动作",
      keywords: ["参与仪式", "共同记忆", "行为线索"],
      strategicIdea: "从用户真实的动作和社交关系中提炼一个轻量仪式，让体验具有开始、进行和结束的完整感。",
      brandLogic: "品牌主张通过共同动作被感知，用户既是参与者也是故事的讲述者。",
      culturalLogic: "不复制传统形式，而是保留其中的关系、节奏和分享价值。",
      visualLogic: "用动作前后的状态差异建立视觉记忆，而不是铺满文化符号。",
      spatialLogic: "围绕共同动作安排相遇、观看和参与的位置关系。",
      experienceLogic: "每一次参与都包含清楚的开始信号、过程反馈和结束回收。",
      interactionLogic: "提示只在动作转折处出现，让用户通过行为理解规则。",
      formLogic: "空间触点鼓励面对面关系和共同观看，而不是把用户分散成独立个体。",
      materialLogic: "触点材质承担温度、声音和手感的变化，强化动作的记忆。",
      advantages: ["用户参与本身成为品牌资产", "体验容易形成口头传播和共同记忆"],
      tradeoffs: ["依赖现场关系和参与意愿", "需要为不同社交距离准备替代路径"],
      risks: ["仪式感过强会让用户觉得被要求表演", "参与规则不清会带来尴尬和退场"],
      validationQuestions: ["用户是否愿意自然加入，而不是被迫完成动作？", "独自到访和结伴到访是否都能成立？"],
      successSignals: ["参与动作被自发重复", "用户主动向同行者解释体验"],
      mustKeep: ["自愿参与", "开始与结束清楚", "独处和结伴都可成立"],
      mustAvoid: ["强迫用户表演", "复杂规则", "脱离真实场景的互动装置"],
    },
    {
      strategyKey: "soft-touchpoints",
      name: "柔性触点",
      subtitle: "让每一次接触都回应用户当下的状态",
      keywords: ["柔性回应", "低打扰", "关系温度"],
      strategicIdea: "把用户的情绪、注意力和空间关系放进体验判断，让触点以低打扰方式回应而不是主动抢夺注意力。",
      brandLogic: "品牌通过稳定、体贴且不过度热情的回应建立可信度。",
      culturalLogic: "文化价值以待人方式和空间分寸出现，而不是只以内容出现。",
      visualLogic: "视觉层级保持安静，通过近距离细节而不是远距离冲击传递质感。",
      spatialLogic: "空间给用户保留退让、观察和重新加入的余地。",
      experienceLogic: "不同注意力状态下，用户都能找到不被催促的下一步。",
      interactionLogic: "把反馈分成可见、可听和可触的轻量层级，避免一刀切。",
      formLogic: "触点边界清楚但不强势，让使用动作自然融入场景。",
      materialLogic: "材料通过温度、纹理和反射控制接触距离与氛围。",
      advantages: ["更适合长期关系和低打扰场景", "体验的情绪质量更稳定"],
      tradeoffs: ["需要更细腻的状态判断", "远距离识别可能不如强视觉策略直接"],
      risks: ["反馈过弱导致用户不确定", "安静语言可能被误读成缺少内容"],
      validationQuestions: ["用户能否在不被催促的情况下找到下一步？", "低打扰是否仍然保持状态清楚？"],
      successSignals: ["用户少被打断但仍能完成路径", "不同情绪状态下的满意度差异缩小"],
      mustKeep: ["低打扰", "状态清楚", "允许退让与重新加入"],
      mustAvoid: ["无差别的高强度反馈", "把安静误解成空白", "只为远景展示设计"],
    },
    {
      strategyKey: "shared-language",
      name: "同频识别",
      subtitle: "让品牌、空间和传播共享一套体验语法",
      strategicIdea: "先建立跨触点可复用的体验语法，再把它分别落到空间、服务和传播中，形成稳定而不重复的识别。",
      brandLogic: "品牌识别来自一套可执行的行为规则，而不只是标志和配色。",
      culturalLogic: "文化线索在不同触点中保持来源一致，但根据场景改变表达强度。",
      visualLogic: "视觉系统以层级、节奏和关系为核心，避免每个画面各自漂亮。",
      spatialLogic: "空间节点用同一套进入、停留和离开语法彼此呼应。",
      experienceLogic: "用户在不同触点都能感到熟悉，但不会觉得重复播放同一页。",
      interactionLogic: "同一动作在不同触点拥有一致的反馈含义，降低重新理解成本。",
      formLogic: "形式服从体验语法，重点是关系的连续而不是单一中心造型。",
      materialLogic: "材料差异服务于距离、氛围和触点等级，并保持品牌气质一致。",
      advantages: ["便于形成可持续的品牌与空间系统", "不同触点之间的体验更完整"],
      tradeoffs: ["前期需要先定义共用规则", "局部自由度会受到系统约束"],
      risks: ["规则过多会让体验失去自然感", "跨触点执行不一致会放大割裂"],
      validationQuestions: ["用户能否在不同触点识别出同一品牌关系？", "共用规则是否仍允许场景差异？"],
      successSignals: ["跨触点识别稳定", "用户不依赖标志也能感到关系连续"],
      mustKeep: ["一套共用体验语法", "场景差异", "规则可被执行"],
      mustAvoid: ["每个触点独立换风格", "把系统做成僵硬模板", "只检查视觉相似度"],
    },
  ],
  industrial_design: [
    {
      strategyKey: "task-clarity",
      name: "路径清晰",
      subtitle: "让关键任务一眼可读",
      keywords: ["任务路径", "快速理解", "状态清楚"],
      strategicIdea: "把用户的核心任务拆成可读的开始、进行和收尾关系，让形体、操作区与反馈共同说明下一步。",
      formLogic: "以方向明确的分区和边界组织使用关系，减少首次判断成本。",
      interactionLogic: "关键动作保持前后连贯，状态变化在动作附近被理解。",
      materialLogic: "不同接触风险使用可区分的触感和表面处理，不靠颜色单独解释。",
      advantages: ["首次使用容易上手", "错误路径更容易被发现"],
      tradeoffs: ["形体层级会更明确", "需要克制不必要的功能暴露"],
      risks: ["过度显性会增加视觉噪声", "复杂场景可能需要额外验证"],
      validationQuestions: ["用户能否在没有说明书时完成核心任务？", "错误操作是否能被及时察觉？"],
      successSignals: ["首次完成时间下降", "路径中断减少"],
      mustKeep: ["任务顺序可读", "状态反馈靠近动作", "接触差异真实有效"],
      mustAvoid: ["只用颜色区分风险", "把所有功能都外露", "脱离任务的造型变化"],
    },
    {
      strategyKey: "touchpoint-layering",
      name: "触点分层",
      subtitle: "用真实接触关系组织形体与材料",
      keywords: ["触点分层", "握持关系", "清洁边界"],
      strategicIdea: "根据握持、取用、清洁和放置等不同接触关系安排形体与材料，使每个区域都有可验证的理由。",
      formLogic: "主体、操作区和维护区拥有清楚但连续的几何关系。",
      interactionLogic: "高频动作使用稳定且可预测的接触路径。",
      materialLogic: "表面处理对应触点风险、清洁方式和长期变化，颜色只做辅助标记。",
      advantages: ["CMF 与使用逻辑一致", "便于形成样件验证计划"],
      tradeoffs: ["材料和工艺决策更早进入项目", "整体语言需要更多协调"],
      risks: ["分区过多导致形体碎片化", "触点差异无法被用户感知"],
      validationQuestions: ["用户是否能感知不同区域的接触意图？", "清洁和握持是否在同一条路径中成立？"],
      successSignals: ["接触误判减少", "清洁完成率提升"],
      mustKeep: ["接触理由清楚", "材料差异可验证", "边界连续"],
      mustAvoid: ["用装饰色假装材料差异", "没有任务依据的纹理", "忽略清洁边界"],
    },
    {
      strategyKey: "continuity-first",
      name: "持续使用",
      subtitle: "把长期使用成本前置为设计判断",
      keywords: ["长期使用", "复位路径", "清洁可达"],
      strategicIdea: "围绕用户会反复完成的取用、复位和清洁路径做设计，让第一次吸引转化为长期可靠。",
      formLogic: "高频关系保持稳定，容易被重新找到和复位。",
      interactionLogic: "反馈减少记忆负担，帮助用户恢复被打断的动作。",
      materialLogic: "高接触区域优先验证清洁、摩擦与外观变化。",
      advantages: ["更接近真实长期价值", "可直接形成验证指标"],
      tradeoffs: ["短期视觉惊喜让位于稳定体验", "需要投入更多样机测试"],
      risks: ["验证周期较长", "边界处理不当会影响整体美感"],
      validationQuestions: ["用户在一周后还能否自然复位？", "重复清洁后触点是否仍然可靠？"],
      successSignals: ["重复任务完成率稳定", "维护动作被及时完成"],
      mustKeep: ["复位可读", "清洁可达", "高频触点可验证"],
      mustAvoid: ["只验证一次的新鲜感", "把维护留到最后", "用外观遮蔽长期风险"],
    },
    {
      strategyKey: "state-legibility",
      name: "状态自明",
      subtitle: "让产品状态在环境里保持可判断",
      strategicIdea: "把关键状态、边界和反馈组织到用户能快速确认的位置，减少猜测和重复试错。",
      formLogic: "状态相关区域保持明确的视线和接触关系。",
      interactionLogic: "反馈按风险和情境分级，重要变化先被看懂再被提醒。",
      materialLogic: "状态区与主体通过表面、光泽或触感建立稳定区别。",
      advantages: ["降低不确定感", "适合复杂状态下的快速判断"],
      tradeoffs: ["需要处理不同光线与距离", "状态语言不能过度依赖显示屏"],
      risks: ["反馈层级过多", "环境变化造成误读"],
      validationQuestions: ["用户能否在不同光线下判断关键状态？", "反馈是否会打断核心动作？"],
      successSignals: ["状态误读下降", "重复确认动作减少"],
      mustKeep: ["风险分级", "状态位置稳定", "环境适应"],
      mustAvoid: ["所有状态同样强", "只用复杂图标解释", "忽视夜间与移动场景"],
    },
    {
      strategyKey: "robust-support",
      name: "稳健承托",
      subtitle: "让移动、放置与使用关系更有把握",
      keywords: ["放置稳定", "移动关系", "边界可信"],
      strategicIdea: "从用户移动、放置和再次取用的真实过程出发，建立一套让产品看起来和用起来都更可靠的关系。",
      formLogic: "重心、边界和受手位置共同表达稳定与可控。",
      interactionLogic: "移动前后的状态衔接清楚，减少重新寻找动作。",
      materialLogic: "接触面和易碰区域采用可验证的防滑与抗污策略。",
      advantages: ["移动场景的信任感更强", "结构验证目标清楚"],
      tradeoffs: ["体积和重量可能需要让步", "外观会更强调稳定关系"],
      risks: ["过度承托导致笨重", "稳定与便携之间出现冲突"],
      validationQuestions: ["用户能否在移动后快速恢复使用？", "不同放置面是否保持稳定？"],
      successSignals: ["移动后的重新使用更快", "放置倾斜与滑移减少"],
      mustKeep: ["重心可理解", "接触面可信", "移动前后连续"],
      mustAvoid: ["只靠加重解决稳定", "忽视收纳关系", "用造型掩盖边界风险"],
    },
  ],
  uiux: [
    {
      strategyKey: "progressive-path",
      name: "渐进路径",
      subtitle: "让用户只在需要时看到下一步",
      keywords: ["渐进披露", "任务路径", "低认知负担"],
      strategicIdea: "把复杂任务拆成可回看的连续步骤，让用户在当前上下文中只处理下一项判断。",
      interactionLogic: "每一步都说明当前状态、下一步和返回路径。",
      experienceLogic: "用户可中断、恢复并确认已经完成的部分。",
      visualLogic: "层级服务于任务，而不是把所有选项同时推到前台。",
      advantages: ["降低首次理解成本", "适合复杂任务逐步完成"],
      tradeoffs: ["高级功能需要多一步进入", "需要设计清楚的回退与恢复"],
      risks: ["用户可能找不到隐藏功能", "路径过长会带来疲劳"],
      validationQuestions: ["用户能否在每一步说出下一步？", "中断后能否准确恢复？"],
      successSignals: ["首次任务完成率提升", "回退后重复输入减少"],
      mustKeep: ["当前状态清楚", "下一步可预期", "随时可回退"],
      mustAvoid: ["一次展示所有选项", "隐藏关键状态", "用装饰动画替代反馈"],
    },
    {
      strategyKey: "feedback-trust",
      name: "反馈可信",
      subtitle: "让系统回应与用户动作保持一致",
      keywords: ["即时反馈", "状态可信", "错误恢复"],
      strategicIdea: "让每个关键动作都得到可理解、可验证且可恢复的回应，建立用户对系统状态的信任。",
      interactionLogic: "反馈紧跟动作出现，成功、失败和处理中使用不同的语义。",
      experienceLogic: "用户知道系统做了什么，也知道下一步可以如何修正。",
      visualLogic: "状态颜色和层级保持稳定，不用高强度效果制造注意力。",
      advantages: ["减少重复点击和猜测", "更适合需要确认的任务"],
      tradeoffs: ["需要补齐异常与处理中状态", "视觉系统需要长期一致"],
      risks: ["反馈过多带来噪声", "网络延迟会暴露系统不确定性"],
      validationQuestions: ["用户能否区分处理中、成功和失败？", "失败后是否能快速恢复？"],
      successSignals: ["重复点击下降", "错误恢复时间缩短"],
      mustKeep: ["状态有语义", "错误可恢复", "反馈靠近动作"],
      mustAvoid: ["永远成功的假反馈", "只用颜色表示状态", "没有恢复路径"],
    },
    {
      strategyKey: "contextual-control",
      name: "情境控制",
      subtitle: "让控制权随场景变化",
      keywords: ["情境控制", "权限边界", "可解释设置"],
      strategicIdea: "根据用户的任务、角色和场景呈现合适的控制权，避免把复杂设置交给不需要它的人。",
      interactionLogic: "高级控制在需要时出现，并解释它会改变什么。",
      experienceLogic: "用户可以保留默认路径，也能在有理由时进入更深层设置。",
      visualLogic: "控制层级清楚，默认状态不被高级选项打断。",
      advantages: ["兼顾简单入口与专业能力", "更容易建立可解释的权限边界"],
      tradeoffs: ["需要处理角色与状态组合", "设置结构不能只靠菜单堆叠"],
      risks: ["用户不知道控制权为何变化", "过度自动化造成不信任"],
      validationQuestions: ["用户是否知道为什么看见这些控制？", "默认路径能否覆盖大多数任务？"],
      successSignals: ["无关设置进入率下降", "高级设置成功率提升"],
      mustKeep: ["默认路径明确", "控制变化可解释", "权限可回退"],
      mustAvoid: ["把复杂设置全放首屏", "隐式改变用户选择", "用黑箱自动化替代确认"],
    },
    {
      strategyKey: "continuity-memory",
      name: "连续记忆",
      subtitle: "让系统替用户记住过程",
      keywords: ["过程记忆", "恢复任务", "跨页面连续"],
      strategicIdea: "把用户已经完成、正在进行和下一步要做的事保持在同一条可回看的关系里，减少重新解释。",
      interactionLogic: "已完成内容、当前进度和可继续入口保持一致。",
      experienceLogic: "跨页面或跨时段回来时，用户能够快速恢复上下文。",
      visualLogic: "层级优先表达关系和进度，不让状态被卡片装饰淹没。",
      advantages: ["降低重复输入", "适合多阶段项目和长期任务"],
      tradeoffs: ["需要处理过期信息", "上下文保留会带来更多数据状态"],
      risks: ["错误记忆会误导下一步", "信息太多造成负担"],
      validationQuestions: ["用户回来后能否在几秒内恢复任务？", "过期上下文是否会被及时提示？"],
      successSignals: ["恢复任务成功率提升", "重复阅读与重新输入减少"],
      mustKeep: ["过程可回看", "过期可识别", "下一步可继续"],
      mustAvoid: ["无解释地保存全部内容", "把历史当成当前状态", "强迫用户从头开始"],
    },
  ],
};

function domainMode(project = {}) {
  const brief = project.designBrief ?? {};
  return brief.domain?.mode || brief.domain?.primary || (project.productDiscipline === "industrial" ? "industrial_design" : "general_design");
}

function getConfirmedDesignInsights(project = {}) {
  const selected = new Set(project.confirmedInsightIds ?? project.industrial?.selectedInsightIds ?? []);
  return (project.designInsights ?? []).filter((item) => selected.has(item.id) && item.status !== "rejected");
}

function evidenceText(item) {
  return [item.title, item.originalExcerpt, item.interpretation, item.designImplication, item.sourceName].map(clean).filter(Boolean).join(" ");
}

function signalFrom(context) {
  return context.confirmedInsights[0]?.designImplication
    || context.acceptedEvidence[0]?.designImplication
    || context.designObjective
    || context.coreDesignQuestion
    || "当前项目需要被验证的核心关系";
}

function buildDirectionContextRaw(project = {}) {
  const brief = project.designBrief ?? {};
  const acceptedEvidence = getAcceptedResearchEvidence(project);
  const confirmedInsights = getConfirmedDesignInsights(project);
  const base = buildConfirmedDesignBriefContext(project);
  const context = {
    projectId: project.id,
    projectName: clean(project.name),
    domain: {
      mode: domainMode(project),
      primary: brief.domain?.primary || domainMode(project),
      secondary: brief.domain?.secondary || null,
      label: DOMAIN_LABELS[domainMode(project)] || "综合设计",
    },
    coreDesignQuestion: base.coreDesignQuestion,
    designObjective: base.designObjective,
    coreTension: base.coreTension,
    targetUser: base.targetUser,
    coreScenario: base.scenario,
    designRequirements: base.designRequirements,
    designConstants: labels(brief.designConstants).slice(0, 8).map((item) => clip(item, 120)),
    designExclusions: base.exclusions,
    successCriteria: base.successCriteria,
    acceptedEvidence: acceptedEvidence.map((item) => ({
      id: item.id,
      title: clip(item.title, 100),
      sourceName: clip(item.sourceName, 90),
      originalExcerpt: clip(item.originalExcerpt, 260),
      interpretation: clip(item.interpretation, 220),
      designImplication: clip(item.designImplication, 220),
      questionIds: item.questionIds ?? [],
      lensIds: item.lensIds ?? [],
    })),
    confirmedInsights: confirmedInsights.map((item) => ({
      id: item.id,
      title: clip(item.title, 100),
      insightStatement: clip(item.insightStatement, 240),
      whyItMatters: clip(item.whyItMatters, 220),
      designImplication: clip(item.designImplication, 220),
      evidenceIds: item.evidenceIds ?? [],
    })),
  };
  return context;
}

function signatureFor(context) {
  return JSON.stringify({
    projectId: context.projectId,
    domain: context.domain,
    coreDesignQuestion: context.coreDesignQuestion,
    designObjective: context.designObjective,
    coreTension: context.coreTension,
    targetUser: context.targetUser,
    coreScenario: context.coreScenario,
    designRequirements: context.designRequirements,
    designConstants: context.designConstants,
    designExclusions: context.designExclusions,
    successCriteria: context.successCriteria,
    acceptedEvidence: context.acceptedEvidence.map(({ id, title, originalExcerpt, interpretation, designImplication }) => ({ id, title, originalExcerpt, interpretation, designImplication })),
    confirmedInsights: context.confirmedInsights,
  });
}

function directionText(direction) {
  return [direction.name, direction.thesis, direction.strategicIdea, direction.userValue, direction.brandLogic, direction.culturalLogic, direction.visualLogic, direction.spatialLogic, direction.experienceLogic, direction.interactionLogic, direction.formLogic, direction.materialLogic, ...direction.advantages, ...direction.tradeoffs, ...direction.risks, ...direction.validationQuestions, ...direction.successSignals, ...direction.mustKeep, ...direction.mustAvoid].filter(Boolean).join(" ");
}

function supportLevel(context, direction) {
  if (context.acceptedEvidence.length >= 2 && direction.insightIds.length) return "supported";
  if (context.acceptedEvidence.length || direction.insightIds.length) return "partial";
  return "preliminary";
}

function contextUsesTea(context) {
  return /茶|冲泡|茶底|DAYTIDE|昼汐/iu.test([
    context.projectName,
    context.designObjective,
    context.coreScenario,
    ...context.acceptedEvidence.map((item) => `${item.title} ${item.originalExcerpt}`),
    ...context.confirmedInsights.map((item) => `${item.title} ${item.insightStatement}`),
  ].join(" "));
}

function tailorLane(lane, context) {
  if (context.domain.mode !== "mixed_brand_spatial" || !contextUsesTea(context)) return lane;
  const copy = {
    "cultural-process": { name: "一杯茶的仪式", subtitle: "从茶底与冲泡过程建立当代文化联系", keywords: ["茶底来源", "冲泡过程", "可复述记忆"] },
    "city-rhythm": { name: "城市潮汐", subtitle: "用通勤、午后与社交三种节奏组织快闪体验", keywords: ["城市时段", "分层停留", "再访理由"] },
    "ritual-participation": { name: "茶的时间", subtitle: "把等待转化为用户可参与的品牌时间", keywords: ["时间可见", "轻量参与", "共同动作"] },
  };
  return copy[lane.strategyKey] ? { ...lane, ...copy[lane.strategyKey] } : lane;
}

function extraLanes(mode) {
  const shared = {
    mixed_brand_spatial: [
      ["distributed-touchpoints", "沿途回声", "让品牌在多个轻触点中逐步被识别"],
      ["social-proof-loop", "分享回路", "让分享成为体验结果而不是预设拍照任务"],
    ],
    industrial_design: [
      ["repairable-modules", "可维护模块", "让维护边界直接成为产品结构秩序"],
      ["adaptive-placement", "情境落位", "让产品在移动与放置之间保持连续状态"],
    ],
    product_design: [["task-economy", "动作经济", "用最少动作完成核心任务"], ["service-continuity", "服务连续", "把产品与长期服务组织成一条路径"]],
    uiux: [["decision-clarity", "判断清晰", "在关键节点只呈现能改变决定的信息"], ["human-control", "人工确认", "让自动化始终保留可解释的确认与撤回"]],
  };
  return (shared[mode] || shared.industrial_design).map(([strategyKey, name, subtitle]) => ({
    strategyKey, name, subtitle, keywords: [name, "差异机制", "可验证"],
    strategicIdea: `${subtitle}，并把这一机制转化为跨触点可执行、可验证的设计规则。`,
    brandLogic: "以可重复的关系而非短期装饰建立识别。", culturalLogic: "文化线索仅在有来源和场景理由时出现。",
    visualLogic: "视觉层级只强调关键关系与状态。", spatialLogic: "关键节点承担不同的行为任务。",
    experienceLogic: "用户能理解当前动作如何影响下一步。", interactionLogic: "反馈靠近动作并允许退出。",
    formLogic: "形式跟随任务边界与触点关系。", materialLogic: "材料差异对应真实接触与环境风险。",
    advantages: [`${name}能形成清楚的项目差异`, "可直接转化为下一阶段验证"], tradeoffs: ["需要删减不服务机制的表达", "团队必须保持跨触点一致"],
    risks: ["机制过弱会退化成风格口号", "执行不一致会削弱识别"], validationQuestions: ["用户能否在真实场景中感知这一机制？", "机制能否跨两个以上触点保持成立？"],
    successSignals: ["用户能复述关键关系", "核心路径中断减少"], mustKeep: ["机制清楚", "来源可追溯", "可验证"], mustAvoid: ["空泛风格词", "无依据装饰", "用图片替代策略"],
  }));
}

function makeDirection({ project, context, lane, index, laneIndex }) {
  lane = tailorLane(lane, context);
  const insight = context.confirmedInsights[index % Math.max(context.confirmedInsights.length, 1)];
  const evidenceIds = insight?.evidenceIds?.filter((id) => context.acceptedEvidence.some((item) => item.id === id)).slice(0, 3)
    ?? context.acceptedEvidence.slice(index % Math.max(context.acceptedEvidence.length, 1), index % Math.max(context.acceptedEvidence.length, 1) + 2).map((item) => item.id);
  const insightIds = insight ? [insight.id] : [];
  const signal = clip(signalFrom(context), 72);
  const thesis = `${project.name || "当前项目"}围绕“${lane.name}”展开：把“${signal}”转译成一套可被用户感知、团队执行并能在下一阶段验证的设计战略。`;
  const direction = {
    id: `${project.id || "project"}-design-direction-${String(laneIndex + 1).padStart(2, "0")}`,
    code: String.fromCharCode(65 + laneIndex),
    name: lane.name,
    subtitle: lane.subtitle,
    thesis,
    strategicIdea: lane.strategicIdea,
    userValue: [
      `让${context.targetUser || "目标用户"}先理解价值来源，再决定是否深入参与。`,
      `让用户按自己的时间与注意力选择停留深度，不被单一路径绑住。`,
      `让用户通过一次有开始和结束的动作形成可复述记忆。`,
      `让用户在低打扰状态下仍能看懂下一步。`,
      `让用户跨触点保持熟悉感，同时获得场景差异。`,
      `让用户清楚感知当前机制如何回应真实场景。`,
    ][laneIndex % 6],
    evidenceIds: unique(evidenceIds),
    insightIds,
    brandLogic: lane.brandLogic,
    culturalLogic: lane.culturalLogic,
    visualLogic: lane.visualLogic,
    spatialLogic: lane.spatialLogic,
    experienceLogic: lane.experienceLogic,
    interactionLogic: lane.interactionLogic,
    formLogic: lane.formLogic,
    materialLogic: lane.materialLogic,
    advantages: [...lane.advantages],
    tradeoffs: [...lane.tradeoffs],
    risks: [...lane.risks],
    validationQuestions: [...lane.validationQuestions],
    successSignals: [...lane.successSignals],
    mustKeep: [...lane.mustKeep],
    mustAvoid: [...lane.mustAvoid],
    supportLevel: "preliminary",
    status: "candidate",
    strategyKey: lane.strategyKey,
    keywords: [...(lane.keywords ?? [])],
    comparison: {
      axis: lane.strategyKey,
      difference: `相较其他方向，本方向优先处理${lane.subtitle.replace(/^让|^把/, "")}。`,
    },
    fundamentalDifference: `本方向以“${lane.strategyKey}”作为第一优先级，而不是把视觉风格当作方向差异。`,
    strategicMechanism: lane.subtitle,
    problemSolved: context.coreTension || context.coreDesignQuestion,
    whyNow: context.acceptedEvidence[0]?.interpretation || context.confirmedInsights[0]?.whyItMatters || "当前已确认上下文要求先验证这条机制。",
    communicationLogic: lane.brandLogic || lane.visualLogic,
    designConsequences: unique([lane.brandLogic, lane.spatialLogic, lane.experienceLogic, lane.interactionLogic]).slice(0, 4),
    biggestRisk: lane.risks?.[0],
    validationQuestion: lane.validationQuestions?.[0],
    comparisonReasons: [
      `直接回应${context.coreTension || context.coreDesignQuestion || "当前核心设计问题"}`,
      insight ? `承接已确认洞察：${insight.title}` : "当前没有已确认洞察，需先补充证据",
    ],
    evidenceSourceCount: unique(context.acceptedEvidence.filter((item) => evidenceIds.includes(item.id)).map((item) => item.sourceName)).length,
    image: null,
    imageSource: "not-generated",
    generatedFrom: "confirmed-brief-accepted-evidence-confirmed-insights",
  };
  direction.supportLevel = supportLevel(context, direction);
  return direction;
}

function chooseLanes(mode) {
  const lanes = DOMAIN_LANES[mode] ?? DOMAIN_LANES.industrial_design;
  return [...lanes, ...extraLanes(mode)].slice(0, 6);
}

function termSet(direction) {
  return new Set([direction.strategyKey, ...(direction.keywords ?? [])].flatMap((item) => clean(item).split(/[\s·、，,/]+/)).filter(Boolean));
}

function distance(a, b) {
  const left = termSet(a); const right = termSet(b);
  const shared = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size || 1;
  return 1 - (shared / union);
}

export function selectMaximallyDiverseDirections(candidates = [], count = 3) {
  if (candidates.length <= count) return candidates.slice(0, count);
  const selected = [candidates[0]];
  while (selected.length < count) {
    const remaining = candidates.filter((item) => !selected.includes(item));
    remaining.sort((a, b) => Math.min(...selected.map((item) => distance(b, item))) - Math.min(...selected.map((item) => distance(a, item))));
    selected.push(remaining[0]);
  }
  return selected.map((item, index) => ({ ...item, code: String.fromCharCode(65 + index) }));
}

function pairwiseDifferences(directions = []) {
  const compare = (a, b) => a && b ? `${a.name}优先“${a.strategicMechanism}”；${b.name}优先“${b.strategicMechanism}”。` : "";
  return { AB: compare(directions[0], directions[1]), AC: compare(directions[0], directions[2]), BC: compare(directions[1], directions[2]) };
}

function projectSpecific(direction, context) {
  const signals = [context.projectName, context.coreDesignQuestion, context.designObjective, context.coreScenario, ...context.designRequirements, ...context.acceptedEvidence.map((item) => item.title), ...context.confirmedInsights.map((item) => item.title)].map(clean).filter((item) => item.length >= 3);
  const text = directionText(direction);
  return signals.some((signal) => signal && text.includes(signal.slice(0, Math.min(signal.length, 20))));
}

export function qualityReviewDesignDirections({ project = {}, directions = [], context = buildDirectionContext(project) } = {}) {
  const errors = [];
  const acceptedIds = new Set(context.acceptedEvidence.map((item) => item.id));
  const insightIds = new Set(context.confirmedInsights.map((item) => item.id));
  const strategyKeys = new Set();
  const gateReady = context.acceptedEvidence.length >= 2 && context.confirmedInsights.length >= 1;
  if (!gateReady && directions.length === 0) return { ok: true, errors: [], gateReady: false };
  if (directions.length !== 3) errors.push(`expected 3 selected directions, received ${directions.length}`);
  for (const direction of directions) {
    const text = directionText(direction);
    if (strategyKeys.has(direction.strategyKey)) errors.push(`${direction.id}: duplicated strategy key`);
    strategyKeys.add(direction.strategyKey);
    if (!direction.thesis || !direction.strategicIdea || !direction.userValue) errors.push(`${direction.id}: missing strategic fields`);
    if (!direction.advantages?.length || !direction.tradeoffs?.length || !direction.risks?.length || !direction.validationQuestions?.length) errors.push(`${direction.id}: missing decision fields`);
    if (direction.image || direction.imageSource === "local-schematic" || direction.imageSource === "live-ai") errors.push(`${direction.id}: direction image generation is forbidden`);
    if (direction.evidenceIds?.some((id) => !acceptedIds.has(id))) errors.push(`${direction.id}: references non-accepted evidence`);
    if (context.acceptedEvidence.length && !direction.evidenceIds?.some((id) => acceptedIds.has(id))) errors.push(`${direction.id}: missing accepted evidence trace`);
    if (context.confirmedInsights.length && !direction.insightIds?.some((id) => insightIds.has(id))) errors.push(`${direction.id}: missing confirmed insight trace`);
    if (!context.acceptedEvidence.length && direction.supportLevel !== "preliminary") errors.push(`${direction.id}: unsupported direction must be preliminary`);
    if (POLLUTED_TERMS.test(text)) errors.push(`${direction.id}: workflow or image-generation pollution`);
    if (context.domain.mode === "mixed_brand_spatial" && MIXED_FORBIDDEN_TERMS.test(text)) {
      const supportingEvidence = context.acceptedEvidence.filter((item) => direction.evidenceIds?.includes(item.id));
      if (!MIXED_FORBIDDEN_TERMS.test(supportingEvidence.map(evidenceText).join(" "))) errors.push(`${direction.id}: mixed brand/spatial domain contamination`);
    }
    if (!projectSpecific(direction, context)) errors.push(`${direction.id}: project specificity is too weak`);
  }
  for (let index = 0; index < directions.length; index += 1) {
    for (let other = index + 1; other < directions.length; other += 1) {
      if (directions[index].strategyKey && directions[index].strategyKey === directions[other].strategyKey) errors.push(`${directions[index].id}: pairwise strategy difference is not real`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function buildDirectionContext(project = {}) {
  return buildDirectionContextRaw(project);
}

export function getDirectionContextSignature(project = {}) {
  return signatureFor(buildDirectionContextRaw(project));
}

export function getConfirmedDirectionInsights(project = {}) {
  return getConfirmedDesignInsights(project);
}

export function generateDesignDirections(project = {}) {
  const context = buildDirectionContextRaw(project);
  const gate = { acceptedEvidenceCount: context.acceptedEvidence.length, confirmedInsightCount: context.confirmedInsights.length, ready: context.acceptedEvidence.length >= 2 && context.confirmedInsights.length >= 1 };
  if (!gate.ready) return {
    context,
    contextSignature: signatureFor(context),
    candidates: [],
    directions: [],
    pairwiseDifferences: { AB: "", AC: "", BC: "" },
    quality: { ok: true, errors: [], gateReady: false },
    gate,
    generationMeta: { candidateCount: 0, selectedCount: 0, source: "blocked-by-evidence-gate", generatedAt: new Date().toISOString() },
  };
  const lanes = chooseLanes(context.domain.mode);
  const candidates = lanes.map((lane, index) => makeDirection({ project, context, lane, index, laneIndex: index }));
  const directions = selectMaximallyDiverseDirections(candidates, 3);
  const quality = qualityReviewDesignDirections({ project, directions, context });
  return {
    context,
    contextSignature: signatureFor(context),
    candidates,
    directions: quality.ok ? directions : directions.map((item) => ({ ...item, supportLevel: context.acceptedEvidence.length ? "partial" : "preliminary" })),
    pairwiseDifferences: pairwiseDifferences(directions),
    quality,
    gate,
    generationMeta: { candidateCount: candidates.length, selectedCount: directions.length, source: "local-context-pipeline", generatedAt: new Date().toISOString() },
  };
}

function normalizeList(value, fallback = []) {
  const result = arrayOf(value);
  return result.length ? result : fallback;
}

export function normalizeDirectionResponse(project = {}, value = {}, fallback = generateDesignDirections(project).directions) {
  const context = buildDirectionContextRaw(project);
  const rows = Array.isArray(value?.directions) ? value.directions : Array.isArray(value?.items) ? value.items : [];
  if (!rows.length) return { directions: fallback, quality: qualityReviewDesignDirections({ project, directions: fallback, context }), source: "fallback" };
  const acceptedIds = new Set(context.acceptedEvidence.map((item) => item.id));
  const confirmedIds = new Set(context.confirmedInsights.map((item) => item.id));
  const directions = rows.slice(0, 3).map((row, index) => {
    const base = fallback[index] ?? fallback[0];
    const evidenceIds = normalizeList(row.evidenceIds ?? row.sourceEvidenceIds, base.evidenceIds).filter((id) => acceptedIds.has(id));
    const insightIds = normalizeList(row.insightIds, base.insightIds).filter((id) => confirmedIds.has(id));
    const merged = {
      ...base,
      ...row,
      id: base.id,
      code: base.code,
      name: clean(row.name || base.name),
      thesis: clean(row.thesis || row.opportunity || base.thesis),
      strategicIdea: clean(row.strategicIdea || row.hypothesis || base.strategicIdea),
      evidenceIds,
      insightIds,
      advantages: normalizeList(row.advantages, base.advantages),
      tradeoffs: normalizeList(row.tradeoffs ?? row.tradeoff, base.tradeoffs),
      risks: normalizeList(row.risks, base.risks),
      validationQuestions: normalizeList(row.validationQuestions ?? row.validationMetric, base.validationQuestions),
      successSignals: normalizeList(row.successSignals, base.successSignals),
      mustKeep: normalizeList(row.mustKeep, base.mustKeep),
      mustAvoid: normalizeList(row.mustAvoid, base.mustAvoid),
      supportLevel: context.acceptedEvidence.length && insightIds.length ? "supported" : "preliminary",
      status: "candidate",
      image: null,
      imageSource: "not-generated",
    };
    return merged;
  });
  const quality = qualityReviewDesignDirections({ project, directions, context });
  return quality.ok ? { directions, quality, source: "live" } : { directions: fallback, quality, source: "fallback-invalid-live" };
}

export function getDirectionRecommendation(directions = [], context = {}) {
  const enabled = context.acceptedEvidence?.length >= 2 && context.confirmedInsights?.length >= 1;
  if (!enabled) return { enabled: false, directionId: null, reasons: [], tradeoffs: [], risk: "至少需要 2 条已采纳证据和 1 条已确认洞察后，Muse 才会给出方向推荐。" };
  const recommended = directions.find((item) => item.supportLevel === "supported") || directions.find((item) => item.supportLevel === "partial") || directions[0] || null;
  if (!recommended) return { enabled: false, directionId: null, reasons: [], tradeoffs: [], risk: "暂时没有可推荐的方向。" };
  const insight = context.confirmedInsights?.find((item) => recommended.insightIds?.includes(item.id));
  const evidenceCount = recommended.evidenceIds?.length ?? 0;
  return {
    enabled: true,
    directionId: recommended.id,
    reasons: [
      insight ? `承接已确认洞察“${insight.title}”` : "当前方向已经明确写出需要补充的证据",
      evidenceCount ? `可追溯到 ${evidenceCount} 条已采纳证据` : "不把未验证假设包装成事实",
      `与${context.domain?.label || "当前领域"}的策略重点一致`,
    ].slice(0, 3),
    risk: recommended.risks?.[0] || "仍需在下一阶段验证方向是否能转化为可执行方案。",
    tradeoffs: directions.filter((item) => item.id !== recommended.id).map((item) => `未优先选择“${item.name}”：${item.tradeoffs?.[0] || item.biggestRisk || "当前取舍更大"}`),
  };
}

export function formatDirectionContext(context) {
  return [
    `项目：${context.projectName || "未命名项目"}`,
    `领域：${context.domain?.label || context.domain?.mode || "综合设计"}`,
    `核心设计问题：${context.coreDesignQuestion || "未提供"}`,
    `设计目标：${context.designObjective || "未提供"}`,
    `核心张力：${context.coreTension || "未提供"}`,
    `目标用户：${context.targetUser || "未提供"}`,
    `核心场景：${context.coreScenario || "未提供"}`,
    `设计要求：${context.designRequirements.join("；") || "未提供"}`,
    `设计常量：${context.designConstants.join("；") || "未提供"}`,
    `设计排除：${context.designExclusions.join("；") || "未提供"}`,
    `成功标准：${context.successCriteria.join("；") || "未提供"}`,
    `已采纳证据：${context.acceptedEvidence.map((item) => `${item.id}｜${item.title}｜${item.originalExcerpt}`).join("；") || "暂无已采纳证据"}`,
    `已确认洞察：${context.confirmedInsights.map((item) => `${item.id}｜${item.title}｜${item.insightStatement}｜设计含义：${item.designImplication}`).join("；") || "暂无已确认洞察"}`,
  ].join("\n");
}
