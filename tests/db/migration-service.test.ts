import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { MigrationService } from "../../src/domain/services/MigrationService.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { CURRENT_MUSE_SCHEMA_VERSION, MUSE_SCHEMA_VERSION_KEY, type MuseSchemaVersionRecord } from "../../src/db/migrations/metadata.js";

let sequence = 0;
const now = new Date("2026-07-28T08:00:00.000Z");
const database = () => createMuseDatabase(`migration-service-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
const readVersion = (db: ReturnType<typeof database>) => db.table<MuseSchemaVersionRecord, string>("preferences").get(MUSE_SCHEMA_VERSION_KEY);

void test("MigrationService migrates recognized v1-v3 markers and persists museSchemaVersion", async () => {
  for (const version of [1, 2, 3]) {
    const db = database();
    await db.table("preferences").put({ id: MUSE_SCHEMA_VERSION_KEY, museSchemaVersion: version, updatedAt: now.toISOString() });
    const result = await new MigrationService(db, { clock: () => now }).inspectAndMigrate();
    assert.equal(result.state, "migrated");
    assert.equal((await readVersion(db))?.museSchemaVersion, CURRENT_MUSE_SCHEMA_VERSION);
    db.close();
  }
});

void test("MigrationService enters recovery for unsupported and corrupt metadata without deleting it", async () => {
  for (const marker of [{ id: MUSE_SCHEMA_VERSION_KEY, museSchemaVersion: 99, updatedAt: now.toISOString() }, { id: MUSE_SCHEMA_VERSION_KEY, museSchemaVersion: "broken", updatedAt: now.toISOString() }]) {
    const db = database();
    await db.table("preferences").put(marker);
    const result = await new MigrationService(db).inspectAndMigrate();
    assert.equal(result.state, "recovery_required");
    assert.ok(result.diagnostic?.code.startsWith("MIGRATION_"));
    assert.deepEqual(await db.table("preferences").get(MUSE_SCHEMA_VERSION_KEY), marker);
    db.close();
  }
});

void test("MigrationService transaction rolls back marker updates on failure", async () => {
  const db = database();
  const old = { id: MUSE_SCHEMA_VERSION_KEY, museSchemaVersion: 3, updatedAt: now.toISOString() };
  await db.table("preferences").put(old);
  const result = await new MigrationService(db, { beforeCommit: () => { throw new Error("injected migration failure"); } }).inspectAndMigrate();
  assert.equal(result.state, "recovery_required");
  assert.deepEqual(await db.table("preferences").get(MUSE_SCHEMA_VERSION_KEY), old);
  db.close();
});

void test("MigrationService resets only through the explicit action", async () => {
  const db = database();
  await db.table("projects").put({ id: "legacy-project", name: "preserve until explicit reset" });
  const service = new MigrationService(db, { clock: () => now });
  assert.equal((await service.inspectAndMigrate()).state, "migrated");
  assert.ok(await db.table("projects").get("legacy-project"));
  assert.equal((await service.explicitReset()).state, "reset");
  assert.equal(await db.table("projects").count(), 0);
  assert.equal((await readVersion(db))?.museSchemaVersion, CURRENT_MUSE_SCHEMA_VERSION);
  db.close();
});
