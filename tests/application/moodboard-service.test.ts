import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import type { Moodboard, VisualDNA } from "../../src/domain/moodboard/index.js";
import type { ProjectWorkflowState } from "../../src/domain/services/ProjectWorkflowService.js";
import { asEntityId, asProjectId, type EntityId, type ProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ProjectCreationService } from "../../src/application/project/index.js";
import { ResearchService } from "../../src/application/research/index.js";
import { MoodboardService } from "../../src/application/moodboard/index.js";

let sequence = 0; const id = (value: number) => asEntityId(`34000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
interface WorkflowView { readonly id: EntityId; readonly projectId: ProjectId; readonly state: ProjectWorkflowState; }
async function fixture(name = "山西文化遗产") {
  const database = createMuseDatabase(`moodboard-service-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const projectId = asProjectId(`34000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`); let entity = 20;
  const created = await new ProjectCreationService(database, { projectIdFactory: () => projectId, entityIdFactory: () => id(entity++) }).create({ name, description: `${name}完整视觉研究目标`, projectType: "brand", targetOutputs: ["brand_identity"] });
  const research = await new ResearchService(database, { entityIdFactory: () => id(entity++) }).run({ projectId, briefId: created.briefId, seed: "moodboard" });
  const time = requireIsoTimestamp("2026-07-28T19:00:00.000Z");
  const assets: Asset[] = [1, 2, 3, 4].map((value) => ({ id: id(value), name: `素材${String(value)}`, type: "image", status: "ready", mimeType: "image/webp", byteSize: 100, storageKey: `fixture/${String(value)}`, createdAt: time, updatedAt: time }));
  await database.table("assets").bulkAdd(assets);
  return { database, projectId, researchSessionId: research.researchSessionId, assets, nextId: () => id(entity++) };
}

void test("MoodboardService persists traceable territories, items, DNA and ready workflow", async () => {
  const f = await fixture(); const result = await new MoodboardService(f.database, { entityIdFactory: f.nextId }).generate({ projectId: f.projectId, researchSessionId: f.researchSessionId, availableAssetIds: f.assets.map((item) => item.id), seed: "fixed" });
  assert.equal(result.moodboardIds.length, 3); assert.equal(result.visualDNAIds.length, 3);
  const moodboards = await f.database.table<Moodboard, EntityId>("moodboards").toArray(); const dna = await f.database.table<VisualDNA, EntityId>("visualDna").toArray();
  assert.equal(moodboards.every((item) => item.researchSessionId === f.researchSessionId && item.projectId === f.projectId), true);
  assert.equal(dna.every((item) => moodboards.some((board) => board.id === item.moodboardId)), true);
  assert.equal((await f.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(f.projectId).first())?.state, "MOODBOARD_READY"); f.database.close();
});

void test("MoodboardService rolls back and restores RESEARCH_READY before retry", async () => {
  const f = await fixture("成都独立咖啡"); const broken = new MoodboardService(f.database, { entityIdFactory: f.nextId, faultInjector: (stage) => { if (stage === "persisting") throw new Error("moodboard persist failure"); } });
  await assert.rejects(broken.generate({ projectId: f.projectId, researchSessionId: f.researchSessionId, availableAssetIds: f.assets.map((item) => item.id), seed: "fixed" }), /persist failure/);
  assert.equal(await f.database.table("moodboards").count(), 0); assert.equal(await f.database.table("moodboardItems").count(), 0); assert.equal(await f.database.table("visualDna").count(), 0);
  assert.equal((await f.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(f.projectId).first())?.state, "RESEARCH_READY");
  assert.equal((await new MoodboardService(f.database, { entityIdFactory: f.nextId }).generate({ projectId: f.projectId, researchSessionId: f.researchSessionId, availableAssetIds: f.assets.map((item) => item.id), seed: "fixed" })).workflowState, "MOODBOARD_READY"); f.database.close();
});
