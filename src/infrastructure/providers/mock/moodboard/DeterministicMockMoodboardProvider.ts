import { MoodboardProviderError, validateMoodboardProviderOutput, type MoodboardProvider, type MoodboardProviderInput, type MoodboardProviderOutput, type VisualTerritoryCandidate } from "../../../../application/moodboard/index.js";

type MoodboardCase = "shanxi" | "coffee" | "generic";
const caseKey = (input: MoodboardProviderInput): MoodboardCase => {
  const text = `${input.research.query} ${input.seeds.map((item) => `${item.title} ${item.premise}`).join(" ")}`;
  if (/山西|遗产|文明|档案/.test(text)) return "shanxi";
  if (/成都|咖啡|街角|豆袋/.test(text)) return "coffee";
  return "generic";
};

const definitions: Readonly<Record<MoodboardCase, readonly Omit<VisualTerritoryCandidate, "assetRefs">[]>> = {
  shanxi: [
    { key: "archive-remix", name: "档案新编", rationale: "把碑刻、编号与历史切片组织为可阅读的当代档案。", keywords: ["档案", "留白", "编号"], visualDNA: { keywords: ["克制", "考据", "编辑"], colorPalette: [{ hex: "#171614", role: "墨黑" }, { hex: "#E8E0D1", role: "纸色" }, { hex: "#8A5A3C", role: "朱砂" }], composition: ["档案网格", "大面积留白"], imagery: ["碑刻拓片", "局部编号"], typography: ["宋体与窄体黑体"], materials: ["宣纸", "石纹"] } },
    { key: "living-site", name: "文明现场", rationale: "以建筑尺度、人物关系和自然光呈现仍在发生的文化现场。", keywords: ["现场", "尺度", "时间"], visualDNA: { keywords: ["纪实", "厚重", "空间"], colorPalette: [{ hex: "#2C2924", role: "阴影" }, { hex: "#B49A78", role: "土色" }, { hex: "#D7D0BF", role: "天光" }], composition: ["横向电影构图", "人物尺度对照"], imagery: ["木构远景", "光影人物"], typography: ["低对比无衬线"], materials: ["木材", "夯土"] } },
    { key: "eastern-editorial", name: "东方编辑", rationale: "用非对称版式与书写张力连接东方文字和现代传播节奏。", keywords: ["书写", "节奏", "当代"], visualDNA: { keywords: ["张力", "东方", "年轻"], colorPalette: [{ hex: "#F0E9DC", role: "背景" }, { hex: "#111111", role: "文字" }, { hex: "#4E6658", role: "青绿" }], composition: ["非对称分栏", "纵向标题"], imagery: ["书法局部", "山形负空间"], typography: ["书写体与几何黑体"], materials: ["棉纸", "印泥"] } },
  ],
  coffee: [
    { key: "daily-warmth", name: "日常温度", rationale: "从晨光、杯痕与邻里停留中建立亲近的品牌日常。", keywords: ["晨光", "邻里", "松弛"], visualDNA: { keywords: ["温暖", "亲近", "日常"], colorPalette: [{ hex: "#F2D8B3", role: "奶油" }, { hex: "#7B4B32", role: "咖啡" }, { hex: "#D16B4A", role: "橘红" }], composition: ["生活抓拍", "开放边界"], imagery: ["街角晨光", "手持咖啡"], typography: ["圆体与手写标注"], materials: ["再生纸", "陶杯"] } },
    { key: "street-editorial", name: "街头编辑", rationale: "把街区坐标、招牌碎片与城市节奏转成锐利内容系统。", keywords: ["街区", "坐标", "节奏"], visualDNA: { keywords: ["鲜明", "城市", "编辑"], colorPalette: [{ hex: "#192129", role: "夜色" }, { hex: "#F1EEE8", role: "纸白" }, { hex: "#4E8B63", role: "招牌绿" }], composition: ["切片拼贴", "坐标标记"], imagery: ["街道招牌", "骑行快照"], typography: ["压缩黑体与等宽字"], materials: ["贴纸", "金属"] } },
    { key: "crafted-flavor", name: "材料手作", rationale: "以烘焙批次、豆袋触感和工艺记录表达专业但不疏离。", keywords: ["批次", "手作", "风味"], visualDNA: { keywords: ["透明", "手感", "专业"], colorPalette: [{ hex: "#32261F", role: "深烘" }, { hex: "#C4A36F", role: "牛皮纸" }, { hex: "#6E7F68", role: "植物" }], composition: ["标签模块", "参数层级"], imagery: ["咖啡豆微距", "烘焙记录"], typography: ["人文无衬线与等宽数字"], materials: ["牛皮纸", "棉绳"] } },
  ],
  generic: [
    { key: "clear-system", name: "清晰系统", rationale: "以稳定层级组织核心信息。", keywords: ["清晰", "秩序", "一致"], visualDNA: { keywords: ["理性", "清晰", "模块"], colorPalette: [{ hex: "#16181C", role: "主色" }, { hex: "#F2F3F5", role: "背景" }, { hex: "#4F6FAD", role: "强调" }], composition: ["模块网格"], imagery: ["结构特写"], typography: ["现代黑体"], materials: ["哑光纸"] } },
    { key: "human-story", name: "人物叙事", rationale: "以人物与场景建立情绪入口。", keywords: ["人物", "故事", "情绪"], visualDNA: { keywords: ["真实", "亲近", "叙事"], colorPalette: [{ hex: "#302A28", role: "深色" }, { hex: "#E5D5C4", role: "肤色" }, { hex: "#B85F4A", role: "强调" }], composition: ["人物主导"], imagery: ["环境肖像"], typography: ["人文宋体"], materials: ["暖调纸"] } },
  ],
};

export class DeterministicMockMoodboardProvider implements MoodboardProvider {
  generate(input: MoodboardProviderInput): Promise<MoodboardProviderOutput> {
    if (input.signal?.aborted) return Promise.reject(new MoodboardProviderError("CANCELLED", "情绪板任务已取消"));
    const items = definitions[caseKey(input)];
    if (input.availableAssetIds.length < items.length) return Promise.reject(new MoodboardProviderError("INVALID_OUTPUT", "可用素材不足以建立视觉领地"));
    const territories = items.map((item, index) => {
      const assetId = input.availableAssetIds[index];
      if (assetId === undefined) throw new MoodboardProviderError("INVALID_OUTPUT", "视觉领地缺少可用素材");
      return { ...structuredClone(item), assetRefs: [assetId] };
    });
    return Promise.resolve(validateMoodboardProviderOutput({ territories }, input.availableAssetIds));
  }
}
