import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import type { Direction, DirectionReference } from "../../src/domain/direction/index.js";
import type { ProjectWorkflowState } from "../../src/domain/services/ProjectWorkflowService.js";
import type { CreativeSeed, ResearchOpportunity } from "../../src/domain/research/index.js";
import type { VersionSnapshot } from "../../src/domain/version/index.js";
import { asEntityId, asProjectId, type EntityId, type ProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ProjectCreationService } from "../../src/application/project/index.js";
import { ResearchService } from "../../src/application/research/index.js";
import { MoodboardService } from "../../src/application/moodboard/index.js";
import { DirectionCommandError, DirectionCommandService, DirectionComparisonService, DirectionLibraryService, DirectionService } from "../../src/application/direction/index.js";

let sequence = 0; const id = (value: number) => asEntityId(`35000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
interface WorkflowView { readonly projectId: ProjectId; readonly state: ProjectWorkflowState; }
function required<T>(items: readonly T[], index: number): T { const item = items[index]; if (item === undefined) throw new Error(`Missing fixture item ${String(index)}`); return item; }
async function fixture(name = "山西文化遗产") {
  const database = createMuseDatabase(`direction-service-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } }); const projectId = asProjectId(id(100 + sequence)); let entity = 200;
  const created = await new ProjectCreationService(database, { projectIdFactory: () => projectId, entityIdFactory: () => id(entity++) }).create({ name, description: `${name}年轻化视觉传播完整目标`, projectType: "brand", targetOutputs: ["brand_identity"] });
  const research = await new ResearchService(database, { entityIdFactory: () => id(entity++) }).run({ projectId, briefId: created.briefId, seed: "fixed" }); const now = requireIsoTimestamp("2026-07-28T20:00:00.000Z");
  const assets: Asset[] = [1, 2, 3, 4].map((value) => ({ id: id(value), name: `素材${String(value)}`, type: "image", status: "ready", mimeType: "image/webp", byteSize: 100, storageKey: `fixture/${String(value)}`, createdAt: now, updatedAt: now })); await database.table("assets").bulkPut(assets);
  const moodboard = await new MoodboardService(database, { entityIdFactory: () => id(entity++) }).generate({ projectId, researchSessionId: research.researchSessionId, availableAssetIds: assets.map((asset) => asset.id), seed: "fixed" });
  return { database, projectId, briefId: created.briefId, researchSessionId: research.researchSessionId, moodboardId: required(moodboard.moodboardIds, 0), visualDNAId: required(moodboard.visualDNAIds, 0), assets, nextId: () => id(entity++) };
}
void test("DirectionService persists exactly three traceable directions and references", async () => {
  const f = await fixture(); const result = await new DirectionService(f.database, { entityIdFactory: f.nextId }).generate({ projectId: f.projectId, briefId: f.briefId, researchSessionId: f.researchSessionId, moodboardId: f.moodboardId, visualDNAId: f.visualDNAId, assetIds: f.assets.map((asset) => asset.id), constraints: [], seed: "fixed" });
  const directions = await f.database.table<Direction, EntityId>("directions").toArray(); const refs = await f.database.table<DirectionReference, EntityId>("directionReferences").toArray();
  assert.equal(result.directionIds.length, 3); assert.equal(directions.length, 3); assert.equal(refs.length, 3); assert.equal(directions.every((item) => item.projectId === f.projectId && item.researchSessionId === f.researchSessionId && item.moodboardId === f.moodboardId && item.visualDNAId === f.visualDNAId), true);
  const comparison = new DirectionComparisonService(f.database, { entityIdFactory: f.nextId }); await comparison.compare(f.projectId, result.directionIds, f.briefId); await comparison.compare(f.projectId, result.directionIds, f.briefId); assert.equal(await f.database.table("directionScores").count(), 21);
  assert.equal((await f.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(f.projectId).first())?.state, "DIRECTIONS_READY"); const databaseName = f.database.name; f.database.close();
  const reopened = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } }); assert.equal(await reopened.table("directions").count(), 3); reopened.close();
});
void test("DirectionService rolls back invalid persistence and supports retry", async () => {
  const f = await fixture("成都独立咖啡"); const broken = new DirectionService(f.database, { entityIdFactory: f.nextId, faultInjector: (stage) => { if (stage === "persisting") throw new Error("direction persist failure"); } }); const input = { projectId: f.projectId, briefId: f.briefId, researchSessionId: f.researchSessionId, moodboardId: f.moodboardId, visualDNAId: f.visualDNAId, assetIds: f.assets.map((asset) => asset.id), constraints: [], seed: "fixed" };
  await assert.rejects(broken.generate(input), /persist failure/); assert.equal(await f.database.table("directions").count(), 0); assert.equal(await f.database.table("directionReferences").count(), 0); assert.equal((await f.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(f.projectId).first())?.state, "MOODBOARD_READY");
  assert.equal((await new DirectionService(f.database, { entityIdFactory: f.nextId }).generate(input)).workflowState, "DIRECTIONS_READY"); f.database.close();
});

