import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { createJinganbaoIndustrialState, createJinganbaoSeed } from "../../src/data/jinganbao.js";
import { createMuseDatabase } from "../../src/db/database.ts";
import { seedJinganbaoDemo } from "../../src/db/seedJinganbao.js";
import {
  buildDeterministicReview,
  buildIndustrialExport,
  getAvailableConcepts,
  transitionIndustrialState,
} from "../../src/domain/industrial/verticalSlice.js";

function reachDirectionSelection(directionIndex = 0) {
  let state = createJinganbaoIndustrialState();
  state = transitionIndustrialState(state, { type: "BRIEF_CONFIRMED", at: "2026-08-01T09:00:00.000Z" });
  state = transitionIndustrialState(state, { type: "INSIGHT_TOGGLED", insightId: state.insights[0].id });
  state = transitionIndustrialState(state, { type: "INSIGHT_TOGGLED", insightId: state.insights[1].id });
  state = transitionIndustrialState(state, { type: "INSIGHTS_CONFIRMED" });
  return transitionIndustrialState(state, { type: "DIRECTION_LOCKED", directionId: state.directions[directionIndex].id });
}

test("路径 A：方向选择真实约束概念，并贯通 CMF、Review、版本和导出", () => {
  let state = reachDirectionSelection(0);
  const concepts = getAvailableConcepts(state);
  assert.equal(concepts.length, 3);
  assert.ok(concepts.every((item) => item.directionId === state.directions[0].id));

  state = transitionIndustrialState(state, { type: "CONCEPT_SELECTED", conceptId: concepts[1].id });
  state = transitionIndustrialState(state, { type: "CMF_SELECTED", cmfId: state.cmfSchemes[0].id });
  const review = buildDeterministicReview(state, "2026-08-01T10:00:00.000Z");
  assert.equal(review.context.conceptId, concepts[1].id);
  assert.equal(review.context.cmfId, state.cmfSchemes[0].id);
  assert.equal(review.issues.length, 9);
  assert.deepEqual(
    review.issues.map((item) => item.dimension),
    ["brief", "evidence", "direction", "concept", "visual", "interaction", "cmf", "feasibility", "risk"],
  );

  state = transitionIndustrialState(state, { type: "REVIEW_CREATED", review });
  state = transitionIndustrialState(state, {
    type: "REVISION_CREATED",
    issueId: review.issues[0].id,
    versionId: "version-test-a",
  });
  assert.equal(state.currentVersionId, "version-test-a");
  assert.equal(state.versionStory.at(-1).reviewTrigger, review.issues[0].title);

  const seed = createJinganbaoSeed();
  const payload = buildIndustrialExport({ ...seed.project, industrial: state });
  assert.equal(payload.direction.id, state.directions[0].id);
  assert.equal(payload.concept.id, concepts[1].id);
  assert.equal(payload.review.id, review.id);
  assert.match(payload.validationBoundary, /工程验证/);
});

test("路径 B：切换方向后候选概念集合确实改变", () => {
  const pathA = reachDirectionSelection(0);
  const pathB = reachDirectionSelection(1);
  const idsA = getAvailableConcepts(pathA).map((item) => item.id);
  const idsB = getAvailableConcepts(pathB).map((item) => item.id);
  assert.equal(idsA.length, 3);
  assert.equal(idsB.length, 3);
  assert.notDeepEqual(idsA, idsB);
  assert.ok(getAvailableConcepts(pathB).every((item) => item.directionId === pathB.directions[1].id));
});

test("错误路径：不能选择其他方向的概念", () => {
  const state = reachDirectionSelection(0);
  const foreignConcept = state.conceptCandidates.find((item) => item.directionId === state.directions[1].id);
  assert.throws(
    () => transitionIndustrialState(state, { type: "CONCEPT_SELECTED", conceptId: foreignConcept.id }),
    /CONCEPT_DIRECTION_MISMATCH/,
  );
});

test("刷新语义：序列化再恢复后保留所有关键选择", () => {
  let state = reachDirectionSelection(2);
  state = transitionIndustrialState(state, { type: "CONCEPT_SELECTED", conceptId: getAvailableConcepts(state)[0].id });
  state = transitionIndustrialState(state, { type: "CMF_SELECTED", cmfId: state.cmfSchemes[2].id });
  state = transitionIndustrialState(state, { type: "REVIEW_CREATED", review: buildDeterministicReview(state) });
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.selectedDirectionId, state.selectedDirectionId);
  assert.equal(restored.selectedConceptId, state.selectedConceptId);
  assert.equal(restored.selectedCMFId, state.selectedCMFId);
  assert.equal(restored.currentReviewId, state.currentReviewId);
  assert.equal(restored.decisions.length, state.decisions.length);
});

test("真实持久化：关闭并重开 IndexedDB 后仍保留方向选择", async () => {
  const name = `jinganbao-refresh-${Date.now()}-${Math.random()}`;
  const options = { dependencies: { indexedDB, IDBKeyRange } };
  const database = createMuseDatabase(name, options);
  await seedJinganbaoDemo(database);
  const seeded = await database.projects.toCollection().first();
  const selected = reachDirectionSelection(1);
  await database.projects.put({ ...seeded, industrial: selected });
  await database.close();

  const reloadedDatabase = createMuseDatabase(name, options);
  const reloaded = await reloadedDatabase.projects.get(seeded.id);
  assert.equal(reloaded.industrial.selectedDirectionId, selected.selectedDirectionId);
  assert.deepEqual(reloaded.industrial.selectedInsightIds, selected.selectedInsightIds);
  assert.equal(
    await reloadedDatabase.assets.filter((item) => item.projectId === seeded.id).count(),
    createJinganbaoSeed().assets.length,
  );
  await reloadedDatabase.delete();
});
