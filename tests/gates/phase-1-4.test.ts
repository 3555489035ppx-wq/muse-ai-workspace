import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import type { Direction, DirectionReference } from "../../src/domain/direction/index.js";
import type { EntityId, ProjectId } from "../../src/domain/shared/id.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase, type MuseDatabase } from "../../src/db/database.js";
import { DirectionCommandService, DirectionComparisonService, DirectionLibraryService, DirectionService } from "../../src/application/direction/index.js";
import { MoodboardService } from "../../src/application/moodboard/index.js";
import { ProjectCreationService } from "../../src/application/project/index.js";
import { ResearchService } from "../../src/application/research/index.js";

const eid = (caseNumber: number, value: number) => asEntityId(`37${String(caseNumber).padStart(6, "0")}-0000-4000-8000-${String(value).padStart(12, "0")}`);
const required = <T,>(items: readonly T[], index: number): T => { const item = items[index]; if (item === undefined) throw new Error(`Missing gate fixture item ${String(index)}`); return item; };
async function createCase(database: MuseDatabase, caseNumber: number, name: string) {
  const projectId = asProjectId(eid(caseNumber, 1)); let sequence = 100; const nextId = () => eid(caseNumber, sequence++);
  const created = await new ProjectCreationService(database, { projectIdFactory: () => projectId, entityIdFactory: nextId }).create({ name, description: `${name}完整设计研究与传播目标`, projectType: "brand", targetOutputs: ["brand_identity"] });
  const research = await new ResearchService(database, { entityIdFactory: nextId }).run({ projectId, briefId: created.briefId, seed: `case-${String(caseNumber)}` }); const now = requireIsoTimestamp("2026-07-28T21:00:00.000Z");
  const assets: Asset[] = [1, 2, 3, 4].map((value) => ({ id: eid(caseNumber, value + 10), name: `${name}素材${String(value)}`, type: "image", status: "ready", mimeType: "image/webp", byteSize: 100, storageKey: `gate/${String(caseNumber)}/${String(value)}`, createdAt: now, updatedAt: now })); await database.table("assets").bulkAdd(assets);
  const moodboard = await new MoodboardService(database, { entityIdFactory: nextId }).generate({ projectId, researchSessionId: research.researchSessionId, availableAssetIds: assets.map((item) => item.id), seed: "fixed" }); const moodboardId = required(moodboard.moodboardIds, 0); const visualDNAId = required(moodboard.visualDNAIds, 0);
  const directions = await new DirectionService(database, { entityIdFactory: nextId }).generate({ projectId, briefId: created.briefId, researchSessionId: research.researchSessionId, moodboardId, visualDNAId, assetIds: assets.map((item) => item.id), constraints: [], seed: "fixed" }); await new DirectionComparisonService(database, { entityIdFactory: nextId }).compare(projectId, directions.directionIds, created.briefId);
  return { projectId, directionIds: directions.directionIds, nextId };
}

void test("Phase 1.4 gate: dual cases remain distinct, comparable, singly locked and traceable", async () => {
  const name = "phase-1-4-gate"; const database = createMuseDatabase(name, { dependencies: { indexedDB, IDBKeyRange } }); const shanxi = await createCase(database, 1, "山西文化遗产年轻化"); const coffee = await createCase(database, 2, "成都独立咖啡品牌");
  const all = await database.table<Direction, EntityId>("directions").toArray(); const shanxiDirections = all.filter((item) => item.projectId === shanxi.projectId); const coffeeDirections = all.filter((item) => item.projectId === coffee.projectId); assert.equal(shanxiDirections.length, 3); assert.equal(coffeeDirections.length, 3); assert.notDeepEqual(shanxiDirections.map((item) => item.concept), coffeeDirections.map((item) => item.concept));
  const refs = await database.table<DirectionReference, EntityId>("directionReferences").toArray(); for (const projectId of [shanxi.projectId, coffee.projectId] as readonly ProjectId[]) { const projectRefs = refs.filter((item) => item.projectId === projectId); assert.equal(projectRefs.length, 3); assert.equal(new Set(projectRefs.map((item) => item.assetId)).size, 3); assert.equal((await database.table("directionScores").where("projectId").equals(projectId).count()), 21); }
  const shanxiLock = required(shanxi.directionIds, 1); const coffeeLock = required(coffee.directionIds, 1); await new DirectionCommandService(database).lock(shanxi.projectId, shanxiLock); await new DirectionCommandService(database).lock(coffee.projectId, coffeeLock); assert.equal(all.filter((item) => item.status === "locked").length, 0); const refreshed = await database.table<Direction, EntityId>("directions").toArray(); assert.equal(refreshed.filter((item) => item.projectId === shanxi.projectId && item.status === "locked").length, 1); assert.equal(refreshed.filter((item) => item.projectId === coffee.projectId && item.status === "locked").length, 1);
  const library = new DirectionLibraryService(database, { entityIdFactory: shanxi.nextId }); const saved = await library.save(shanxi.projectId, shanxiLock); assert.equal(saved.originDirectionId, shanxiLock); assert.equal(saved.originProjectId, shanxi.projectId); database.close(); const reopened = createMuseDatabase(name, { dependencies: { indexedDB, IDBKeyRange } }); assert.equal((await reopened.table<Direction, EntityId>("directions").get(shanxiLock))?.status, "locked"); assert.equal((await new DirectionLibraryService(reopened).list()).length, 1); reopened.close();
});
