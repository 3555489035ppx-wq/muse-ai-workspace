import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Moodboard } from "../../src/domain/moodboard/index.js";
import type { Project } from "../../src/domain/project/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { MoodboardAssetCommands } from "../../src/application/asset/index.js";

const time = requireIsoTimestamp("2026-07-28T21:00:00.000Z"); const projectA = asProjectId("36000000-0000-4000-8000-000000000001"); const projectB = asProjectId("36000000-0000-4000-8000-000000000002"); const id = (value: number) => asEntityId(`36000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
const project = (projectId: typeof projectA): Project => ({ id: projectId, name: projectId, type: "brand", status: "active", stage: "moodboard", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time });
void test("upload, add, reorder, group and remove persist without deleting shared Blob", async () => {
  const databaseName = "moodboard-asset-commands"; const database = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } }); await database.table("projects").bulkAdd([project(projectA), project(projectB)]);
  const board = { id: id(3), projectId: projectA, researchSessionId: id(4), title: "情绪板", status: "curated", createdAt: time, updatedAt: time } satisfies Moodboard; await database.table("moodboards").add(board);
  let index = 10; const commands = new MoodboardAssetCommands(database, { idFactory: () => id(index++) });
  const first = await commands.upload(projectA, { name: "a.png", content: new Blob(["A"], { type: "image/png" }) }); const second = await commands.upload(projectA, { name: "b.png", content: new Blob(["B"], { type: "image/png" }) });
  const firstItem = await commands.add(projectA, board.id, first.id); const secondItem = await commands.add(projectA, board.id, second.id);
  const reordered = await commands.reorder(projectA, board.id, secondItem.id, firstItem.id); assert.equal(reordered[0]?.id, secondItem.id);
  const group = await commands.group(projectA, "核心材料", [first.id, second.id]); assert.deepEqual(group.assetIds, [first.id, second.id]);
  await commands.remove(projectA, firstItem.id); assert.equal(await commands.getBlob(first.id) instanceof Blob, true);
  await assert.rejects(commands.add(projectB, board.id, first.id), /不属于当前项目/);
  database.close(); const reloaded = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } }); assert.equal(await reloaded.table("assetCollections").count(), 1); assert.equal(await reloaded.table("moodboardItems").count(), 1); reloaded.close();
});
