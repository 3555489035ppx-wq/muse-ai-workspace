import { createDemoVisualsFromIndustrial } from "./demoVisuals.js";

export const JINGANBAO_PROJECT_ID = "f1000000-0000-4000-8000-000000000001";

const ids = {
  brief: "f1000000-0000-4000-8000-000000000002",
  evidence: [
    "f1000000-0000-4000-8000-000000000011",
    "f1000000-0000-4000-8000-000000000012",
    "f1000000-0000-4000-8000-000000000013",
    "f1000000-0000-4000-8000-000000000014",
    "f1000000-0000-4000-8000-000000000015",
  ],
  insights: [
    "f1000000-0000-4000-8000-000000000021",
    "f1000000-0000-4000-8000-000000000022",
    "f1000000-0000-4000-8000-000000000023",
    "f1000000-0000-4000-8000-000000000024",
    "f1000000-0000-4000-8000-000000000025",
  ],
  directions: [
    "f1000000-0000-4000-8000-000000000031",
    "f1000000-0000-4000-8000-000000000032",
    "f1000000-0000-4000-8000-000000000033",
  ],
  conceptCandidates: Array.from({ length: 9 }, (_, index) => `f1000000-0000-4000-8000-${String(41 + index).padStart(12, "0")}`),
  cmf: [
    "f1000000-0000-4000-8000-000000000061",
    "f1000000-0000-4000-8000-000000000062",
    "f1000000-0000-4000-8000-000000000063",
  ],
  versions: [
    "f1000000-0000-4000-8000-000000000071",
    "f1000000-0000-4000-8000-000000000072",
    "f1000000-0000-4000-8000-000000000073",
  ],
  assets: [
    "f1000000-0000-4000-8000-000000000081",
    "f1000000-0000-4000-8000-000000000082",
    "f1000000-0000-4000-8000-000000000083",
    "f1000000-0000-4000-8000-000000000084",
    "f1000000-0000-4000-8000-000000000085",
    "f1000000-0000-4000-8000-000000000086",
    "f1000000-0000-4000-8000-000000000087",
    "f1000000-0000-4000-8000-000000000088",
    "f1000000-0000-4000-8000-000000000089",
  ],
};

const timestamp = "2026-08-01T08:00:00.000Z";
const jinganbaoImage = (group, index) => `/assets/jinganbao/v2/jinganbao-${group}-${String(index).padStart(2, "0")}.png`;

const assetDefinitions = [
  ["净安宝最终主体", "hero-final.png", "final", "当前确认的产品主体", ["最终方案", "蓝白 CMF", "宽幅提手"]],
  ["抱娃时的单手提拿", "research/one-hand-carry-v2.png", "scenario", "照护访谈情境重建", ["母婴", "单手操作", "照护"]],
  ["夜间高频操作", "research/night-routine-v2.png", "scenario", "夜间照护情境重建", ["夜间", "操作节奏", "可见性"]],
  ["移动后的稳定放置", "research/travel-placement-v2.png", "scenario", "短途出行放置情境重建", ["出行", "放置", "受力"]],
  ["提手与开盖避让", "research/handle-clearance-v2.png", "structure", "结构关系验证图", ["结构", "提手", "开盖路径"]],
  ["亲和照护概念", "concepts/concept-soft-care-v3.png", "concept", "面向单手照护的产品概念", ["概念", "低压力", "家庭"]],
  ["移动工具概念", "concepts/concept-travel-loop-v3.png", "concept", "面向短途移动的产品概念", ["概念", "移动", "收纳"]],
  ["耐用设备概念", "concepts/concept-durable-service-v3.png", "concept", "面向长期维护的产品概念", ["概念", "耐用", "维护"]],
  ["安心洁净 CMF", "cmf/cmf-assurance-v2.png", "cmf", "与亲和照护方向对应的材料与色彩方案", ["CMF", "材料", "表面处理"]],
];

const refreshedAssetDefinitions = assetDefinitions.map((definition, index) => {
  const files = [
    "v2/jinganbao-cover-01.png",
    "v2/jinganbao-evidence-01.png",
    "v2/jinganbao-evidence-02.png",
    "v2/jinganbao-evidence-03.png",
    "v2/jinganbao-evidence-04.png",
    "v2/jinganbao-concept-01.png",
    "v2/jinganbao-concept-02.png",
    "v2/jinganbao-concept-03.png",
    "v2/jinganbao-cmf-01.png",
  ];
  return [definition[0], files[index], definition[2], definition[3], definition[4]];
});

