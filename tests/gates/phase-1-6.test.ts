import assert from "node:assert/strict";
import test from "node:test";
import { GenerationJobService } from "../../src/application/generation/index.js";
import { ReviewService } from "../../src/application/review/index.js";
import type { GeneratedAsset } from "../../src/domain/generation/index.js";
import type { PromptVersion } from "../../src/domain/prompt/index.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

void test("Phase 1.6 gate: dual cases persist isolated Prompt→Job→Asset→Review lineage and explicit job recovery", async () => {
  const database = gateDatabase("phase-1-6-gate");
  try {
    const shanxi = await createGeneratedCase(database, 72, "山西文化遗产年轻化视觉传播"); const coffee = await createGeneratedCase(database, 73, "成都独立咖啡品牌");
    const shanxiReview = await new ReviewService(database, { entityIdFactory: shanxi.nextId }).review(shanxi.projectId, shanxi.generatedAssetId); const coffeeReview = await new ReviewService(database, { entityIdFactory: coffee.nextId }).review(coffee.projectId, coffee.generatedAssetId);
    assert.notEqual(shanxi.structuredPrompt.fields.objective[0], coffee.structuredPrompt.fields.objective[0]); assert.notEqual(shanxi.generationResult.fixtureKey, coffee.generationResult.fixtureKey); assert.notEqual(shanxiReview.review.summary, coffeeReview.review.summary);
    for (const fixture of [shanxi, coffee]) { const generated = await database.table<GeneratedAsset, EntityId>("generatedAssets").get(fixture.generatedAssetId); const prompt = generated ? await database.table<PromptVersion, EntityId>("promptVersions").get(generated.promptVersionId) : undefined; assert.equal(generated?.projectId, fixture.projectId); assert.equal(prompt?.projectId, fixture.projectId); assert.equal((await database.table("aiReviews").where("generatedAssetId").equals(fixture.generatedAssetId).count()), 1); }
    const jobs = new GenerationJobService(database, { entityIdFactory: shanxi.nextId }); const failed = await jobs.queue({ projectId: shanxi.projectId, promptVersionId: shanxi.promptVersionId, seed: "fail-gate" }); assert.equal((await jobs.run(failed.jobId)).status, "failed"); const retried = await jobs.retry(failed.jobId); assert.equal((await jobs.run(retried.jobId)).status, "succeeded"); const cancelled = await jobs.queue({ projectId: shanxi.projectId, promptVersionId: shanxi.promptVersionId, seed: "cancel-gate" }); await jobs.cancel(cancelled.jobId); assert.equal((await jobs.get(cancelled.jobId))?.status, "cancelled");
    assert.equal((await database.table("generatedAssets").where("projectId").equals(shanxi.projectId).count()), 1); assert.equal((await database.table("generatedAssets").where("projectId").equals(coffee.projectId).count()), 1);
  } finally { database.close(); }
});
