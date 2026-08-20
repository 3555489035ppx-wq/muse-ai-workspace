import assert from "node:assert/strict";
import test from "node:test";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { runFinalPhaseOneCase } from "../helpers/phase-one-final-case.js";
void test("Case B runs Chengdu coffee from Project through Decision Map with persistent lineage", async () => { const database = gateDatabase("phase-1-final-coffee"); try { const result = await runFinalPhaseOneCase(database, 88, "成都独立咖啡品牌"); assert.equal(result.directions.length, 3); assert.equal(result.directions.filter(item => item.status === "locked").length, 1); assert.equal(result.variants.length, 6); assert.ok(result.generationResult.fixtureKey.startsWith("muse-mock-")); assert.equal(result.review.generatedAssetId, result.generated.id); assert.ok(await database.table("assetBlobs").get(result.generated.assetId)); assert.equal((await database.table("versionSnapshots").where("projectId").equals(result.projectId).count()) >= 3, true); } finally { database.close(); } });
