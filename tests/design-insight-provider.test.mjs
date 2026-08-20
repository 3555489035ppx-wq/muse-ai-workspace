import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConfirmedDesignBriefContext,
  generateDesignInsights,
  getAcceptedResearchEvidence,
  qualityReviewDesignInsights,
} from "../src/lib/ai/designInsightProvider.js";

const project = {
  id: "daytide-v2",
  name: "昼汐 DAYTIDE",
  productDiscipline: "brand",
  originalBrief: "Moodboard / Image Generation / AI Critique / 视觉生成 / 产品结构 / 维护 / 量产",
  designBrief: {
    status: "confirmed",
    domain: { primary: "brand_design", secondary: "spatial_design", mode: "mixed_brand_spatial" },
    coreDesignQuestion: "如何让春季快闪空间被快速识别，又不落入传统符号堆叠？",
    designObjective: "建立贯穿品牌与空间触点的当代表达。",
    coreTension: { title: "文化来源 × 当代表达", explanation: "既让人感到来源，又不依赖陈旧符号。" },
    targetUser: { primary: "城市年轻茶饮用户" },
    coreScenario: "用户进入春季茶饮快闪空间，完成体验、选择与分享。",
    designRequirements: [{ label: "形成可被记住的入口线索" }, { label: "让品牌与空间共享规则" }],
    designExclusions: [{ label: "堆叠传统装饰" }],
    initialSuccessCriteria: [{ label: "用户能复述体验来源" }],
  },
  researchWorkspace: {
    evidence: [
      { id: "e-01", sourceId: "s-01", type: "verified", userStatus: "accepted", title: "访谈中的文化理解", sourceName: "用户访谈 01", originalExcerpt: "用户更容易记住冲泡过程里的等待和选择，而不是墙上的传统图案。", interpretation: "文化来源通过过程被理解。", designImplication: "需要让过程成为可参与节点。", questionIds: ["rq-1"], lensIds: ["culture"], traceableSource: true },
      { id: "e-02", sourceId: "s-02", type: "verified", userStatus: "accepted", title: "空间停留观察", sourceName: "现场观察 02", originalExcerpt: "多数用户进入后先寻找点单和停留的位置，路径不清晰时会直接离开。", interpretation: "入口和动线影响判断。", designImplication: "入口需要先给出可行动线索。", questionIds: ["rq-2"], lensIds: ["spatial"], traceableSource: true },
      { id: "e-03", sourceId: "s-03", type: "verified", userStatus: "accepted", title: "分享行为记录", sourceName: "社交行为记录 03", originalExcerpt: "用户愿意分享能用一句话讲清楚的体验变化，而不是单独的拍照背景。", interpretation: "分享需要体验原因。", designImplication: "设置可被复述的体验节点。", questionIds: ["rq-3"], lensIds: ["social"], traceableSource: true },
      { id: "e-04", sourceId: "s-04", type: "verified", userStatus: "accepted", title: "品牌认知访谈", sourceName: "品牌访谈 04", originalExcerpt: "年轻用户不排斥文化来源，但会忽略只靠颜色和符号表达的品牌。", interpretation: "年轻感来自互动方式。", designImplication: "把品牌行为做成跨触点规则。", questionIds: ["rq-1", "rq-4"], lensIds: ["brand"], traceableSource: true },
      { id: "e-05", sourceId: "s-05", type: "candidate", userStatus: "unreviewed", title: "未保留材料", sourceName: "草稿", originalExcerpt: "这条材料不应进入洞察。", questionIds: ["rq-1"], lensIds: ["culture"], traceableSource: true },
    ],
  },
};

test("Insight context only uses confirmed brief fields and accepted evidence", () => {
  const context = buildConfirmedDesignBriefContext(project);
  const accepted = getAcceptedResearchEvidence(project);
  assert.equal(accepted.length, 4);
  assert.equal(JSON.stringify(context).includes("Moodboard"), false);
  assert.equal(JSON.stringify(context).includes("Image Generation"), false);
  assert.equal(JSON.stringify(context).includes("产品结构"), false);
});

test("DAYTIDE generates dynamic, evidence-backed insights without industrial contamination", () => {
  const result = generateDesignInsights(project);
  assert.equal(result.gate.ready, true);
  assert.ok(result.insights.length >= 3 && result.insights.length <= 5);
  assert.equal(result.quality.ok, true);
  assert.ok(result.insights.some((item) => item.evidenceIds.length >= 2));
  assert.ok(result.insights.every((item) => item.evidenceIds.every((id) => ["e-01", "e-02", "e-03", "e-04"].includes(id))));
  const text = JSON.stringify(result.insights);
  assert.equal(/Moodboard|Image Generation|AI Critique|产品结构|维护|量产|滤芯|承重/.test(text), false);
});

test("two accepted evidence items produce two cross-evidence candidate insights", () => {
  const reduced = { ...project, researchWorkspace: { evidence: project.researchWorkspace.evidence.slice(0, 2) } };
  const result = generateDesignInsights(reduced);
  assert.equal(result.gate.ready, true);
  assert.equal(result.insights.length, 2);
  assert.equal(result.insights.every((item) => item.inferenceType === "cross_evidence_pattern"), true);
  assert.equal(result.insights.every((item) => item.evidenceStrength === "strong"), true);
});

test("mixed brand and spatial quality gate rejects unsupported industrial vocabulary", () => {
  const result = qualityReviewDesignInsights({
    project,
    evidence: project.researchWorkspace.evidence.slice(0, 2),
    insights: [{
      id: "bad-01",
      title: "空间维护效率",
      insightStatement: "维护路径决定产品结构是否成立。",
      patternSummary: "重复出现结构与维护。",
      whyItMatters: "维护成本会影响使用。",
      designImplication: "优化滤芯和承重。",
      evidenceIds: ["e-01"],
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("contamination")));
});
