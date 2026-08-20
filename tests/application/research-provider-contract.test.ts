import assert from "node:assert/strict";
import test from "node:test";
import { ResearchProviderError, validateResearchProviderOutput, type ResearchProviderOutput } from "../../src/application/research/index.js";

const validOutput: ResearchProviderOutput = {
  understanding: "理解项目目标与受众语境",
  sources: [{ key: "s1", type: "archive", title: "研究假设来源", provenance: "mock_hypothesis" }],
  evidence: [{ key: "e1", sourceKey: "s1", excerpt: "仅用于产品流程演示，等待核验。", evidenceStatus: "待核验" }],
  observations: [{ key: "o1", evidenceKeys: ["e1"], statement: "视觉语境观察", category: "视觉" }],
  insights: [{ key: "i1", observationKeys: ["o1"], statement: "从观察形成洞察" }],
  opportunities: [{ key: "p1", insightKeys: ["i1"], statement: "从洞察形成机会" }],
  seeds: [{ key: "c1", opportunityKeys: ["p1"], title: "创意种子", premise: "从机会形成可探索命题" }],
};

void test("research provider contract validates complete candidate lineage", () => {
  assert.equal(validateResearchProviderOutput(validOutput), validOutput);
});

void test("research provider contract rejects missing parent candidate mapping", () => {
  assert.throws(() => validateResearchProviderOutput({ ...validOutput, evidence: [{ key: "e1", sourceKey: "missing", excerpt: "待核验", evidenceStatus: "待核验" }] }), (error: unknown) => error instanceof ResearchProviderError && error.code === "INVALID_OUTPUT");
});

void test("research provider exposes stable error and cancellation codes", () => {
  const cancelled = new ResearchProviderError("CANCELLED", "研究已取消");
  assert.equal(cancelled.code, "CANCELLED");
  assert.equal(cancelled.name, "ResearchProviderError");
});
