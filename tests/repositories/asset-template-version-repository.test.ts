import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { AssetStorage } from "../../src/domain/asset/AssetStorage.js";
import { AssetStorageError, ReferentialIntegrityError } from "../../src/domain/errors/index.js";
import type { Project } from "../../src/domain/project/index.js";
import { asEntityId, asProjectId, type EntityId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { AssetRepository } from "../../src/repositories/AssetRepository.js";
import { TemplateRepository } from "../../src/repositories/TemplateRepository.js";
import { VersionRepository } from "../../src/repositories/VersionRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`11000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("11000000-0000-4000-8000-000000000001");
const projectB = asProjectId("11000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");
const project = (projectId: typeof projectA, name: string): Project => ({ id: projectId, name, type: "brand", status: "active", stage: "brief", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time });

async function fixture(storage?: AssetStorage) {
  const database = createMuseDatabase(`asset-version-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  await database.table("projects").bulkAdd([project(projectA, "A"), project(projectB, "B")]);
  return { assetRepository: new AssetRepository(database, storage), database, templateRepository: new TemplateRepository(database), versionRepository: new VersionRepository(database) };
}

const assetInput = { id: id("10"), name: "shared.png", type: "image", status: "ready", mimeType: "image/png", byteSize: 3, storageKey: "assets/10" } as const;

void test("shared asset references survive deletion from project A", async () => {
  const f = await fixture();
  await f.assetRepository.createWithBlob(assetInput, new Blob(["abc"], { type: "image/png" }));
  const sourceA = await f.assetRepository.createSource({ id: id("11"), projectId: projectA, assetId: assetInput.id, type: "upload", label: "A" });
  await f.assetRepository.createSource({ id: id("12"), projectId: projectB, assetId: assetInput.id, type: "reference", label: "B" });
  assert.equal(await f.assetRepository.countReferences(assetInput.id), 2);
  await f.assetRepository.deleteSource(sourceA.id);
  assert.equal(await f.assetRepository.countReferences(assetInput.id), 1);
  assert.equal((await f.assetRepository.getBlob(assetInput.id))?.size, 3);
  await assert.rejects(f.assetRepository.deleteMetadata(assetInput.id), ReferentialIntegrityError);
  f.database.close();
});

void test("asset metadata creation rolls back when Blob storage fails", async () => {
  const failingStorage: AssetStorage = {
    save: (assetId: EntityId) => Promise.reject(new AssetStorageError("save", assetId, new Error("quota"))),
    get: () => Promise.resolve(undefined),
    delete: () => Promise.resolve(),
    has: () => Promise.resolve(false),
  };
  const f = await fixture(failingStorage);
  await assert.rejects(f.assetRepository.createWithBlob(assetInput, new Blob(["abc"])), AssetStorageError);
  assert.equal(await f.assetRepository.get(assetInput.id), undefined);
  f.database.close();
});

void test("template metadata and version snapshots persist without strategy behavior", async () => {
  const f = await fixture();
  const template = await f.templateRepository.create({ id: id("20"), name: "品牌基础模板", status: "draft", strategy: {}, schemaVersion: 1 });
  assert.equal((await f.templateRepository.get(template.id))?.name, "品牌基础模板");
  const first = await f.versionRepository.create({ id: id("21"), projectId: projectA, entityType: "project", entityId: projectA, schemaVersion: 4, label: "V1", snapshot: { stage: "brief" } });
  await f.versionRepository.create({ id: id("22"), projectId: projectA, parentVersionId: first.id, entityType: "project", entityId: projectA, schemaVersion: 4, label: "V2", snapshot: { stage: "research" } });
  assert.equal((await f.versionRepository.listByEntity(projectA, projectA)).length, 2);
  f.database.close();
});
