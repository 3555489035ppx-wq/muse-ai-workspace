import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import type { MoodboardItem, VisualDNA } from "../../src/domain/moodboard/index.js";
import { asEntityId, asProjectId, type EntityId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { MoodboardService } from "../../src/application/moodboard/index.js";
import { ProjectCreationService } from "../../src/application/project/index.js";
import { ResearchService } from "../../src/application/research/index.js";
import { calculateMoodboardLayout } from "../../src/features/moodboard/MoodboardGrid.js";
import { MoodboardRepository } from "../../src/repositories/MoodboardRepository.js";

void test("Phase 1.3 gate: dual cases persist different VisualDNA with readable quantity and shared asset safety", async () => {
  const databaseName = "phase-1-3-gate"; const database = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } }); const time = requireIsoTimestamp("2026-07-28T22:00:00.000Z");
  const id = (value: number) => asEntityId(`38000000-0000-4000-8000-${String(value).padStart(12, "0")}`); const projectA = asProjectId("38000000-0000-4000-8000-000000000001"); const projectB = asProjectId("38000000-0000-4000-8000-000000000002");
  const assets: Asset[] = Array.from({ length: 50 }, (_, index) => ({ id: id(100 + index), name: `Gate 素材 ${String(index + 1)}`, type: "image", status: "ready", mimeType: "image/webp", byteSize: 100, storageKey: `gate/${String(index)}`, createdAt: time, updatedAt: time })); await database.table("assets").bulkAdd(assets);
  const a = await new ProjectCreationService(database, { projectIdFactory: () => projectA }).create({ name: "山西文化遗产年轻化", description: "从文化档案与文明现场建立年轻视觉传播", projectType: "editorial", targetOutputs: ["poster"] });
  const b = await new ProjectCreationService(database, { projectIdFactory: () => projectB }).create({ name: "成都独立咖啡品牌", description: "从街区日常与手作风味建立品牌识别", projectType: "brand", targetOutputs: ["brand_identity"] });
  const researchA = await new ResearchService(database).run({ projectId: projectA, briefId: a.briefId, seed: "gate" }); const researchB = await new ResearchService(database).run({ projectId: projectB, briefId: b.briefId, seed: "gate" });
  const moodA = await new MoodboardService(database).generate({ projectId: projectA, researchSessionId: researchA.researchSessionId, availableAssetIds: assets.slice(0, 4).map((item) => item.id), seed: "gate" }); const moodB = await new MoodboardService(database).generate({ projectId: projectB, researchSessionId: researchB.researchSessionId, availableAssetIds: assets.slice(0, 4).map((item) => item.id), seed: "gate" });
  database.close(); const reloaded = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } }); const dna = await reloaded.table<VisualDNA, EntityId>("visualDna").toArray(); const dnaA = dna.filter((item) => item.projectId === projectA); const dnaB = dna.filter((item) => item.projectId === projectB);
  assert.equal(dnaA.length, 3); assert.equal(dnaB.length, 3); assert.notDeepEqual(dnaA.map((item) => item.colorPalette), dnaB.map((item) => item.colorPalette)); assert.notDeepEqual(dnaA.map((item) => item.imagery), dnaB.map((item) => item.imagery));
  assert.equal(dnaA.every((item) => moodA.moodboardIds.includes(item.moodboardId)), true); assert.equal(dnaB.every((item) => moodB.moodboardIds.includes(item.moodboardId)), true);
  for (const count of [5, 20, 50]) { const layout = calculateMoodboardLayout(count, 1200); assert.equal(layout.cardWidth >= 240, true); assert.equal(layout.overflowsHorizontally, false); }
  const items = await reloaded.table<MoodboardItem, EntityId>("moodboardItems").toArray(); const sharedAsset = assets[0]; assert.ok(sharedAsset); const itemA = items.find((item) => item.projectId === projectA && item.assetId === sharedAsset.id); assert.ok(itemA); await new MoodboardRepository(reloaded).deleteItem(itemA.id); assert.ok(await reloaded.table("assets").get(sharedAsset.id)); assert.equal((await reloaded.table<MoodboardItem, EntityId>("moodboardItems").toArray()).some((item) => item.projectId === projectB && item.assetId === sharedAsset.id), true); reloaded.close();
});
