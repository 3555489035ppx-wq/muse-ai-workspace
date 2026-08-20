import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectionContext,
  generateDesignDirections,
  getDirectionRecommendation,
  qualityReviewDesignDirections,
} from "../src/lib/ai/designDirectionProvider.js";

function makeProject(overrides = {}) {
  const project = {
    id: "daytide-test",
    name: "DAYTIDE 春季城市快闪",
    productDiscipline: "industrial",
    originalBrief: { designGoal: "生成 Moodboard、Image Generation 和 AI Critique 图片" },
    designBrief: {
      status: "confirmed",
      domain: { primary: "mixed_brand_spatial", mode: "mixed_brand_spatial" },
      coreDesignQuestion: "如何让茶文化在城市快闪中被自然理解并愿意再次参与？",
      designObjective: "建立一段可参与、可复述且适合城市节奏的品牌体验。",
      coreTension: { title: "来源与当代", explanation: "文化来源的真实感与年轻城市用户的轻量参与之间存在张力。" },
      targetUser: { primary: "上海年轻城市用户", relevantTraits: ["短暂停留", "愿意分享", "重视真实感"] },
      coreScenario: "用户在城市快闪空间中短暂停留、参与并与同行者交流。",
      designRequirements: [{ id: "req-1", label: "短暂停留也能理解核心价值", origin: "explicit" }, { id: "req-2", label: "让参与过程有清楚的开始和结束", origin: "explicit" }],
      designConstants: [{ id: "constant-1", label: "保留真实茶文化来源", origin: "explicit" }],
      designExclusions: [{ id: "exclude-1", label: "避免把文化做成装饰符号", origin: "explicit" }],
      initialSuccessCriteria: [{ id: "success-1", label: "用户能复述一次关键体验", origin: "explicit" }],
    },
    researchWorkspace: {
      evidence: [
        { id: "evidence-1", type: "verified", userStatus: "accepted", traceableSource: true, sourceName: "城市访谈 01", title: "短暂停留中的参与", originalExcerpt: "用户在经过快闪时会先判断是否能在几分钟内理解并加入。", interpretation: "停留时间决定入口关系。", designImplication: "入口需要让用户快速知道如何加入。", questionIds: ["rq-1"], lensIds: ["lens-space"] },
        { id: "evidence-2", type: "verified", userStatus: "accepted", traceableSource: true, sourceName: "回访记录 02", title: "文化来源的记忆", originalExcerpt: "用户愿意分享自己亲手参与的过程，而不是只拍一张装饰照片。", interpretation: "可复述的过程比符号更容易被记住。", designImplication: "体验需要留下一个能被讲述的节点。", questionIds: ["rq-2"], lensIds: ["lens-brand"] },
      ],
    },
    designInsights: [
      { id: "insight-1", title: "参与比说明更能留下记忆", insightStatement: "用户需要通过参与过程理解文化来源。", whyItMatters: "单向说明容易被忽略。", designImplication: "把文化来源落到可参与的体验节点。", evidenceIds: ["evidence-1", "evidence-2"], status: "confirmed" },
      { id: "insight-2", title: "短停也要有完整体验", insightStatement: "短暂停留必须能够完成核心理解。", whyItMatters: "城市流动不会等待长篇解释。", designImplication: "入口和停留节奏要支持不同时间长度。", evidenceIds: ["evidence-1"], status: "confirmed" },
    ],
    confirmedInsightIds: ["insight-1", "insight-2"],
    industrial: { selectedInsightIds: ["insight-1", "insight-2"], directions: [{ id: "legacy-a" }, { id: "legacy-b" }, { id: "legacy-c" }] },
  };
  return { ...project, ...overrides };
}

test("DirectionContext excludes OriginalBrief and keeps accepted evidence plus confirmed insights", () => {
  const context = buildDirectionContext(makeProject());
  assert.equal(context.domain.mode, "mixed_brand_spatial");
  assert.equal(context.acceptedEvidence.length, 2);
  assert.equal(context.confirmedInsights.length, 2);
  assert.equal(JSON.stringify(context).includes("Moodboard"), false);
  assert.equal(JSON.stringify(context).includes("Image Generation"), false);
});

test("DAYTIDE evaluates six candidates, selects three maximally distinct image-free strategies", () => {
  const result = generateDesignDirections(makeProject());
  assert.equal(result.generationMeta.candidateCount, 6);
  assert.equal(result.directions.length, 3);
  assert.equal(new Set(result.directions.map((item) => item.strategyKey)).size, 3);
  assert.equal(result.directions.every((item) => item.image === null && item.evidenceIds.length > 0 && item.insightIds.length > 0), true);
  assert.equal(result.quality.ok, true, result.quality.errors.join("\n"));
  assert.equal(result.directions.some((item) => /维护|模块|量产|受力/.test(item.thesis)), false);
  assert.ok(result.pairwiseDifferences.AB && result.pairwiseDifferences.AC && result.pairwiseDifferences.BC);
  assert.equal(result.directions.every((item) => item.fundamentalDifference && item.strategicMechanism && item.designConsequences.length), true);
});

test("different domains use different strategy lanes", () => {
  const industrial = makeProject({ id: "industrial-test", name: "净安宝便携净水设备", designBrief: { ...makeProject().designBrief, domain: { primary: "industrial_design", mode: "industrial_design" } } });
  const uiux = makeProject({ id: "uiux-test", name: "研究协作工作台", designBrief: { ...makeProject().designBrief, domain: { primary: "uiux", mode: "uiux" } } });
  const industrialResult = generateDesignDirections(industrial);
  const uiuxResult = generateDesignDirections(uiux);
  assert.notDeepEqual(industrialResult.directions.map((item) => item.strategyKey), uiuxResult.directions.map((item) => item.strategyKey));
  assert.notEqual(industrialResult.directions[0].name, uiuxResult.directions[0].name);
});

test("insufficient evidence is explicit and never fabricated", () => {
  const project = makeProject({
    researchWorkspace: { evidence: [] },
    designInsights: [],
    confirmedInsightIds: [],
  });
  const result = generateDesignDirections(project);
  assert.equal(result.directions.length, 0);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.gate.ready, false);
  const recommendation = getDirectionRecommendation(result.directions, result.context);
  assert.equal(recommendation.enabled, false);
});

test("quality review rejects duplicate strategies and image pollution", () => {
  const result = generateDesignDirections(makeProject());
  const duplicate = [{ ...result.directions[0], strategyKey: "same" }, { ...result.directions[1], strategyKey: "same" }, { ...result.directions[2], image: "data:image/png;base64,broken" }];
  const review = qualityReviewDesignDirections({ project: makeProject(), directions: duplicate, context: result.context });
  assert.equal(review.ok, false);
  assert.equal(review.errors.some((error) => error.includes("duplicated strategy key")), true);
  assert.equal(review.errors.some((error) => error.includes("image generation")), true);
});

test("recommendation provides reasons and risk without locking", () => {
  const result = generateDesignDirections(makeProject());
  const recommendation = getDirectionRecommendation(result.directions, result.context);
  assert.equal(recommendation.enabled, true);
  assert.ok(recommendation.directionId);
  assert.ok(recommendation.reasons.length >= 2 && recommendation.reasons.length <= 3);
  assert.ok(recommendation.risk);
  assert.equal(recommendation.tradeoffs.length, 2);
});