void test("DirectionService rejects invalid provider output and cross-project lineage", async () => {
  const f = await fixture(); const input = { projectId: f.projectId, briefId: f.briefId, researchSessionId: f.researchSessionId, moodboardId: f.moodboardId, visualDNAId: f.visualDNAId, assetIds: f.assets.map((asset) => asset.id), constraints: [], seed: "fixed" };
  await assert.rejects(new DirectionService(f.database, { provider: { generate: () => Promise.resolve({ directions: [] }) }, entityIdFactory: f.nextId }).generate(input), /invalid provenance/i);
  assert.equal(await f.database.table("directions").count(), 0); assert.equal((await f.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(f.projectId).first())?.state, "MOODBOARD_READY");
  await assert.rejects(new DirectionService(f.database).generate({ ...input, projectId: asProjectId(id(999)) }), /crosses project boundaries/i); assert.equal(await f.database.table("directions").count(), 0); f.database.close();
});

void test("DirectionCommandService persists a single lock, controlled switch, rejection and archive", async () => {
  const f = await fixture(); const generated = await new DirectionService(f.database, { entityIdFactory: f.nextId }).generate({ projectId: f.projectId, briefId: f.briefId, researchSessionId: f.researchSessionId, moodboardId: f.moodboardId, visualDNAId: f.visualDNAId, assetIds: f.assets.map((asset) => asset.id), constraints: [], seed: "fixed" }); const commands = new DirectionCommandService(f.database, { entityIdFactory: f.nextId });
  const first = required(generated.directionIds, 0); const second = required(generated.directionIds, 1); const third = required(generated.directionIds, 2);
  await commands.lock(f.projectId, first); await commands.lock(f.projectId, second); let directions = await f.database.table<Direction, EntityId>("directions").toArray(); assert.deepEqual(directions.filter((item) => item.status === "locked").map((item) => item.id), [second]);
  await commands.reject(f.projectId, third); await assert.rejects(commands.lock(f.projectId, third), DirectionCommandError); await commands.select(f.projectId, third); await commands.archive(f.projectId, third); assert.equal(await f.database.table("versionSnapshots").count(), 1);
  await Promise.all([commands.lock(f.projectId, first), commands.lock(f.projectId, second)]); directions = await f.database.table<Direction, EntityId>("directions").toArray(); assert.equal(directions.filter((item) => item.status === "locked").length, 1); assert.equal(await f.database.table("explorations").count(), 0); f.database.close();
});

void test("DirectionLibraryService saves once and reuses as an isolated mutable direction with provenance", async () => {
  const f = await fixture(); const source = await new DirectionService(f.database, { entityIdFactory: f.nextId }).generate({ projectId: f.projectId, briefId: f.briefId, researchSessionId: f.researchSessionId, moodboardId: f.moodboardId, visualDNAId: f.visualDNAId, assetIds: f.assets.map((asset) => asset.id), constraints: [], seed: "fixed" }); const sourceId = required(source.directionIds, 0); const library = new DirectionLibraryService(f.database, { entityIdFactory: f.nextId }); const saved = await library.save(f.projectId, sourceId); assert.equal((await library.save(f.projectId, sourceId)).id, saved.id); assert.equal((await library.list()).length, 1);
  const seeds = await f.database.table<CreativeSeed, EntityId>("creativeSeeds").toArray(); const opportunities = await f.database.table<ResearchOpportunity, EntityId>("researchOpportunities").toArray(); const reused = await library.reuse(saved.id, { targetProjectId: f.projectId, researchSessionId: f.researchSessionId, moodboardId: f.moodboardId, visualDNAId: f.visualDNAId, creativeSeedIds: seeds.map((item) => item.id), opportunityIds: opportunities.map((item) => item.id) }); assert.notEqual(reused.id, sourceId); await new DirectionCommandService(f.database).reject(f.projectId, reused.id); assert.equal((await f.database.table<Direction, EntityId>("directions").get(sourceId))?.status, "candidate"); const provenance = await f.database.table<VersionSnapshot, EntityId>("versionSnapshots").where("entityId").equals(reused.id).first(); assert.equal(provenance?.snapshot.originDirectionId, sourceId); f.database.close();
});
