import test from "node:test";
import assert from "node:assert/strict";
import { acceptResearchEvidence, createResearchWorkspace } from "../src/lib/ai/researchEvidenceProvider.js";
import { generateDesignInsights } from "../src/lib/ai/designInsightProvider.js";
import { generateDesignDirections, getDirectionRecommendation } from "../src/lib/ai/designDirectionProvider.js";

const brief = {
  status: "confirmed",
  domain: { primary: "brand_design", secondary: "spatial_design", mode: "mixed_brand_spatial" },
  coreDesignQuestion: "如何在上海春季快闪中建立不依赖传统视觉符号的当代茶文化体验？",
  designObjective: "为 18—28 岁城市青年建立统一的品牌与空间体验。",
  coreTension: { title: "文化来源与当代表达", explanation: "保留中国茶文化来源，同时避免传统视觉套用。" },
  targetUser: { primary: "18—28 岁上海城市青年", relevantTraits: ["通勤", "社交", "短暂停留"] },
  coreScenario: "上海春季城市快闪，用户在通勤、午后与社交时段进入空间。",
  designRequirements: [{ label: "品牌与空间使用同一条体验规则" }, { label: "短暂停留也能理解核心价值" }],
  designConstants: [{ label: "文化来源可追溯" }],
  designExclusions: [{ label: "不使用书法、青花等传统符号拼贴" }],
  initialSuccessCriteria: [{ label: "用户能复述体验机制" }],
};

function daytideProject() {
  return { id: "e3228021-a528-4aa9-bfcb-4a1875d2124d", name: "昼汐 DAYTIDE｜2027 春季城市快闪概念设计", designBrief: brief, industrial: { selectedInsightIds: [], directions: [] } };
}

test("DAYTIDE executes the real 3 candidate → 2 accepted → 2 confirmed → 3 direction chain", () => {
  let project = daytideProject();
  let workspace = createResearchWorkspace({ project, brief });
  assert.equal(workspace.evidence.length, 3);
  assert.equal(workspace.insightGate.acceptedEvidenceCount, 0);

  for (const id of ["daytide-e01", "daytide-e02"]) {
    const accepted = acceptResearchEvidence(workspace, id);
    assert.equal(accepted.ok, true);
    workspace = accepted.workspace;
  }
  assert.equal(workspace.insightGate.ready, true);
  project = { ...project, researchWorkspace: workspace };

  const insightResult = generateDesignInsights(project);
  assert.ok(insightResult.insights.length >= 2 && insightResult.insights.length <= 4);
  assert.equal(insightResult.insights.every((item) => item.evidenceIds.length >= 1), true);
  const confirmed = insightResult.insights.slice(0, 2).map((item) => ({ ...item, status: "confirmed" }));
  project = { ...project, designInsights: confirmed, confirmedInsightIds: confirmed.map((item) => item.id), industrial: { selectedInsightIds: confirmed.map((item) => item.id), directions: [] } };

  const directionResult = generateDesignDirections(project);
  assert.equal(directionResult.gate.ready, true);
  assert.equal(directionResult.candidates.length, 6);
  assert.equal(directionResult.directions.length, 3);
  assert.equal(new Set(directionResult.directions.map((item) => item.strategyKey)).size, 3);
  assert.equal(directionResult.directions.every((item) => item.evidenceIds.length && item.insightIds.length && item.image === null), true);
  assert.equal(/共创叙事|城市节奏|参与仪式/.test(JSON.stringify(directionResult)), false);
  assert.equal(getDirectionRecommendation(directionResult.directions, directionResult.context).enabled, true);
});
