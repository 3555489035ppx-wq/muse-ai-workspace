import test from "node:test";
import assert from "node:assert/strict";
import { createDesignBrief, validateDesignBrief, qualityReview } from "../src/lib/ai/designBriefProvider.js";

const daytide = {
  project: { id: "daytide", name: "DAYTIDE", type: "campaign", productDiscipline: "brand", description: "为城市年轻用户建立中国茶文化的当代表达。" },
  sourceBrief: {
    goal: "必须设计品牌快闪主视觉、入口空间、核心装置、茶饮杯、手提袋、菜单、活动海报、社交媒体宣传图和导视系统；请帮我完成 Moodboard、Creative Direction、Image Generation、AI Critique，并生成三个方向和版本记录。",
    audience: "18–28 岁城市年轻人，大学生与年轻白领；参考 Manner、Aesop、Gentle Monster。",
    context: "用户在上海商业区域经过 DAYTIDE 快闪空间，被入口吸引后进入体验、选择茶饮并产生拍摄或分享行为。希望摆脱传统新中式符号。",
    deliverables: ["品牌快闪主视觉", "入口空间", "核心装置", "茶饮杯", "手提袋", "菜单", "活动海报", "社交媒体宣传图", "导视系统"],
    constraints: ["保留中国茶文化来源", "视觉表达需要年轻但不过度潮流化", "兼顾线下体验和社交传播"],
    keywords: ["潮汐", "时间", "茶叶舒展", "城市节奏"],
    avoid: ["传统书法视觉", "中国红 + 金", "赛博霓虹", "为拍照牺牲长期品牌一致性的网红装置"],
  },
};

test("DAYTIDE uses brand + spatial domain and does not inherit industrial template", () => {
  const brief = createDesignBrief(daytide);
  assert.equal(brief.domain.primary, "brand_design");
  assert.equal(brief.domain.secondary, "spatial_design");
  assert.equal(brief.domain.mode, "mixed_brand_spatial");
  assert.match(brief.designObjective, /品牌视觉|空间/);
  assert.match(brief.coreDesignQuestion, /中国茶文化/);
  assert.equal(brief.coreDesignQuestion.split(/[？?]/).filter(Boolean).length, 1);
  assert.doesNotMatch(JSON.stringify(brief), /连续操作完成率|受力边界|量产细节|材料耐久测试|高频接触区域/);
  assert.ok(brief.referenceContext.some((item) => /Manner|Aesop|Gentle Monster/.test(item)));
  assert.ok(brief.workflowRequirements.length >= 3);
  assert.ok(brief.expectedOutcomes.suggested.length >= 1);
  assert.ok(brief.expectedOutcomes.suggested.every((item) => item.accepted === false && item.origin === "suggested"));
  assert.ok(brief.researchQuestions.length >= 3 && brief.researchQuestions.length <= 5);
});

test("industrial product keeps product-specific questions", () => {
  const brief = createDesignBrief({
    project: { id: "air", name: "夜间空气护理设备", productDiscipline: "industrial", type: "product" },
    sourceBrief: { goal: "为卧室夜间使用设计低打扰空气净化器。", audience: "夜间需要安静空气环境的居家用户", context: "卧室、书桌与入睡前", deliverables: ["产品概念", "CMF 方案"], constraints: ["低噪声", "易清洁"], avoid: ["医疗设备感"] },
  });
  assert.equal(brief.domain.primary, "industrial_design");
  assert.match(brief.coreQuestion ?? brief.coreDesignQuestion, /产品路径|操作|状态/);
  assert.ok(brief.initialSuccessCriteria.some((item) => /核心任务/.test(item.label)));
});

test("uiux output remains task and state oriented", () => {
  const brief = createDesignBrief({
    project: { id: "learn", name: "学习助手", type: "ui", productDiscipline: "ui" },
    sourceBrief: { goal: "帮助高中生制定学习计划并知道下一步做什么。", audience: "需要自主安排复习的高中生", context: "学生在手机上利用碎片时间查看计划、完成任务并调整进度", deliverables: ["核心流程原型"], constraints: ["反馈清晰", "降低首次使用理解成本"] },
  });
  assert.equal(brief.domain.primary, "uiux");
  assert.match(brief.designObjective, /任务|反馈/);
  assert.ok(brief.researchQuestions.every((item) => /任务|反馈|路径|用户/.test(item.label)));
});

test("short, long and process-heavy briefs pass bounded quality review", () => {
  const short = createDesignBrief({ project: { id: "short", name: "便携工具", productDiscipline: "industrial" }, sourceBrief: { goal: "设计一个便携工具。" } });
  assert.ok(validateDesignBrief(short).ok);
  const longText = "这是一个复杂的设计输入。".repeat(900);
  const long = createDesignBrief({ project: { id: "long", name: "复杂项目", type: "campaign" }, sourceBrief: { goal: longText, audience: "城市用户", context: "真实场景", deliverables: ["方案"], constraints: ["保持清晰"] } });
  assert.ok(long.designObjective.length <= 120);
  const process = createDesignBrief({ project: { id: "process", name: "流程项目", type: "campaign" }, sourceBrief: { goal: "请帮我生成三个方向、Moodboard、图片、AI Critique 和版本记录。", context: "品牌触点", deliverables: [] } });
  assert.ok(process.workflowRequirements.length >= 2);
  assert.doesNotMatch(process.designObjective, /Moodboard|生成三个|请帮我|AI Critique/);
  assert.equal(qualityReview(process, "").ok, true);
});
