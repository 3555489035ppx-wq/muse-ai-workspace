import assert from "node:assert/strict";
import test from "node:test";
import { GenerationJobService, GeneratedAssetService } from "../../src/application/generation/index.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createPromptCase } from "../helpers/prompt-case.js";

void test("succeeded job persists traceable metadata, blob and snapshot while failed job creates nothing", async () => {
  const database = gateDatabase("p16-generated-asset");
  try {
    const fixture = await createPromptCase(database, 63, "山西文化遗产"); const jobs = new GenerationJobService(database, { entityIdFactory: fixture.nextId });
    const queued = await jobs.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: "stable" }); const completed = await jobs.run(queued.jobId); const result = completed.result; assert.ok(result);
    const asset = await new GeneratedAssetService(database, { entityIdFactory: fixture.nextId }).persist({ projectId: fixture.projectId, jobId: queued.jobId, result });
    assert.equal(asset.promptVersionId, fixture.promptVersionId); assert.ok(await new GeneratedAssetService(database).getBlob(asset.assetId));
    assert.equal((await database.table("versionSnapshots").where("entityId").equals(asset.id).count()), 1);
    const failed = await jobs.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: "fail" }); await jobs.run(failed.jobId);
    await assert.rejects(() => new GeneratedAssetService(database).persist({ projectId: fixture.projectId, jobId: failed.jobId, result }));
    assert.equal((await database.table("generatedAssets").where("generationJobId").equals(failed.jobId).count()), 0);
  } finally { database.close(); }
});

void test("asset persistence rolls back metadata and blob on failure", async () => {
  const database = gateDatabase("p16-generated-rollback");
  try {
    const fixture = await createPromptCase(database, 64, "成都独立咖啡"); const jobs = new GenerationJobService(database, { entityIdFactory: fixture.nextId });
    const queued = await jobs.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: "stable" }); const completed = await jobs.run(queued.jobId); const result = completed.result; assert.ok(result);
    const before = await database.table("assets").count();
    await assert.rejects(() => new GeneratedAssetService(database, { entityIdFactory: fixture.nextId, faultInjector: () => { throw new Error("fault"); } }).persist({ projectId: fixture.projectId, jobId: queued.jobId, result }));
    assert.equal(await database.table("assets").count(), before); assert.equal(await database.table("generatedAssets").count(), 0);
  } finally { database.close(); }
});
