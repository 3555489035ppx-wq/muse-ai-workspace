import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { createMuseDatabase } from "../../src/db/database.js";
import { seedPhase0 } from "../../src/db/seed.js";

let sequence = 0;

void test("Phase 0 seed is opt-in and production entry points do not invoke it", async () => {
  const database = createMuseDatabase(`seed-opt-in-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  assert.equal((await seedPhase0(database)).skipped, true);
  assert.equal(await database.table("projects").count(), 0);
  const entries = await Promise.all(["../../src/App.jsx", "../../src/main.jsx"].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.equal(entries.some((source) => source.includes("seedPhase0")), false);
  database.close();
});

void test("Phase 0 seed creates isolated A/B metadata idempotently", async () => {
  const database = createMuseDatabase(`seed-idempotent-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const first = await seedPhase0(database, "test");
  const second = await seedPhase0(database, "test");
  assert.deepEqual(second.projectIds, first.projectIds);
  assert.equal(await database.table("projects").count(), 2);
  assert.equal(await database.table("briefs").count(), 2);
  assert.equal(await database.table("canvases").count(), 2);
  for (const projectId of first.projectIds) {
    assert.equal(await database.table("briefs").where("projectId").equals(projectId).count(), 1);
    assert.equal(await database.table("canvases").where("projectId").equals(projectId).count(), 1);
  }
  database.close();
});
