import assert from "node:assert/strict";
import test from "node:test";

import {
  isCreativeSeed,
  isResearchEvidence,
  isResearchInsight,
  isResearchObservation,
  isResearchOpportunity,
  isResearchSession,
  isResearchSource,
} from "../../src/domain/research/index.js";

const id = (suffix: string): string =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const base = {
  projectId: id("1"),
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z",
};
const sessionId = id("3");

const session = {
  ...base,
  id: sessionId,
  briefId: id("2"),
  query: "山西文化遗产年轻化",
  status: "active",
};
const source = {
  ...base,
  id: id("4"),
  researchSessionId: sessionId,
  type: "archive",
  title: "地方文化档案",
};
const evidence = {
  ...base,
  id: id("5"),
  researchSessionId: sessionId,
  sourceId: source.id,
  excerpt: "可核验的资料摘录",
};
const observation = {
  ...base,
  id: id("6"),
  researchSessionId: sessionId,
  evidenceIds: [evidence.id],
  statement: "观察",
};
const insight = {
  ...base,
  id: id("7"),
  researchSessionId: sessionId,
  observationIds: [observation.id],
  statement: "洞察",
};
const opportunity = {
  ...base,
  id: id("8"),
  researchSessionId: sessionId,
  insightIds: [insight.id],
  statement: "机会",
};
const seed = {
  ...base,
  id: id("9"),
  researchSessionId: sessionId,
  opportunityIds: [opportunity.id],
  title: "创意种子",
  premise: "从在地材料建立当代表达",
};

void test("research guards accept a complete ID-only lineage", () => {
  assert.equal(isResearchSession(session), true);
  assert.equal(isResearchSource(source), true);
  assert.equal(isResearchEvidence(evidence), true);
  assert.equal(isResearchObservation(observation), true);
  assert.equal(isResearchInsight(insight), true);
  assert.equal(isResearchOpportunity(opportunity), true);
  assert.equal(isCreativeSeed(seed), true);
});

void test("research guards reject missing parent IDs and wrong field types", () => {
  assert.equal(isResearchSession({ ...session, briefId: undefined }), false);
  assert.equal(isResearchSource({ ...source, type: "social" }), false);
  assert.equal(isResearchEvidence({ ...evidence, sourceId: "bad" }), false);
  assert.equal(isResearchObservation({ ...observation, evidenceIds: [] }), false);
  assert.equal(isResearchObservation({ ...observation, evidenceIds: [1] }), false);
  assert.equal(isResearchInsight({ ...insight, observationIds: [] }), false);
  assert.equal(isResearchOpportunity({ ...opportunity, insightIds: [] }), false);
  assert.equal(isCreativeSeed({ ...seed, opportunityIds: [] }), false);
  assert.equal(isCreativeSeed({ ...seed, researchSessionId: "bad" }), false);
});

void test("CreativeSeed can be walked backwards by explicit IDs", () => {
  assert.equal(seed.opportunityIds[0], opportunity.id);
  assert.equal(opportunity.insightIds[0], insight.id);
  assert.equal(insight.observationIds[0], observation.id);
  assert.equal(observation.evidenceIds[0], evidence.id);
  assert.equal(evidence.sourceId, source.id);
  assert.equal(source.researchSessionId, session.id);
  assert.equal(session.projectId, base.projectId);
});
