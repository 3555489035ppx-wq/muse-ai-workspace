import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Direction } from "../../src/domain/direction/index.js";
import { DomainError, ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import type { Exploration } from "../../src/domain/exploration/index.js";
import type { GeneratedAsset } from "../../src/domain/generation/index.js";
import type { PromptVersion } from "../../src/domain/prompt/index.js";
import type { AIReview, ReviewDimension } from "../../src/domain/review/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import type { CreateEntityInput } from "../../src/repositories/base/types.js";
import { ReviewRepository } from "../../src/repositories/ReviewRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`f0000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("f0000000-0000-4000-8000-000000000001");
const projectB = asProjectId("f0000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`review-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const direction = { id: id("3"), projectId: projectA, researchSessionId: id("4"), moodboardId: id("5"), visualDNAId: id("6"), creativeSeedIds: [id("7")], opportunityIds: [id("8")], title: "d", concept: "c", narrative: "n", visualDNA: { keywords: ["k"], principles: ["p"] }, advantages: ["a"], risks: ["r"], status: "locked", createdAt: time, updatedAt: time } satisfies Direction;
  const exploration = { id: id("9"), projectId: projectA, directionId: direction.id, visualDNAId: direction.visualDNAId, title: "e", status: "selected", createdAt: time, updatedAt: time } satisfies Exploration;
  const prompt = { id: id("10"), projectId: projectA, promptSpecId: id("11"), explorationId: exploration.id, directionId: direction.id, visualDNAId: direction.visualDNAId, researchSessionId: direction.researchSessionId, adapterTarget: "generic_image", version: 1, promptText: "prompt", createdAt: time, updatedAt: time } satisfies PromptVersion;
  const generated = { id: id("12"), projectId: projectA, generationJobId: id("13"), promptVersionId: prompt.id, assetId: id("14"), mimeType: "image/png", width: 1024, height: 1024, createdAt: time, updatedAt: time } satisfies GeneratedAsset;
  await database.table<Direction, ReturnType<typeof asEntityId>>("directions").add(direction);
  await database.table<Exploration, ReturnType<typeof asEntityId>>("explorations").add(exploration);
  await database.table<PromptVersion, ReturnType<typeof asEntityId>>("promptVersions").add(prompt);
  await database.table<GeneratedAsset, ReturnType<typeof asEntityId>>("generatedAssets").add(generated);
  return { database, direction, generated, prompt, repository: new ReviewRepository(database) };
}

const dimension = {
  dimension: "goal_alignment",
  score: 84,
  evidenceIds: [id("12")],
  evidence: "版式焦点支持传播目标",
  problem: "次级信息偏弱",
  reason: "层级对比不足",
  impact: "浏览效率降低",
  recommendation: "增强次级标题对比",
} satisfies ReviewDimension;

function reviewInput(f: Awaited<ReturnType<typeof fixture>>): CreateEntityInput<AIReview> {
  return { id: id("20"), projectId: projectA, generatedAssetId: f.generated.id, promptVersionId: f.prompt.id, directionId: f.direction.id, dimensions: [dimension], summary: "方向一致，需强化层级。" };
}

void test("ReviewRepository persists a fully traceable review", async () => {
  const f = await fixture();
  const review = await f.repository.create(reviewInput(f));
  assert.equal((await f.repository.get(review.id))?.generatedAssetId, f.generated.id);
  assert.equal((await f.repository.listByGeneratedAsset(f.generated.id)).length, 1);
  assert.equal((await f.repository.listByProject(projectB)).length, 0);
  f.database.close();
});

void test("ReviewRepository rejects missing review evidence fields", async () => {
  for (const field of ["evidence", "problem", "reason", "impact", "recommendation"] as const) {
    const f = await fixture();
    const invalidDimension = { ...dimension, [field]: "" };
    const invalid = { ...reviewInput(f), dimensions: [invalidDimension] } as unknown as CreateEntityInput<AIReview>;
    await assert.rejects(f.repository.create(invalid), (error: unknown) => error instanceof DomainError && error.code === "INVALID_AI_REVIEW");
    f.database.close();
  }
});

void test("ReviewRepository rejects a cross-project review target", async () => {
  const f = await fixture();
  await assert.rejects(f.repository.create({ ...reviewInput(f), projectId: projectB }), ParentEntityMismatchError);
  f.database.close();
});
