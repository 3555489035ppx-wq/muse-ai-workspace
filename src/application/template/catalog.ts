import { asEntityId } from "../../domain/shared/id.js";
import type { ProjectTemplateDefinition } from "./contracts.js";

export const PORTABLE_PRODUCT_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000001");
export const HOME_APPLIANCE_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000002");
export const MOTHER_BABY_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000003");
export const SMART_HARDWARE_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000004");
export const TRAVEL_PRODUCT_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000005");
export const HEALTH_PRODUCT_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000006");
export const CMF_STUDY_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000007");
export const PORTFOLIO_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000008");
export const BLANK_PRODUCT_TEMPLATE_ID = asEntityId("23000000-0000-4000-8000-000000000009");

// Compatibility exports for the existing Phase 1 tests and persisted template references.
// Their identifiers now resolve to the equivalent product-design templates above.
export const CULTURAL_HERITAGE_TEMPLATE_ID = PORTABLE_PRODUCT_TEMPLATE_ID;
export const BRAND_IDENTITY_TEMPLATE_ID = HOME_APPLIANCE_TEMPLATE_ID;
export const CAMPAIGN_TEMPLATE_ID = MOTHER_BABY_TEMPLATE_ID;
export const PACKAGING_TEMPLATE_ID = SMART_HARDWARE_TEMPLATE_ID;
export const EXHIBITION_TEMPLATE_ID = TRAVEL_PRODUCT_TEMPLATE_ID;
export const EMERGING_CONSUMER_TEMPLATE_ID = HEALTH_PRODUCT_TEMPLATE_ID;
export const PERSONAL_BRAND_TEMPLATE_ID = CMF_STUDY_TEMPLATE_ID;

export const phaseOneTemplateCatalog: readonly ProjectTemplateDefinition[] = Object.freeze([
  {
    id: PORTABLE_PRODUCT_TEMPLATE_ID,
    name: "便携式产品概念",
    projectType: "ui",
    recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为需要在居家与短途出行间切换的用户设计一款便携产品，先明确单手操作、收纳与体积约束。",
    researchStrategy: { focus: ["使用场景", "单手操作", "携带与收纳"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["紧凑比例", "提拿关系", "耐用材料"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["结构与交互", "CMF 策略", "材料体验"] },
  },
  {
    id: HOME_APPLIANCE_TEMPLATE_ID,
    name: "家居小电器设计",
    projectType: "ui",
    recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为家庭高频使用场景设计一款小电器，平衡功能分区、易清洁、收纳与家庭环境融合。",
    researchStrategy: { focus: ["家庭任务", "高频操作", "清洁维护"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["家庭材质", "柔和结构", "功能分区"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["产品形态", "结构与交互", "材料体验"] },
  },
  {
    id: MOTHER_BABY_TEMPLATE_ID, name: "母婴产品设计", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为照护者设计一款母婴实体产品，优先验证单手操作、卫生边界与安心感。",
    researchStrategy: { focus: ["照护者行为", "卫生场景", "单手操作"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["温和触感", "洁净感", "低压力交互"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["产品形态", "结构与交互", "材料体验"] },
  },
  {
    id: SMART_HARDWARE_TEMPLATE_ID, name: "智能硬件外观设计", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为带屏幕或传感器的硬件产品建立外观概念，明确功能分区、握持、显示与结构边界。",
    researchStrategy: { focus: ["功能架构", "交互路径", "结构风险"], sourceMix: ["竞品观察", "用户语境"] },
    moodboardStrategy: { territoryHints: ["精确分缝", "显示区", "耐用细节"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["产品形态", "结构与交互", "材料体验"] },
  },
  {
    id: TRAVEL_PRODUCT_TEMPLATE_ID, name: "出行与随身产品", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为通勤、短途或户外使用设计随身产品，明确携带、放置、收纳和快速使用之间的连续性。",
    researchStrategy: { focus: ["移动场景", "放置稳定", "收纳路径"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["紧凑结构", "便携工具", "耐磨部件"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["产品形态", "结构与交互", "材料体验"] },
  },
  {
    id: HEALTH_PRODUCT_TEMPLATE_ID, name: "健康与照护产品", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为健康或照护场景建立可信、易理解、可维护的产品概念，不替代真实工程验证。",
    researchStrategy: { focus: ["安全边界", "照护任务", "可维护性"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["洁净材料", "可信层级", "清晰反馈"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["产品形态", "结构与交互", "材料体验"] },
  },
  {
    id: CMF_STUDY_TEMPLATE_ID, name: "CMF 材料与色彩研究", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "为已选产品概念制定颜色、材料与表面处理方案，并明确每个部件的理由与待验证项。",
    researchStrategy: { focus: ["材料触感", "使用环境", "耐用与清洁"], sourceMix: ["竞品观察", "用户语境"] },
    moodboardStrategy: { territoryHints: ["材料样本", "色彩关系", "表面处理"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["材料体验", "CMF 策略", "设计决策链"] },
  },
  {
    id: PORTFOLIO_TEMPLATE_ID, name: "工业设计作品集案例", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "把一个工业设计项目中的 Brief、证据、方向、概念、CMF、评审与版本组织为可追溯案例。",
    researchStrategy: { focus: ["问题定义", "过程证据", "版本迭代"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["过程板", "产品主图", "决策关系"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["设计决策链", "产品形态", "材料体验"] },
  },
  {
    id: BLANK_PRODUCT_TEMPLATE_ID, name: "空白产品设计项目", projectType: "ui", recommendedOutputs: ["digital_experience"],
    briefPlaceholder: "从真实产品命题开始，先确认用户、场景、问题和约束，再进入研究与造型。",
    researchStrategy: { focus: ["用户", "场景", "设计约束"], sourceMix: ["用户语境", "竞品观察"] },
    moodboardStrategy: { territoryHints: ["产品语义", "结构线索", "材料感受"], assetBias: "产品场景" },
    directionStrategy: { emphasis: ["产品形态", "结构与交互", "设计决策链"] },
  },
]);

export class TemplateCatalogRepository {
  list(): readonly ProjectTemplateDefinition[] { return phaseOneTemplateCatalog; }
  get(id: string): ProjectTemplateDefinition | undefined { return getPhaseOneTemplate(id); }
}

export function getPhaseOneTemplate(id: string): ProjectTemplateDefinition | undefined {
  return phaseOneTemplateCatalog.find((template) => template.id === id);
}
