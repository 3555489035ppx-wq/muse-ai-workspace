import assert from "node:assert/strict";
import test from "node:test";
import { DB_VERSION, LEGACY_DB_VERSION, LEGACY_V3_TABLES, MUSE_DB_NAME } from "../../src/db/constants.js";
import { DEXIE_STORES, TARGET_SCHEMA, TARGET_TABLE_NAMES } from "../../src/db/schema.js";
import { V3_TO_V4_PLAN } from "../../src/db/migrations/plan.js";

void test("v4 uses the existing Muse database and retains every v3 table", () => {
  assert.equal(MUSE_DB_NAME, "muse-creative-workspace");
  assert.equal(LEGACY_DB_VERSION, 3);
  assert.equal(DB_VERSION, 4);
  for (const table of LEGACY_V3_TABLES) assert.ok(table in TARGET_SCHEMA, table);
});

void test("every target table has an explicit primary key and declared parent indexes", () => {
  assert.equal(TARGET_TABLE_NAMES.length, Object.keys(DEXIE_STORES).length);
  for (const name of TARGET_TABLE_NAMES) {
    const definition = TARGET_SCHEMA[name];
    assert.ok(definition.primaryKey.length > 0, `${name}: primary key`);
    assert.equal(DEXIE_STORES[name].split(", ")[0], definition.primaryKey);
    for (const parent of definition.parentIndexes) {
      assert.ok(parent === definition.primaryKey || definition.indexes.includes(parent), `${name}: ${parent}`);
    }
  }
});

void test("critical lineage indexes and normalized canvas tables are present", () => {
  assert.ok(TARGET_SCHEMA.researchEvidence.indexes.includes("sourceId"));
  assert.ok(TARGET_SCHEMA.promptVersions.indexes.includes("promptSpecId"));
  assert.ok(TARGET_SCHEMA.generatedAssets.indexes.includes("generationJobId"));
  assert.ok(TARGET_SCHEMA.aiReviews.indexes.includes("generatedAssetId"));
  assert.ok(TARGET_SCHEMA.canvasNodes.indexes.includes("entityId"));
  assert.ok(TARGET_SCHEMA.canvasEdges.indexes.includes("sourceNodeId"));
  assert.ok(TARGET_SCHEMA.canvasEdges.indexes.includes("targetNodeId"));
});

void test("migration plan is non-destructive, recoverable and preserves ambiguous data", () => {
  assert.equal(V3_TO_V4_PLAN.fromVersion, 3);
  assert.equal(V3_TO_V4_PLAN.toVersion, 4);
  assert.equal(V3_TO_V4_PLAN.destructive, false);
  assert.equal(V3_TO_V4_PLAN.automaticReset, false);
  assert.equal(V3_TO_V4_PLAN.recoveryOnFailure, true);
  assert.ok(V3_TO_V4_PLAN.mappings.some((item) => item.rollback === "preserve-source"));
  assert.ok(V3_TO_V4_PLAN.mappings.some((item) => item.legacyTable === "providerConfigs" && item.action === "retain"));
});
