import assert from "node:assert/strict";
import test from "node:test";
import { isPromptSpec, isPromptVersion } from "../../src/domain/prompt/index.js";
import { isGeneratedAsset, isGenerationJob, isImageEdit } from "../../src/domain/generation/index.js";
import { isAIReview, isReviewDimension } from "../../src/domain/review/index.js";

const id = (suffix: string): string => `30000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const base = { projectId: id("1"), createdAt: "2026-07-28T08:00:00.000Z", updatedAt: "2026-07-28T08:00:00.000Z" };
const lineage = { explorationId: id("2"), directionId: id("3"), visualDNAId: id("4"), researchSessionId: id("5") };
const spec = { ...base, ...lineage, id: id("6"), adapterTarget: "generic_image", objective: "主视觉探索", constraints: ["保持文化准确性"] };
const version = { ...base, ...lineage, id: id("7"), promptSpecId: spec.id, adapterTarget: "generic_image", version: 1, promptText: "结构化提示词" };
const job = { ...base, id: id("8"), promptVersionId: version.id, adapterTarget: "generic_image", status: "succeeded" };
const generated = { ...base, id: id("9"), generationJobId: job.id, promptVersionId: version.id, assetId: id("10"), mimeType: "image/png", width: 1024, height: 1024 };
const dimension = { dimension: "goal_alignment", score: 88, evidenceIds: [generated.id], evidence: "主视觉层级清晰", problem: "次级信息偏弱", reason: "字号层级接近", impact: "快速浏览时识别下降", recommendation: "拉开字号层级" };

void test("prompt, generation and review entities form an ID-only reverse chain", () => {
  assert.equal(isPromptSpec(spec), true);
  assert.equal(isPromptVersion(version), true);
  assert.equal(isGenerationJob(job), true);
  assert.equal(isGeneratedAsset(generated), true);
  assert.equal(isReviewDimension(dimension), true);
  assert.equal(isAIReview({ ...base, id: id("11"), generatedAssetId: generated.id, promptVersionId: version.id, directionId: lineage.directionId, dimensions: [dimension], summary: "可继续迭代" }), true);
});

void test("guards reject incomplete lineage and invalid statuses or dimensions", () => {
  assert.equal(isPromptSpec({ ...spec, visualDNAId: "bad" }), false);
  assert.equal(isPromptVersion({ ...version, version: 0 }), false);
  assert.equal(isGenerationJob({ ...job, status: "done" }), false);
  assert.equal(isGeneratedAsset({ ...generated, width: 0 }), false);
  assert.equal(isReviewDimension({ ...dimension, evidenceIds: [] }), false);
  assert.equal(isReviewDimension({ ...dimension, problem: "" }), false);
  assert.equal(isReviewDimension({ ...dimension, reason: "" }), false);
  assert.equal(isReviewDimension({ ...dimension, impact: "" }), false);
  assert.equal(isReviewDimension({ ...dimension, recommendation: "" }), false);
});

void test("image edit types and parent IDs are explicit", () => {
  const edit = { ...base, id: id("12"), generatedAssetId: generated.id, sourceAssetId: generated.assetId, promptVersionId: version.id, type: "inpaint", instruction: "修正边缘" };
  assert.equal(isImageEdit(edit), true);
  assert.equal(isImageEdit({ ...edit, type: "magic" }), false);
  assert.equal(isImageEdit({ ...edit, generatedAssetId: "bad" }), false);
});
