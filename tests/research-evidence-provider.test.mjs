import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptResearchEvidence,
  createCandidateEvidence,
  createResearchAssistant,
  createResearchSource,
  createResearchWorkspace,
  getResearchLenses,
  getResearchQuestions,
  normalizeResearchAssistantResult,
  recomputeResearchWorkspace,
  researchQualityReview,
} from "../src/lib/ai/researchEvidenceProvider.js";

const daytideBrief = {
  domain: { primary: "brand_design", secondary: "spatial_design", mode: "mixed_brand_spatial" },
  coreScenario: "城市年轻用户进入春季茶饮快闪空间，完成体验、选择与分享。",
  designObjective: "建立可贯穿品牌与空间触点的当代表达。",
  researchQuestions: [
    { id: "rq-1", label: "用户如何理解品牌的文化来源？" },
    { id: "rq-2", label: "空间中哪些触点影响第一次识别？" },
    { id: "rq-3", label: "哪些体验会促使用户分享？" },
  ],
  assumptions: [{ label: "文化识别不必依赖传统符号。" }],
};

const industrialBrief = {
  domain: { primary: "industrial_design", mode: "industrial_design" },
  researchQuestions: [{ id: "rq-1", label: "用户如何完成核心任务？" }, { id: "rq-2", label: "维护会造成什么负担？" }, { id: "rq-3", label: "同类产品如何组织结构？" }],
};

test("mixed brand and spatial projects use cultural, brand and spatial lenses", () => {
  const lenses = getResearchLenses(daytideBrief, { id: "daytide" });
  assert.ok(lenses.some((item) => item.id === "culture"));
  assert.ok(lenses.some((item) => item.id === "spatial"));
  assert.equal(lenses.some((item) => item.id === "maintenance"), false);
});

test("industrial projects keep product research lenses", () => {
  const lenses = getResearchLenses(industrialBrief, { id: "industrial", productDiscipline: "industrial" });
  assert.ok(lenses.some((item) => item.id === "maintenance"));
  assert.ok(lenses.some((item) => item.id === "material"));
  assert.equal(lenses.some((item) => item.id === "culture"), false);
});

test("DAYTIDE workspace loads traceable public-source candidates without auto-accepting them", () => {
  const workspace = createResearchWorkspace({ project: { id: "daytide" }, brief: daytideBrief });
  assert.deepEqual(workspace.questions.map((item) => item.id), ["rq-1", "rq-2", "rq-3"]);
  assert.equal(workspace.evidence.length, 3);
  assert.equal(workspace.evidence.every((item) => item.type === "candidate" && item.userStatus === "unreviewed"), true);
  assert.equal(workspace.evidence.every((item) => item.sourceUrl && item.originalExcerpt && item.fact && item.interpretation && item.limitations), true);
  assert.equal(workspace.mode, "public_source_fixture");
  assert.equal(workspace.insightGate.acceptedEvidenceCount, 0);
});

test("non-DAYTIDE projects remain in Limited Research Mode instead of receiving fabricated evidence", () => {
  const workspace = createResearchWorkspace({ project: { id: "other", name: "工业净化设备" }, brief: industrialBrief });
  assert.equal(workspace.evidence.length, 0);
  assert.equal(workspace.mode, "limited");
  assert.equal(workspace.providerStatus, "unavailable");
});

test("AI research assistant normalizes plans without creating evidence", () => {
  const workspace = createResearchWorkspace({ project: { id: "other", name: "工业净化设备" }, brief: industrialBrief });
  const result = normalizeResearchAssistantResult({
    questionPlans: [
      { questionId: "rq-1", whyThisMatters: "核心任务决定产品是否真正可用。", evidenceNeed: "需要观察动作顺序和中断位置。", querySuggestions: ["便携净化设备 单手操作 用户观察", "空气净化器 夜间操作 任务研究"], preferredSources: ["用户观察", "可用性报告"] },
      { questionId: "unknown", whyThisMatters: "不应保留", evidenceNeed: "不应保留", querySuggestions: ["无效线索一", "无效线索二"], preferredSources: ["网页"] },
    ],
    gaps: ["缺少真实用户动作记录"],
    nextActions: ["打开检索词并添加带原文摘录的来源"],
  }, workspace.questions);
  assert.equal(result.questionPlans.length, 1);
  assert.equal(result.questionPlans[0].questionId, "rq-1");
  assert.equal(createResearchAssistant({ status: "success", questionPlans: result.questionPlans }).status, "success");
  assert.equal(workspace.evidence.length, 0);
});

test("a URL without source excerpt cannot be verified", () => {
  const workspace = createResearchWorkspace({ project: { id: "daytide" }, brief: daytideBrief });
  const source = createResearchSource({ kind: "url", name: "外部链接", sourceUrl: "https://example.com/report" });
  const evidence = createCandidateEvidence({ project: { id: "daytide" }, brief: daytideBrief, source, questionIds: ["rq-1"] });
  const next = recomputeResearchWorkspace({ ...workspace, sources: [source], evidence: [evidence] });
  const accepted = acceptResearchEvidence(next, evidence.id);
  assert.equal(accepted.ok, false);
  assert.equal(accepted.error, "EVIDENCE_NEEDS_SOURCE");
});

test("user provided excerpt can be accepted and enters summary", () => {
  const workspace = createResearchWorkspace({ project: { id: "daytide" }, brief: daytideBrief });
  const source = createResearchSource({ kind: "user_paste", name: "访谈记录 01", originalExcerpt: "用户说进入空间后先寻找可以理解品牌的入口线索。" });
  const evidence = createCandidateEvidence({ project: { id: "daytide" }, brief: daytideBrief, source, questionIds: ["rq-1", "rq-2"] });
  const next = recomputeResearchWorkspace({ ...workspace, sources: [source], evidence: [evidence] });
  const accepted = acceptResearchEvidence(next, evidence.id);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.workspace.evidence[0].type, "verified");
  assert.match(accepted.workspace.researchSummary, /已采纳 1 条证据/);
});

test("insight gate requires two evidence items, two questions and two independent sources", () => {
  const workspace = createResearchWorkspace({ project: { id: "daytide" }, brief: daytideBrief });
  const evidence = [1, 2, 3].map((index) => ({
    id: `e-${index}`, sourceId: `s-${index < 2 ? index : 2}`, type: "verified", userStatus: "accepted", questionIds: [`rq-${index === 3 ? 3 : index}`], lensIds: ["culture"], originalExcerpt: `原始摘录 ${index}`, sourceUrl: `https://example.com/${index}`,
  }));
  const next = recomputeResearchWorkspace({ ...workspace, evidence });
  assert.equal(next.insightGate.ready, true);
});

test("quality review rejects verified evidence without provenance", () => {
  const result = researchQualityReview({ evidence: [{ id: "bad", type: "verified", originalExcerpt: "事实" }] });
  assert.equal(result.ok, false);
});
