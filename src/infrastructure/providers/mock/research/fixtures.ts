import type { ResearchProviderOutput } from "../../../../application/research/index.js";
import type { ResearchFixtureKey } from "./fixtureKey.js";

const outputs: Readonly<Record<ResearchFixtureKey, Omit<ResearchProviderOutput, "understanding"> & { readonly understanding: string }>> = {
  shanxi_heritage: {
    understanding: "项目需要把山西文化遗产的历史证据、材料质感与当代青年观看方式连接起来，形成尊重原境而非符号拼贴的传播方向。",
    sources: [
      { key: "archive", type: "archive", title: "山西文化遗产档案研究假设", provenance: "mock_hypothesis" },
      { key: "audience", type: "interview", title: "青年文化旅行者访谈提纲（模拟）", provenance: "mock_hypothesis" },
    ],
    evidence: [
      { key: "stone", sourceKey: "archive", excerpt: "假设：石窟、木构与碑刻所呈现的时间痕迹，比通用古风纹样更能承载在地真实性。", evidenceStatus: "待核验" },
      { key: "reading", sourceKey: "audience", excerpt: "假设：年轻受众愿意从具体地点、人物和工艺细节进入文化故事。", evidenceStatus: "待核验" },
    ],
    observations: [
      { key: "culture", evidenceKeys: ["stone"], statement: "文化识别应来自材料与建造证据，而不是堆叠传统符号。", category: "文化" },
      { key: "audience-observation", evidenceKeys: ["reading"], statement: "青年观看需要短入口与可继续深读的双层信息结构。", category: "受众" },
    ],
    insights: [
      { key: "living-archive", observationKeys: ["culture", "audience-observation"], statement: "把遗产作为仍在发生的文明现场，可同时建立可信度与参与感。" },
    ],
    opportunities: [
      { key: "editorial-heritage", insightKeys: ["living-archive"], statement: "以当代编辑系统重组档案、地点与材料，让厚重文化获得清晰入口。" },
    ],
    seeds: [
      { key: "civilization-now", opportunityKeys: ["editorial-heritage"], title: "文明仍在现场", premise: "用留白、档案编号和材料特写构成可阅读的文化现场。" },
    ],
  },
  chengdu_coffee: {
    understanding: "项目需要为成都独立咖啡品牌建立兼具社区温度、日常松弛与专业风味识别的视觉基础，并避开连锁精品咖啡的冷感同质化。",
    sources: [
      { key: "neighborhood", type: "interview", title: "成都社区咖啡消费场景访谈提纲（模拟）", provenance: "mock_hypothesis" },
      { key: "touchpoint", type: "user_upload", title: "门店与包装触点观察清单（模拟）", provenance: "mock_hypothesis" },
    ],
    evidence: [
      { key: "rhythm", sourceKey: "neighborhood", excerpt: "假设：顾客把独立咖啡店视为通勤间隙、邻里会面与独处停留的日常节点。", evidenceStatus: "待核验" },
      { key: "craft", sourceKey: "touchpoint", excerpt: "假设：杯套、豆袋标签和手写风味卡比宏大品牌故事更高频地建立信任。", evidenceStatus: "待核验" },
    ],
    observations: [
      { key: "context", evidenceKeys: ["rhythm"], statement: "品牌竞争发生在街区日常节奏，而不只发生在咖啡专业术语中。", category: "语境" },
      { key: "visual-touchpoint", evidenceKeys: ["craft"], statement: "小尺度、高频触点需要亲近但清楚的识别语法。", category: "视觉" },
    ],
    insights: [
      { key: "daily-specialty", observationKeys: ["context", "visual-touchpoint"], statement: "专业感可以通过透明、手作与可感知的日常细节表达，而非依赖冷峻极简。" },
    ],
    opportunities: [
      { key: "warm-system", insightKeys: ["daily-specialty"], statement: "建立能在门店、豆袋与社交内容间切换的温暖模块化识别系统。" },
    ],
    seeds: [
      { key: "street-brew", opportunityKeys: ["warm-system"], title: "街角慢萃", premise: "以街区坐标、烘焙批次与手感纸张记录每天发生的咖啡关系。" },
    ],
  },
  generic: {
    understanding: "项目需要从目标、受众、使用语境与交付约束中建立可核验的研究假设，再将其转化为清晰创意机会。",
    sources: [
      { key: "brief", type: "user_upload", title: "项目简报中的待核验假设", provenance: "mock_hypothesis" },
      { key: "context", type: "interview", title: "目标受众语境访谈提纲（模拟）", provenance: "mock_hypothesis" },
    ],
    evidence: [
      { key: "goal", sourceKey: "brief", excerpt: "假设：清楚的目标与交付边界是判断创意方向的首要依据。", evidenceStatus: "用户提供" },
      { key: "audience", sourceKey: "context", excerpt: "假设：受众在具体接触场景中的任务会改变视觉信息优先级。", evidenceStatus: "待核验" },
    ],
    observations: [
      { key: "constraint", evidenceKeys: ["goal"], statement: "设计限制应转化为方向筛选条件。", category: "限制" },
      { key: "use", evidenceKeys: ["audience"], statement: "视觉表达需要回应实际使用场景。", category: "受众" },
    ],
    insights: [{ key: "fit", observationKeys: ["constraint", "use"], statement: "可执行的创意方向来自目标、受众与场景之间的共同约束。" }],
    opportunities: [{ key: "system", insightKeys: ["fit"], statement: "建立可跨交付物延展且有明确判断标准的视觉系统。" }],
    seeds: [{ key: "clear-signal", opportunityKeys: ["system"], title: "清晰信号", premise: "用层级、节奏与一致的视觉母题强化识别。" }],
  },
};

export function researchFixture(key: ResearchFixtureKey): ResearchProviderOutput {
  return structuredClone(outputs[key]);
}
