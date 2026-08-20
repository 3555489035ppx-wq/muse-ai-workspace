import assert from "node:assert/strict";
import test from "node:test";
import { mergeIndustrialConcepts } from "../../src/data/industrialDraft.js";
import { getAvailableConcepts } from "../../src/domain/industrial/verticalSlice.js";

const concept = (id, name) => ({
  id,
  name,
  conceptStatement: `${name}把当前方向转化为可执行的产品体验。`,
  coreMechanism: "通过单一路径完成核心任务并在结束时回到稳定状态。",
  userExperience: "用户能够在真实场景中快速理解、完成并确认任务。",
  whyFitsDirection: "它把已锁定方向的核心规则落实到结构、交互和场景中。",
  brandExpression: "克制、可信且适合长期使用。",
  spatialExpression: "在目标空间中保持清晰的放置与取用关系。",
  productExpression: "主体、触点和状态反馈形成一致的产品语言。",
  digitalExpression: "状态反馈只在需要时出现，不打断连续任务。",
  evidenceIds: ["evidence-1"],
  insightIds: ["insight-1"],
  advantages: ["核心路径短", "结构关系清楚"],
  risks: ["仍需样机验证握持和耐久边界"],
  validationQuestions: ["用户能否一次完成核心任务？"],
});

test("真实概念响应写入 canonical conceptCandidates 后可被概念页读取", () => {
  const industrial = {
    selectedDirectionId: "direction-a",
    selectedConceptId: null,
    conceptCandidates: [],
    ai: {},
  };
  const response = {
    concepts: [concept("concept-1", "一杯茶的起手式"), concept("concept-2", "一杯茶的回环"), concept("concept-3", "一杯茶的收束")],
  };

  const merged = mergeIndustrialConcepts(industrial, response);

  assert.equal(merged.conceptCandidates.length, 3);
  assert.equal(getAvailableConcepts(merged).length, 3);
  assert.equal(merged.conceptCandidates[0].name, "一杯茶的起手式");
});
