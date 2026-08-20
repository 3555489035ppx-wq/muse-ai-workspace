import test from "node:test";
import assert from "node:assert/strict";
import { createProjectOverview, createOriginalBriefSnapshot } from "../src/lib/ai/projectOverviewProvider.js";

function createInput(overrides = {}) {
  const sourceBrief = {
    goal: "把传统茶文化转译成当代日常茶饮产品，保留文化识别但避免复古和传统符号堆叠。",
    audience: "关注日常饮茶体验的年轻用户",
    context: "家庭与办公桌面的日常饮茶",
    deliverables: ["产品概念方案", "视觉识别系统"],
    constraints: ["保留茶文化识别", "避免复古表达"],
    keywords: ["克制", "当代", "日常", "材质"],
    avoid: ["复古", "传统符号堆叠"],
  };
  return {
    project: { id: "daytide", name: "DAYTIDE", productDiscipline: "industrial", type: "ui", description: sourceBrief.goal, ...overrides.project },
    sourceBrief: { ...sourceBrief, ...overrides.sourceBrief },
    industrial: { brief: { productCategory: "日常饮茶产品", keyNeeds: ["取用路径清晰"] }, ...overrides.industrial },
  };
}

test("Project Overview converts a long product brief into bounded structured understanding", () => {
  const overview = createProjectOverview(createInput());
  assert.equal(overview.projectName, "DAYTIDE");
  assert.deepEqual(overview.projectType, ["产品设计", "工业设计"]);
  assert.equal(overview.coreConflict.title, "文化识别 × 当代表达");
  assert.match(overview.coreConflict.explanation, /传统符号/);
  assert.ok([...overview.projectSummary].length <= 70);
  assert.ok([...overview.designGoal].length <= 100);
  assert.ok(overview.keywords.length <= 6);
  assert.ok(overview.mustAvoid.includes("复古"));
  assert.equal(new Set(overview.keywords).size, overview.keywords.length);
  assert.equal(overview.location, null);
  assert.equal(overview.timeContext, null);
});

test("Short brief does not hallucinate budget, area, location, or user research", () => {
  const overview = createProjectOverview(createInput({
    project: { id: "short", name: "未命名产品", productDiscipline: "industrial", description: "设计一个便携产品。" },
    sourceBrief: { goal: "设计一个便携产品。", audience: "", context: "", deliverables: [], constraints: [], keywords: [], avoid: [] },
    industrial: { brief: { productCategory: "日常使用产品", keyNeeds: [] } },
  }));
  const serialized = JSON.stringify(overview);
  assert.doesNotMatch(serialized, /预算|平方米|用户访谈\s*\d|已验证/);
  assert.ok(overview.openQuestions.length > 0);
  assert.ok(overview.openQuestions.length <= 3);
  assert.ok(overview.targetUser.traits.length <= 4);
});

test("Industrial context keeps scenario-specific conflict and avoids tea contamination", () => {
  const overview = createProjectOverview(createInput({
    project: { id: "air", name: "夜间空气护理设备", productDiscipline: "industrial", description: "为夜间卧室提供低打扰空气护理，状态要清晰但不能打扰睡眠。" },
    sourceBrief: {
      goal: "为夜间卧室提供低打扰空气护理，状态要清晰但不能打扰睡眠。",
      audience: "夜间需要安静空气环境的居家用户",
      context: "卧室夜间使用",
      deliverables: ["产品概念", "CMF 方案"],
      constraints: ["低噪声", "易清洁"],
      keywords: ["安静", "克制"],
      avoid: ["高频闪烁"],
    },
    industrial: { brief: { productCategory: "环境体验产品", keyNeeds: ["反馈需要克制"] } },
  }));
  assert.equal(overview.coreConflict.title, "状态可读 × 低打扰");
  assert.ok(!overview.projectSummary.includes("茶文化"));
  assert.ok(!overview.keywords.includes("文化识别"));
  assert.ok(overview.mustAvoid.includes("高频闪烁"));
});

test("Original Brief snapshot keeps user fields separate from AI output", () => {
  const input = createInput();
  const snapshot = createOriginalBriefSnapshot(input);
  assert.equal(snapshot.designGoal, input.sourceBrief.goal);
  assert.deepEqual(snapshot.deliverables, input.sourceBrief.deliverables);
  assert.deepEqual(snapshot.avoid, input.sourceBrief.avoid);
  assert.equal(snapshot.projectName, input.project.name);
  assert.equal(snapshot.schemaVersion, 1);
});
