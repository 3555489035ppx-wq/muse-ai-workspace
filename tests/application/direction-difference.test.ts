import assert from "node:assert/strict";
import test from "node:test";
import { axisDifferenceCount, DirectionDifferenceError, keywordOverlap, validateDirectionDifference, type DirectionCandidate } from "../../src/application/direction/index.js";
import { asEntityId } from "../../src/domain/shared/id.js";

const id = (value: number) => asEntityId(`${String(value).padStart(8, "0")}-0000-4000-8000-000000000001`);
const candidate = (value: number): DirectionCandidate => { const label = String(value); return { key: `d${label}`, title: `方向${label}`, concept: `概念${label}`, narrative: `叙事${label}`, keywords: [`词${label}`, `标签${label}`], axisValues: { composition: `构图${label}`, typography: `字体${label}`, color: `色彩${label}`, image: `图像${label}`, material: `材质${label}` }, heroAssetId: id(value), references: [{ assetId: id(value), role: "inspiration" }], advantages: ["优势"], risks: ["风险"], status: "candidate", researchSessionId: id(10), moodboardId: id(11), visualDNAId: id(12), creativeSeedIds: [id(13)], opportunityIds: [id(14)] }; };
const valid = [candidate(1), candidate(2), candidate(3)] as const;

void test("direction difference accepts a genuinely distinct set", () => {
  assert.equal(validateDirectionDifference(valid), valid);
  assert.equal(axisDifferenceCount(valid[0], valid[1]), 5);
  assert.equal(keywordOverlap([], []), 0);
});

void test("direction difference rejects count, duplicate image, concept and narrative", () => {
  assert.throws(() => validateDirectionDifference(valid.slice(0, 2)), (error) => error instanceof DirectionDifferenceError && error.code === "COUNT");
  assert.throws(() => validateDirectionDifference([valid[0], { ...valid[1], heroAssetId: valid[0].heroAssetId }, valid[2]]), (error) => error instanceof DirectionDifferenceError && error.code === "DUPLICATE_HERO");
  assert.throws(() => validateDirectionDifference([valid[0], { ...valid[1], concept: valid[0].concept }, valid[2]]), (error) => error instanceof DirectionDifferenceError && error.code === "DUPLICATE_CONCEPT");
  assert.throws(() => validateDirectionDifference([valid[0], { ...valid[1], narrative: valid[0].narrative }, valid[2]]), (error) => error instanceof DirectionDifferenceError && error.code === "DUPLICATE_NARRATIVE");
});

void test("direction difference rejects color-only changes and high keyword overlap", () => {
  const colorOnly = { ...valid[1], axisValues: { ...valid[0].axisValues, color: "另一色" } };
  assert.throws(() => validateDirectionDifference([valid[0], colorOnly, valid[2]]), (error) => error instanceof DirectionDifferenceError && error.code === "INSUFFICIENT_AXIS_DIFFERENCE");
  const overlap = { ...valid[1], keywords: ["词1", "标签1", "新词"] };
  assert.throws(() => validateDirectionDifference([valid[0], overlap, valid[2]]), (error) => error instanceof DirectionDifferenceError && error.code === "KEYWORD_OVERLAP");
  assert.equal(keywordOverlap(["A", "B"], ["a", "c"]), 1 / 3);
});