export function createJinganbaoAssets() {
  return refreshedAssetDefinitions.map(([name, file, role, source, tags], index) => ({
    id: ids.assets[index],
    projectId: JINGANBAO_PROJECT_ID,
    name,
    type: "image",
    status: "ready",
    mimeType: "image/png",
    byteSize: 1_500_000,
    storageKey: `jinganbao/${file}`,
    url: `/assets/jinganbao/${file}`,
    role,
    source,
    license: "Muse 净安宝项目素材 · Prototype use",
    tags,
    colors: ["#F6F7F9", "#5D8FD7", "#18212B"],
    favorite: role === "final",
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function concept(id, directionId, code, title, image, intent, strength, risk, metrics) {
  return {
    id,
    directionId,
    code,
    name: title,
    image,
    conceptStatement: intent,
    coreMechanism: intent,
    userExperience: intent,
    whyFitsDirection: intent,
    productExpression: intent,
    evidenceIds: [],
    insightIds: [],
    advantages: [strength],
    risks: [risk],
    validationQuestions: [`如何在真实使用中验证“${title}”的核心机制？`],
    metrics,
    status: "candidate",
  };
}

function createLegacyJinganbaoIndustrialState() {
  const [softCareId, portableId, cleanId] = ids.directions;
  return {
    schemaVersion: 4,
    prototypeMode: "mock-ai",
    currentStage: "brief",
    briefConfirmed: false,
    selectedInsightIds: [],
    selectedDirectionId: null,
    directionLocked: false,
    selectedConceptId: null,
    selectedCMFId: null,
    currentReviewId: null,
    currentVersionId: ids.versions[2],
    completedStages: [],
    decisions: [],
    brief: {
      goal: "为母婴家庭设计一款可在居家与短途出行中使用的便携式多功能消毒器。",
      targetUser: "0 至 3 岁婴幼儿照护者，尤其是经常独自照护和短途出行的家长。",
      scenario: "居家消毒奶瓶、玩具与小件用品；高铁、自驾等短途出行携带。",
      productCategory: "便携式母婴消毒设备",
      keyNeeds: ["单手完成高频操作", "提手可靠且便于收纳", "洁净可信但避免医疗器械感", "不同场景快速切换"],
      constraints: ["体积与多功能存在冲突", "折叠提手不得与主体干涉", "结构与材料均待工程验证"],
      deliverables: ["可深化的产品概念", "CMF 建议", "设计评审", "版本与过程板"],
      unknowns: ["UV-C 系统实际安全方案", "内胆与密封结构", "最终材料认证与制造成本"],
      interpretation: "“便携”与“多功能”会直接争夺体积。先验证单手操作、提手折叠路径和母婴场景的洁净感，再决定结构与材料的深化方向。",
    },
    evidence: [
      { id: ids.evidence[0], type: "访谈情境", source: "净安宝用户访谈 03（待补充原始记录）", credibility: "设计师已确认", title: "抱娃时一只手长期被占用", excerpt: "夜间冲奶和外出时，照护者经常只能腾出一只手操作设备。", meaning: "核心操作不能依赖双手配合。", image: "/assets/jinganbao/research/one-hand-carry-v2.png" },
      { id: ids.evidence[1], type: "任务观察", source: "母婴居家任务观察（情境参考）", credibility: "待验证", title: "夜间任务放大模式切换负担", excerpt: "开盖、放入、选择模式和启动之间的手部移动过多，照护者难以保持连续操作。", meaning: "需要更少、更连续的操作路径。", image: "/assets/jinganbao/research/night-routine-v2.png" },
      { id: ids.evidence[2], type: "出行情境", source: "短途出行情境记录（情境参考）", credibility: "待验证", title: "设备在家与出行之间频繁移动", excerpt: "高铁与自驾场景要求设备可稳定提拿，并快速放置到有限台面。", meaning: "提手是核心交互结构，不是装饰。", image: "/assets/jinganbao/research/travel-placement-v2.png" },
      { id: ids.evidence[3], type: "同类产品比较", source: "同类便携消毒设备比较", credibility: "待验证", title: "窄提手和旋转轴容易产生干涉", excerpt: "提手接近开盖区时，转轴路径与壳体边界会同时增加误操作和清洁难度。", meaning: "提手路径必须与主体几何一起设计。", image: "/assets/jinganbao/research/handle-clearance-v2.png" },
      { id: ids.evidence[4], type: "已有迭代材料", source: "净安宝历史造型迭代", credibility: "设计师已确认", title: "宽幅折叠提手改善稳定性", excerpt: "宽幅提手比波浪形窄提手更稳定，也更符合便携工具的受力直觉。", meaning: "保留主体和显示区，只聚焦提手迭代。", image: "/assets/jinganbao/research/handle-motion-v2.png" },
    ],
    insights: [
      { id: ids.insights[0], sourceEvidenceIds: [ids.evidence[0], ids.evidence[1]], statement: "高频操作必须降低双手依赖。", opportunity: "单手连续操作", rationale: "用户身体状态与任务频率共同指向单手完成主要操作。", image: "/assets/jinganbao/research/one-hand-carry-v2.png" },
      { id: ids.insights[1], sourceEvidenceIds: [ids.evidence[2], ids.evidence[3]], statement: "真实便携性取决于提手路径与主体几何关系。", opportunity: "宽幅折叠提手", rationale: "出行携带和竞品干涉问题都集中在提手与主体的关系。", image: "/assets/jinganbao/research/travel-placement-v2.png" },
      { id: ids.insights[2], sourceEvidenceIds: [ids.evidence[0], ids.evidence[4]], statement: "母婴场景需要洁净可信，而不是冰冷的医疗器械感。", opportunity: "亲和洁净 CMF", rationale: "柔和触感和清晰操作能同时建立安全感与家庭适配。", image: "/assets/jinganbao/research/night-routine-v2.png" },
      { id: ids.insights[3], sourceEvidenceIds: [ids.evidence[1], ids.evidence[3]], statement: "开盖与提手必须被设计成不互相打断的一条路径。", opportunity: "提手与开盖避让关系", rationale: "高频任务中的每次换手都会放大误操作与中断成本。", image: "/assets/jinganbao/research/handle-clearance-v2.png" },
      { id: ids.insights[4], sourceEvidenceIds: [ids.evidence[2], ids.evidence[4]], statement: "移动后的快速放置，需要稳定落脚与可预期的受力位置。", opportunity: "落脚与提拿连续性", rationale: "携带动作完成后，用户仍需要在有限台面上安全完成下一步。", image: "/assets/jinganbao/research/handle-motion-v2.png" },
    ],
    directions: [
      { id: softCareId, code: "A", name: "亲和照护", subtitle: "夜间与家庭照护", image: "/assets/jinganbao/concepts/concept-soft-care-v3.png", formLanguage: "圆角主体、低压力握持、触觉明确的宽幅提手", keywords: ["单手", "安心", "低压力"], cmf: "暖白主体 + 柔蓝触觉区", evidenceIds: [ids.evidence[0], ids.evidence[1], ids.evidence[4]], insightIds: [ids.insights[0], ids.insights[2], ids.insights[3]], opportunity: "用连续单手操作降低照护压力。", risk: "过度柔和可能削弱设备可靠感。", hypothesis: "照护者可在不换手的情况下完成提起、开盖与启动。", tradeoff: "牺牲部分硬朗结构感，换取触觉舒适与家庭融入。", validationMetric: "记录单手任务完成率、开盖前后的换手次数与误触点。", metrics: { userFit: 5, portability: 4, emotion: 5, complexity: 3, evidence: 5 } },
      { id: portableId, code: "B", name: "移动工具", subtitle: "短途出行与台面切换", image: "/assets/jinganbao/concepts/concept-travel-loop-v3.png", formLanguage: "清晰受力框架、折叠提手、稳定落脚", keywords: ["提拿", "收纳", "连续性"], cmf: "冷白主体 + 中性蓝结构件", evidenceIds: [ids.evidence[2], ids.evidence[3], ids.evidence[4]], insightIds: [ids.insights[1], ids.insights[3], ids.insights[4]], opportunity: "把提拿、收纳与放置变成同一套移动逻辑。", risk: "工具感过强会降低母婴场景的亲和度。", hypothesis: "用户在车厢或有限台面上可稳定提起并一次放置到位。", tradeoff: "优先携带和落脚稳定性，接受更少的软性包覆。", validationMetric: "模拟移动后放置成功率、提手受力舒适度与收纳步骤数。", metrics: { userFit: 4, portability: 5, emotion: 3, complexity: 4, evidence: 5 } },
      { id: cleanId, code: "C", name: "耐用设备", subtitle: "高频清洁与长期维护", image: "/assets/jinganbao/concepts/concept-durable-service-v3.png", formLanguage: "精确分区、耐磨触点、可读的维护边界", keywords: ["耐用", "清洁", "维护"], cmf: "高洁白主体 + 深蓝耐磨部件", evidenceIds: [ids.evidence[1], ids.evidence[3]], insightIds: [ids.insights[1], ids.insights[3]], opportunity: "用维护秩序与材料耐久建立长期可信感。", risk: "结构语言过强会接近医疗器械感。", hypothesis: "用户能够看懂哪些部位需要清洁、握持和维护。", tradeoff: "优先耐久与易维护，降低软性家居感。", validationMetric: "清洁盲区检查、把手转轴耐磨测试与维护步骤理解率。", metrics: { userFit: 3, portability: 3, emotion: 2, complexity: 5, evidence: 3 } },
    ],
    conceptCandidates: [
      concept(ids.conceptCandidates[0], softCareId, "A", "触觉握持桥", "/assets/jinganbao/concepts/concept-soft-care-v3.png", "把拇指触点嵌入宽幅握持桥，减少夜间提起时的寻找动作。", "握持位置明确", "提手连接处需验证疲劳寿命", { portability: 4, capacity: 4, userFit: 5, usability: 5, complexity: 3, identity: 4 }),
      concept(ids.conceptCandidates[1], softCareId, "B", "低重心居家版", "/assets/jinganbao/cmf/cmf-home-v2.png", "以更低、更宽的轮廓提升床边和柜面放置的稳定感。", "家庭环境融合自然", "出行收纳体积需验证", { portability: 3, capacity: 5, userFit: 5, usability: 4, complexity: 2, identity: 4 }),
      concept(ids.conceptCandidates[2], softCareId, "C", "夜间安心提手", "/assets/jinganbao/cmf/cmf-assurance-v2.png", "以柔和包覆与清晰前面板，让夜间单手操作更可预期。", "情境与触觉一致", "表面耐污性需验证", { portability: 4, capacity: 4, userFit: 5, usability: 4, complexity: 3, identity: 5 }),
      concept(ids.conceptCandidates[3], portableId, "A", "随行箱体", "/assets/jinganbao/concepts/concept-travel-loop-v3.png", "强化移动、落脚与快速收纳。", "出行情境清晰", "居家体量偏强", { portability: 5, capacity: 4, userFit: 4, usability: 4, complexity: 3, identity: 4 }),
      concept(ids.conceptCandidates[4], portableId, "B", "结构提拿", "/assets/jinganbao/research/handle-clearance-v2.png", "把提手、转轴、内胆与底座组织为清晰结构系统。", "结构关系可解释", "视觉表达偏工程化", { portability: 5, capacity: 5, userFit: 3, usability: 4, complexity: 5, identity: 4 }),
      concept(ids.conceptCandidates[5], portableId, "C", "轻量宽提手", "/assets/jinganbao/hero-final.png", "以最终宽提手方案平衡便携与母婴亲和。", "携带与视觉平衡", "需要验证提手受力", { portability: 5, capacity: 4, userFit: 4, usability: 5, complexity: 3, identity: 5 }),
      concept(ids.conceptCandidates[6], cleanId, "A", "精密分区", "/assets/jinganbao/concepts/concept-durable-service-v3.png", "强调结构、分缝和功能分区的可读性。", "专业可信", "结构成本未知", { portability: 3, capacity: 5, userFit: 3, usability: 4, complexity: 5, identity: 4 }),
      concept(ids.conceptCandidates[7], cleanId, "B", "耐用蓝白", "/assets/jinganbao/cmf/cmf-durable-v2.png", "用耐磨部件和强对比显示区建立长期使用感。", "CMF 识别明确", "可能显得偏冷", { portability: 4, capacity: 4, userFit: 3, usability: 4, complexity: 4, identity: 5 }),
      concept(ids.conceptCandidates[8], cleanId, "C", "洁净终版", "/assets/jinganbao/hero-final.png", "保留最终造型，用更克制的分区强化洁净专业。", "完成度高", "材料状态待验证", { portability: 4, capacity: 4, userFit: 4, usability: 5, complexity: 3, identity: 5 }),
    ],
    cmfSchemes: [
      { id: ids.cmf[0], code: "A", name: "安心洁净", image: "/assets/jinganbao/cmf/cmf-assurance-v2.png", crop: 0, summary: "母婴场景优先，洁净但不冰冷。", parts: [
        { part: "主体", material: "ABS", color: "暖白", finish: "细哑光", rationale: "降低医疗器械感并便于日常清洁。", validationState: "待验证" },
        { part: "提手", material: "TPE", color: "柔蓝", finish: "微纹理", rationale: "形成柔和握持和清晰提拿区域。", validationState: "AI 建议，待人工确认" },
      ] },
      { id: ids.cmf[1], code: "B", name: "温和家居", image: "/assets/jinganbao/cmf/cmf-home-v2.png", crop: 1, summary: "更低对比、更适合长期放置在家庭空间。", parts: [
        { part: "主体", material: "PP", color: "奶油白", finish: "柔和细砂", rationale: "与木质和织物环境协调。", validationState: "待验证" },
        { part: "提手", material: "TPE", color: "鼠尾草灰", finish: "柔触", rationale: "减弱工具感，保持触觉分区。", validationState: "AI 建议，待人工确认" },
      ] },
      { id: ids.cmf[2], code: "C", name: "专业耐用", image: "/assets/jinganbao/cmf/cmf-durable-v2.png", crop: 2, summary: "强调高频使用、耐磨与专业洁净。", parts: [
        { part: "主体", material: "PC+ABS", color: "洁净白", finish: "微哑光", rationale: "强化结构和长期维护的视觉预期。", validationState: "待验证" },
        { part: "提手", material: "TPE", color: "深蓝", finish: "耐磨纹理", rationale: "提升提手识别和耐磨感。", validationState: "AI 建议，待人工确认" },
      ] },
    ],
    reviews: [],
    versionStory: [
      { id: ids.versions[0], number: 1, label: "原始提手方案", image: "/assets/jinganbao/research/handle-clearance-v2.png", whatChanged: "建立基础主体与前置交互区。", why: "从功能命题进入第一版造型。", reviewTrigger: "提手握持和清洁存在问题。" },
      { id: ids.versions[1], number: 2, label: "旋转轴调整", image: "/assets/jinganbao/research/handle-motion-v2.png", whatChanged: "调整提手轴与主体连接关系。", why: "减少折叠路径与开盖区域冲突。", reviewTrigger: "结构干涉风险需要继续降低。" },
      { id: ids.versions[2], number: 3, label: "宽幅折叠提手", image: "/assets/jinganbao/hero-final.png", whatChanged: "用宽幅矩形提手替代波浪形窄提手。", why: "提升单手稳定性、清洁性和整体一致性。", reviewTrigger: "CMF 与转轴细节仍待验证。" },
    ],
  };
}

export function createJinganbaoIndustrialState() {
  const industrial = createLegacyJinganbaoIndustrialState();
  const remapped = {
    ...industrial,
    schemaVersion: 6,
    prototypeMode: "portfolio-seed",
    demoPortfolioReady: true,
    visualMode: "demo-asset",
    briefConfirmed: true,
    selectedEvidenceIds: industrial.evidence.map((item) => item.id),
    selectedInsightIds: industrial.insights.slice(0, 3).map((item) => item.id),
    selectedDirectionId: industrial.directions[0].id,
    directionLocked: true,
    selectedConceptId: industrial.conceptCandidates[0].id,
    selectedCMFId: industrial.cmfSchemes[0].id,
    evidence: industrial.evidence.map((item, index) => ({ ...item, image: jinganbaoImage("evidence", index + 1), contentOrigin: "demo_seed" })),
    insights: industrial.insights.map((item, index) => ({ ...item, image: jinganbaoImage("insight", index + 1), status: "confirmed", confirmed: true, contentOrigin: "demo_seed", evidenceIds: item.sourceEvidenceIds })),
    directions: industrial.directions.map((item, index) => ({ ...item, image: jinganbaoImage("direction", index + 1), contentOrigin: "demo_seed" })),
    conceptCandidates: industrial.conceptCandidates.map((item, index) => ({ ...item, image: jinganbaoImage("concept", index + 1), imageSource: "demo-asset", visualMode: "demo-asset", contentOrigin: "demo_seed" })),
    cmfSchemes: industrial.cmfSchemes.map((item, index) => ({ ...item, image: jinganbaoImage("cmf", index + 1), imageSource: "demo-asset", visualMode: "demo-asset", contentOrigin: "demo_seed", conceptId: industrial.conceptCandidates[0].id })),
    versionStory: industrial.versionStory.map((item, index) => ({ ...item, image: jinganbaoImage("version", index + 1), contentOrigin: "demo_seed" })),
  };
  const review = {
    id: "review-jinganbao-portfolio-seed",
    createdAt: timestamp,
    mode: "portfolio-seed",
    context: { directionId: remapped.selectedDirectionId, direction: "A · 亲和照护", conceptId: remapped.selectedConceptId, concept: "A · 触觉握持桥", cmfId: remapped.selectedCMFId, cmf: "A · 安心洁净" },
    summary: "净安宝把单手照护、提手路径与洁净感合并成一条可继续验证的产品路径。",
    strengths: [{ title: "证据链完整", evidence: "单手操作、提手干涉和宽幅提手都有上游研究记录。" }, { title: "视觉与产品一致", evidence: "视觉资产沿用最终主体、宽幅提手和蓝白 CMF。" }],
    issues: [{ id: "review-jinganbao-structure", severity: "high", title: "提手连接与疲劳寿命仍需验证", evidence: "提手转轴与主体几何关系", impact: "高频单手操作可能在长期使用中失去稳定性。", recommendation: "建立 1:1 提手样机，完成 500 次开合、受力和清洁盲区测试。", validationState: "TO_BE_VALIDATED", decision: "pending" }, { id: "review-jinganbao-cmf", severity: "medium", title: "母婴接触区域的耐污边界未证实", evidence: "暖白主体、柔蓝 TPE 提手与细哑光表面", impact: "清洁后变色会削弱洁净可信感。", recommendation: "完成汗液、奶液、擦拭与耐磨对比并留存样件记录。", validationState: "AI_RECOMMENDATION", decision: "pending" }],
  };
  const withReview = {
    ...remapped,
    reviews: [review],
    currentReviewId: review.id,
    completedStages: ["brief", "research", "insight", "direction", "concept", "cmf", "review", "versions", "decision-map"],
  };
  const demoVisuals = createDemoVisualsFromIndustrial({ projectId: JINGANBAO_PROJECT_ID, industrial: withReview });
  return {
    ...withReview,
    demoVisuals,
    selectedVisualId: demoVisuals.find((visual) => visual.stage === "concept" && visual.conceptId === withReview.selectedConceptId)?.id ?? demoVisuals[0]?.id ?? null,
  };
}

export function createJinganbaoSeed() {
  const industrial = createJinganbaoIndustrialState();
  const assets = createJinganbaoAssets();
  const project = {
    id: JINGANBAO_PROJECT_ID,
    name: "净安宝",
    description: "便携式多功能消毒器",
    type: "ui",
    productDiscipline: "industrial",
    status: "active",
    stage: "research",
    outputTypes: ["产品概念", "工业设计", "CMF"],
    settings: { locale: "zh-CN", timezone: "Asia/Shanghai", colorMode: "light" },
    schemaVersion: 6,
    isDraft: false,
    progress: 42,
    coverAssetId: ids.assets[0],
    coverImage: "/assets/project-covers/jinganbao-hero-v2.png",
    industrial,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const brief = {
    id: ids.brief,
    projectId: JINGANBAO_PROJECT_ID,
    goal: industrial.brief.goal,
    audience: industrial.brief.targetUser,
    context: industrial.brief.scenario,
    deliverables: industrial.brief.deliverables,
    constraints: industrial.brief.constraints,
    requirement: industrial.brief.goal,
    target: industrial.brief.goal,
    background: industrial.brief.scenario,
    keywords: ["母婴", "便携", "单手操作", "宽幅提手", "蓝白 CMF"],
    avoid: ["医疗器械感", "提手与主体干涉", "无来源性能结论"],
    opportunities: industrial.insights.map((item) => item.opportunity),
    risks: industrial.brief.unknowns,
    questions: ["优先居家还是高频出行？", "提手结构的验证路径是什么？"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { project, brief, assets, versionIds: ids.versions };
}

export { ids as JINGANBAO_IDS };
