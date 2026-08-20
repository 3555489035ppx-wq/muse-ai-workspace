import type { DirectionAxis } from "../../../../application/direction/index.js";

export interface DirectionStrategyFixture {
  readonly title: string;
  readonly concept: string;
  readonly narrative: string;
  readonly keywords: readonly string[];
  readonly axisValues: Readonly<Record<DirectionAxis, string>>;
  readonly advantages: readonly string[];
  readonly risks: readonly string[];
}

export const SHANXI_DIRECTIONS: readonly DirectionStrategyFixture[] = [
  { title: "档案新编", concept: "把历史档案转译为当代编辑秩序", narrative: "让文献、拓片与地理证据在留白中形成新的阅读节奏。", keywords: ["档案", "留白", "编辑秩序"], axisValues: { composition: "纵向档案网格", typography: "宋黑对照", color: "纸本灰与朱砂", image: "文献局部特写", material: "纤维纸与压凹" }, advantages: ["文化证据清晰", "适合系统延展"], risks: ["需控制学术距离感"] },
  { title: "文明现场", concept: "让遗产成为可进入的当代现场", narrative: "用空间尺度与人物关系建立在场感，使文化不再只是被观看的标本。", keywords: ["现场", "尺度", "人文纪实"], axisValues: { composition: "横向电影构图", typography: "窄体无衬线", color: "岩黑与晨光金", image: "纪实环境人像", material: "岩石与金属" }, advantages: ["情绪张力强", "传播画面明确"], risks: ["拍摄执行复杂"] },
  { title: "东方编辑", concept: "以东方节奏建立年轻识别系统", narrative: "将斗拱、山势和书写动作抽象为模块，形成适配数字媒介的识别语法。", keywords: ["模块", "节奏", "数字转译"], axisValues: { composition: "模块化错位拼接", typography: "几何黑体", color: "松石青与荧光橙", image: "符号化几何图形", material: "半透明屏幕与光膜" }, advantages: ["年轻且可互动", "跨媒体适配强"], risks: ["需避免文化符号表面化"] },
] as const;

export const COFFEE_DIRECTIONS: readonly DirectionStrategyFixture[] = [
  { title: "日常温度", concept: "把一杯咖啡变成稳定的邻里关系", narrative: "从清晨光线、手写菜单与熟客痕迹中建立温暖的日常品牌。", keywords: ["邻里", "晨光", "手写"], axisValues: { composition: "松散生活切片", typography: "圆润手写体", color: "燕麦米与焦糖棕", image: "自然光生活摄影", material: "再生纸与陶杯" }, advantages: ["亲近可信", "门店触点自然"], risks: ["需防止过度温吞"] },
  { title: "街头编辑", concept: "用城市节拍表达独立咖啡态度", narrative: "将路牌、票据与夜间街景组合成高密度编辑语言，突出年轻社群感。", keywords: ["街头", "夜色", "票据"], axisValues: { composition: "高密度拼贴", typography: "压缩粗黑体", color: "沥青黑与电光蓝", image: "闪光灯街拍", material: "金属贴纸与热敏纸" }, advantages: ["识别强烈", "社交传播突出"], risks: ["信息密度需分级"] },
  { title: "材料手作", concept: "以烘焙与器物过程建立品质证据", narrative: "放大豆表、滤杯与手部动作，让工艺细节成为品牌的核心视觉资产。", keywords: ["工艺", "器物", "触感"], axisValues: { composition: "静物中心构图", typography: "人文衬线体", color: "矿物灰与铜红", image: "微距工艺摄影", material: "粗陶与亚麻" }, advantages: ["品质证据直接", "适合包装"], risks: ["需维持内容更新"] },
] as const;

export const GENERIC_DIRECTIONS: readonly DirectionStrategyFixture[] = [
  { title: "清晰信号", concept: "用强层级建立明确识别", narrative: "把核心信息压缩为快速可读的视觉信号。", keywords: ["层级", "信号", "直接"], axisValues: { composition: "中心锚点", typography: "粗体无衬线", color: "高反差黑白", image: "单主体剪影", material: "哑光涂层" }, advantages: ["识别快速"], risks: ["表达需保留细节"] },
  { title: "关系网络", concept: "用连接关系组织复杂内容", narrative: "把人物、场景与信息节点编织为可探索的系统。", keywords: ["关系", "网络", "探索"], axisValues: { composition: "分布式节点", typography: "等宽字体", color: "冷灰与青绿", image: "信息化图像", material: "透明叠层" }, advantages: ["系统扩展强"], risks: ["需控制认知负担"] },
  { title: "感官片段", concept: "以细节触发情绪记忆", narrative: "通过光、肌理与局部片段建立具有余韵的体验。", keywords: ["感官", "片段", "余韵"], axisValues: { composition: "边缘裁切", typography: "细体衬线", color: "低饱和暖色", image: "抽象微距", material: "织物与颗粒" }, advantages: ["情绪辨识高"], risks: ["需补足功能信息"] },
] as const;
