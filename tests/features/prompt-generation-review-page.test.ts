import assert from "node:assert/strict";
import test from "node:test";
import { generationEntityNavigationCandidates, loadPromptGenerationReview } from "../../src/features/generation/PromptGenerationReviewPage.js";
import { ReviewService } from "../../src/application/review/index.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

void test("generation page loader reads the complete real entity chain and stays project isolated", async () => { const database = gateDatabase("p16-generation-ui"); try { const a = await createGeneratedCase(database, 70, "山西文化遗产"); const b = await createGeneratedCase(database, 71, "成都独立咖啡"); await new ReviewService(database, { entityIdFactory: a.nextId }).review(a.projectId, a.generatedAssetId); const data = await loadPromptGenerationReview(a.projectId, database); assert.equal(data.specs.length, 1); assert.equal(data.versions.length, 1); assert.equal(data.jobs.length, 1); assert.equal(data.assets.length, 1); assert.equal(data.reviews.length, 1); assert.ok(generationEntityNavigationCandidates(data).includes(a.generatedAssetId)); assert.ok(!generationEntityNavigationCandidates(data).includes(b.generatedAssetId)); } finally { database.close(); } });
