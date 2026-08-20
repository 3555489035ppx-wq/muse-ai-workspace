export const stageLabel = {
  brief: "设计简报",
  research: "证据研究",
  insight: "洞察确认",
  direction: "方向锁定",
  concept: "概念选择",
  cmf: "材料与色彩",
  review: "设计评审",
  versions: "版本迭代",
  moodboard: "灵感参考",
  directions: "设计方向",
  exploration: "概念探索",
  critique: "评审与迭代",
  complete: "已归档",
};

const categoryMeta = {
  concept: { label: "产品概念", accent: "#7E9FBC" },
  device: { label: "产品设备", accent: "#6F8AA8" },
  scenario: { label: "场景与用户", accent: "#A78973" },
  cmf: { label: "材料与色彩", accent: "#86A692" },
  portfolio: { label: "作品集案例", accent: "#9B8CA5" },
};

const template = (categoryKey, id, name, description, bestFor, deliverables, keywords, constraints, cover) => ({
  id,
  name,
  categoryKey,
  category: categoryMeta[categoryKey].label,
  description,
  bestFor,
  accent: categoryMeta[categoryKey].accent,
  cover,
  defaults: { deliverables, keywords, constraints },
});

export const templateCatalog = [
  template("concept", "portable-product", "便携式产品概念", "从用户、场景、提拿方式和体积约束出发，建立可深化的产品概念。", "课程命题、随身设备", ["设计简报", "研究证据", "方向比较"], ["便携", "单手操作", "结构关系"], ["明确携带与容量的取舍"], "/assets/jinganbao/hero-final.png"),
  template("device", "home-appliance", "家居小电器设计", "围绕家庭环境、高频操作与安全感组织产品概念。", "家居清洁、厨房、照护产品", ["场景地图", "概念方案", "交互要点"], ["高频使用", "易清洁", "家庭融入"], ["避免无依据的性能承诺"], "/assets/jinganbao/direction-soft-care-v2.png"),
  template("scenario", "mother-baby-device", "母婴产品设计", "从照护者单手操作、卫生边界与家庭信任出发设计实体产品。", "母婴与家庭照护", ["用户研究", "设计方向", "CMF 建议"], ["照护", "单手", "安心"], ["避免医疗器械化表达"], "/assets/jinganbao/scenario-home.png"),
  template("device", "smart-hardware", "智能硬件外观设计", "把功能分区、屏幕、握持与结构关系组织成可解释的硬件概念。", "智能设备、桌面硬件", ["功能架构", "外观方向", "结构风险"], ["分区", "可读性", "耐用"], ["不把概念效果当工程验证"], "/assets/jinganbao/direction-clean-professional-v2.png"),
  template("scenario", "travel-product", "出行与随身产品", "围绕收纳、移动、放置与使用连续性确定产品方向。", "短途出行、通勤、户外", ["场景观察", "概念对比", "携带测试假设"], ["收纳", "提拿", "稳定"], ["明确真实使用环境"], "/assets/jinganbao/direction-portable-utility-v2.png"),
  template("device", "health-product", "健康与照护产品", "围绕可信、易理解与可维护的体验建立产品概念。", "健康、清洁、照护设备", ["问题定义", "研究证据", "评审维度"], ["可信", "清洁", "可维护"], ["不宣称未经验证的安全性能"], "/assets/jinganbao/structure-exploded.png"),
  template("cmf", "cmf-study", "CMF 材料与色彩研究", "对产品的颜色、材料、表面处理与场景适配做可追溯选择。", "CMF 课程、产品深化", ["CMF 方案", "部件说明", "验证边界"], ["材料", "触感", "耐用"], ["区分 AI 建议与已验证结论"], "/assets/jinganbao/cmf-board.png"),
  template("portfolio", "industrial-portfolio", "工业设计作品集案例", "把 Brief、研究、方向、概念、CMF 与迭代组织为可讲述的案例。", "课程项目、求职作品集", ["过程板", "版本记录", "导出预览"], ["决策链", "证据", "迭代"], ["不只展示最终渲染图"], "/assets/jinganbao/concept-legacy.png"),
  template("concept", "blank-product", "空白产品设计项目", "不预设方向；从真实命题开始建立设计简报和证据链。", "开放命题、毕业设计", ["设计简报", "研究框架", "下一步清单"], ["问题定义", "用户", "约束"], ["先确认问题，再进入造型"], "/assets/jinganbao/scenario-travel.png"),
];

export const workspaceSections = [
  ["overview", "项目概览"],
  ["brief", "设计简报"],
  ["research", "研究证据"],
  ["insight", "设计洞察"],
  ["direction", "设计方向"],
  ["concept", "产品概念"],
  ["cmf", "材料与色彩"],
  ["review", "设计评审"],
  ["versions", "版本记录"],
  ["decision-map", "决策地图"],
];
