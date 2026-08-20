import assert from "node:assert/strict";
import test from "node:test";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import { StorageMigrationError } from "../../src/domain/errors/index.js";
import {
  LEGACY_V3_STORES,
  createMuseDatabase,
  type MuseDatabaseDependencies,
} from "../../src/db/database.js";

const dependencies: MuseDatabaseDependencies = { indexedDB, IDBKeyRange };
let sequence = 0;
const databaseName = (label: string): string =>
  `muse-test-${label}-${String(sequence++)}`;

async function createLegacyV3(name: string): Promise<void> {
  const legacy = new Dexie(name, dependencies);
  legacy.version(3).stores(LEGACY_V3_STORES);
  await legacy.open();
  await legacy.table("projects").put({
    id: "50000000-0000-4000-8000-000000000001",
    name: "保留项目",
    stage: "brief",
    status: "active",
    updatedAt: "2026-07-28T08:00:00.000Z",
  });
  legacy.close();
}

void test("database creates, persists and reopens through one factory", async () => {
  const name = databaseName("reopen");
  const first = createMuseDatabase(name, { dependencies });
  await first.open();
  await first.table("projects").put({ id: "50000000-0000-4000-8000-000000000002", name: "持久化" });
  first.close();

  const second = createMuseDatabase(name, { dependencies });
  await second.open();
  assert.equal(await second.table("projects").count(), 1);
  const saved = await second
    .table<Record<string, unknown>, string>("projects")
    .get("50000000-0000-4000-8000-000000000002");
  assert.equal(saved?.name, "持久化");
  second.close();
});

void test("legacy v3 upgrades in place without clearing production records", async () => {
  const name = databaseName("upgrade");
  await createLegacyV3(name);
  const database = createMuseDatabase(name, { dependencies });
  await database.open();
  const project = await database.table<Record<string, unknown>, string>("projects").get("50000000-0000-4000-8000-000000000001");
  assert.ok(project);
  assert.equal(project.name, "保留项目");
  assert.equal(project.schemaVersion, 4);
  assert.equal(database.verno, 4);
  database.close();
});

void test("migration failures are explicit and never trigger automatic reset", async () => {
  const name = databaseName("failure");
  await createLegacyV3(name);
  const database = createMuseDatabase(name, {
    dependencies,
    migrationRunner: async () => {
      await Promise.resolve();
      throw new Error("fixture migration failure");
    },
  });

  await assert.rejects(database.open(), (error: unknown) => {
    assert.ok(error instanceof StorageMigrationError);
    assert.equal(error.code, "STORAGE_MIGRATION_FAILED");
    return true;
  });
  database.close();

  const legacy = new Dexie(name, dependencies);
  legacy.version(3).stores(LEGACY_V3_STORES);
  await legacy.open();
  assert.equal(await legacy.table("projects").count(), 1);
  legacy.close();
});
