import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset, AssetSource } from "../../src/domain/asset/index.js";
import type { ProjectBrief } from "../../src/domain/project/index.js";
import { ProjectLifecycleService } from "../../src/domain/services/ProjectLifecycleService.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { IndexedDbAssetStorage } from "../../src/db/assetStorage.js";
import { createMuseDatabase } from "../../src/db/database.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`14000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("14000000-0000-4000-8000-000000000001");
const projectB = asProjectId("14000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");
const input = (name: string) => ({ name, type: "brand", status: "active", stage: "brief", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4 } as const);

async function fixture() {
  const database = createMuseDatabase(`lifecycle-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const storage = new IndexedDbAssetStorage(database);
  const service = new ProjectLifecycleService(database, { storage });
  await service.createMinimalProject({ id: projectA, ...input("A") });
  await service.createMinimalProject({ id: projectB, ...input("B") });
  const briefA = { id: id("3"), projectId: projectA, goal: "A", audience: "A", context: "A", deliverables: ["A"], constraints: ["A"], createdAt: time, updatedAt: time } satisfies ProjectBrief;
  const briefB = { ...briefA, id: id("4"), projectId: projectB, goal: "B" } satisfies ProjectBrief;
  await database.table("briefs").bulkAdd([briefA, briefB]);
  const shared = { id: id("5"), name: "shared", type: "image", status: "ready", mimeType: "image/png", byteSize: 6, storageKey: "shared" , createdAt: time, updatedAt: time } satisfies Asset;
  const onlyA = { ...shared, id: id("6"), name: "only-a", storageKey: "only-a" } satisfies Asset;
  await database.table("assets").bulkAdd([shared, onlyA]);
  await storage.save(shared.id, new Blob(["shared"], { type: "image/png" }));
  await storage.save(onlyA.id, new Blob(["only-a"], { type: "image/png" }));
  const sources = [
    { id: id("7"), projectId: projectA, assetId: shared.id, type: "upload", label: "A shared", createdAt: time, updatedAt: time },
    { id: id("8"), projectId: projectB, assetId: shared.id, type: "reference", label: "B shared", createdAt: time, updatedAt: time },
    { id: id("9"), projectId: projectA, assetId: onlyA.id, type: "upload", label: "A only", createdAt: time, updatedAt: time },
  ] satisfies readonly AssetSource[];
  await database.table("assetSources").bulkAdd(sources);
  return { database, onlyA, service, shared, storage };
}

void test("ProjectLifecycleService creates a minimal valid project", async () => {
  const database = createMuseDatabase(`lifecycle-create-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const service = new ProjectLifecycleService(database, { idFactory: () => projectA, clock: () => new Date(time) });
  const project = await service.createMinimalProject(input("最小项目"));
  assert.equal(project.id, projectA);
  assert.equal(project.createdAt, time);
  database.close();
});

void test("transactional cascade deletes A, preserves B and shared Blob, and leaves no orphan", async () => {
  const f = await fixture();
  await f.service.deleteProject(projectA);
  assert.equal(await f.database.table("projects").get(projectA), undefined);
  assert.ok(await f.database.table("projects").get(projectB));
  assert.equal(await f.database.table("briefs").where("projectId").equals(projectA).count(), 0);
  assert.equal(await f.database.table("assetSources").where("projectId").equals(projectB).count(), 1);
  assert.ok(await f.database.table("assets").get(f.shared.id));
  assert.equal(await f.storage.has(f.shared.id), true);
  assert.equal(await f.database.table("assets").get(f.onlyA.id), undefined);
  assert.equal(await f.storage.has(f.onlyA.id), false);
  assert.deepEqual(await f.service.scanOrphans(), []);
  f.database.close();
});

void test("cascade failure rolls back every project and asset change", async () => {
  const f = await fixture();
  await assert.rejects(f.service.deleteProject(projectA, () => { throw new Error("injected cascade failure"); }), /injected cascade failure/);
  assert.ok(await f.database.table("projects").get(projectA));
  assert.equal(await f.database.table("briefs").where("projectId").equals(projectA).count(), 1);
  assert.equal(await f.database.table("assetSources").where("projectId").equals(projectA).count(), 2);
  assert.ok(await f.database.table("assets").get(f.onlyA.id));
  assert.equal(await f.storage.has(f.onlyA.id), true);
  f.database.close();
});
