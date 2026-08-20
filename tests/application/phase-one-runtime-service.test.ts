import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { DirectionCommandService, DirectionLibraryService } from "../../src/application/direction/index.js";
import { ExplorationGalleryService } from "../../src/application/exploration/index.js";
import { GeneratedAssetService, GenerationJobService } from "../../src/application/generation/index.js";
import { PhaseOneRuntimeService } from "../../src/application/runtime/index.js";
import { ReviewService } from "../../src/application/review/index.js";
import { BRAND_IDENTITY_TEMPLATE_ID, TemplateInstantiationService } from "../../src/application/template/index.js";
import type { Direction } from "../../src/domain/direction/index.js";
import type { ExplorationVariant } from "../../src/domain/exploration/index.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import { createMuseDatabase } from "../../src/db/database.js";

void test("runtime service connects template creation to the complete browser workflow without fake page state", async () => {
  const database = createMuseDatabase("phase-one-runtime-service", { dependencies: { indexedDB, IDBKeyRange } });
  try {
    const created = await new TemplateInstantiationService(database).instantiate({
      name: "Muse 浏览器运行验收",
      description: "验证项目创建后可以逐阶段生成真实且可追溯的领域实体。",
      projectType: "brand",
      targetOutputs: ["brand_identity"],
      templateId: BRAND_IDENTITY_TEMPLATE_ID,
    });
    const runtime = new PhaseOneRuntimeService(database);
    const researchId = await runtime.runResearch(created.projectId);
    assert.equal(await runtime.runResearch(created.projectId), researchId);
    assert.equal((await runtime.generateMoodboards(created.projectId)).length >= 2, true);
    const directionIds = await runtime.generateDirections(created.projectId);
    assert.equal(directionIds.length, 3);
    const directionB = directionIds[1];
    assert.ok(directionB);
    await new DirectionCommandService(database).lock(created.projectId, directionB);
    await new DirectionLibraryService(database).save(created.projectId, directionB);
    const explorationId = await runtime.generateExploration(created.projectId);
    const variant = await database.table<ExplorationVariant, EntityId>("explorationVariants").where("explorationId").equals(explorationId).first();
    assert.ok(variant);
    await new ExplorationGalleryService(database).select(created.projectId, variant.id);
    const prompt = await runtime.compilePrompt(created.projectId, explorationId);
    const jobs = new GenerationJobService(database);
    const queued = await jobs.queue({ projectId: created.projectId, promptVersionId: prompt.id, seed: "runtime-browser" });
    const completed = await jobs.run(queued.jobId);
    assert.ok(completed.result);
    const generated = await new GeneratedAssetService(database).persist({ projectId: created.projectId, jobId: queued.jobId, result: completed.result });
    await new ReviewService(database).review(created.projectId, generated.id);
    await runtime.populateDecisionMap(created.projectId);
    assert.equal((await database.table<Direction, EntityId>("directions").where("projectId").equals(created.projectId).toArray()).filter((item) => item.status === "locked").length, 1);
    assert.equal((await new DirectionLibraryService(database).list()).length, 1);
    assert.equal(await database.table("aiReviews").where("projectId").equals(created.projectId).count(), 1);
    assert.equal((await database.table("canvasNodes").where("projectId").equals(created.projectId).count()) >= 9, true);
  } finally {
    database.close();
    indexedDB.deleteDatabase("phase-one-runtime-service");
  }
});
