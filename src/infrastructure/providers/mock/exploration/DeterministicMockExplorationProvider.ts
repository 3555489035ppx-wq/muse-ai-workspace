import {
  ExplorationProviderError, validateExplorationProviderOutput,
  type ExplorationProvider, type ExplorationProviderInput, type ExplorationProviderOutput, type VariationAxisValue,
} from "../../../../application/exploration/index.js";

function hash(text: string): number { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
const EXPRESSIONS = [
  ["纪念碑式中心", "正面纪实", "高对比标题", "矿物中性色", "粗粝纸本", "硬侧光", "颗粒档案"],
  ["横向叙事分镜", "环境抓拍", "窄体无衬线", "冷暖分区", "哑光金属", "清晨漫射", "电影调色"],
  ["非对称编辑网格", "微距静物", "人文衬线", "低饱和暖色", "纤维纸张", "柔和顶光", "纸本扫描"],
  ["模块化拼接", "动态快照", "几何黑体", "荧光撞色", "透明光膜", "霓虹逆光", "数字叠印"],
  ["大留白边缘构图", "观察式人像", "细体宋黑", "单色渐变", "织物颗粒", "阴天散射", "低反差雾化"],
  ["高密度信息墙", "闪光街拍", "压缩粗黑", "夜色高饱和", "贴纸金属", "直闪硬光", "复印噪点"],
] as const;
const AXES: readonly VariationAxisValue["axis"][] = ["composition", "photography", "typography", "color", "material", "lighting", "imageTreatment"];

export class DeterministicMockExplorationProvider implements ExplorationProvider {
  async generate(input: ExplorationProviderInput): Promise<ExplorationProviderOutput> {
    await Promise.resolve();
    if (input.signal?.aborted) throw new ExplorationProviderError("CANCELLED", "Exploration generation was cancelled.");
    const firstSource = input.sourceAssetIds[0]; if (firstSource === undefined) throw new ExplorationProviderError("PROVIDER_FAILURE", "Exploration requires source assets.");
    const corpus = `${input.direction.title}${input.direction.concept}`;
    const caseName = corpus.includes("咖啡") ? "咖啡触点" : /山西|文化|档案|文明|东方/.test(corpus) ? "文化转译" : "视觉系统";
    const intent = input.iterationIntent?.text.trim() ?? "首轮"; const offset = hash(`${input.direction.id}|${input.seed}|${intent}`) % EXPRESSIONS.length;
    const variants = Array.from({ length: 6 }, (_, index) => {
      const expression = EXPRESSIONS[(index + offset) % EXPRESSIONS.length] ?? EXPRESSIONS[0];
      const axisValues: VariationAxisValue[] = AXES.map((axis, axisIndex) => ({ axis, value: `${expression[axisIndex] ?? "系统表达"} · ${intent}` }));
      return { key: `variant-${String(index + 1)}`, conceptId: input.direction.id, label: `${caseName} ${String(index + 1)}`, axisValues, referenceIds: input.references.map((item) => item.id), sourceAssetIds: [input.sourceAssetIds[index % input.sourceAssetIds.length] ?? firstSource], preview: { fixtureKey: `mock-exploration-${String(hash(`${input.direction.id}|${intent}|${String(index)}`))}`, width: 1200 + index * 40, height: 900 + index * 20, mimeType: "image/webp" as const } };
    });
    return validateExplorationProviderOutput({ variants }, input);
  }
}
