import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Project } from "../../src/domain/project/index.js";
import { asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { createPhase0DebugController } from "../../src/features/dev/Phase0DebugPage.js";

const projectId = asProjectId("17000000-0000-4000-8000-000000000001");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

void test("App registers Phase 0 debug route behind import.meta.env.DEV", async () => {
  const source = await readFile(new URL("../../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /import\.meta\.env\.DEV[^\n]+Phase0DebugPage/);
  assert.match(source, /path="\/dev\/phase0-debug"/);
});

void test("debug controller actions cross real Repository and Service boundaries", async () => {
  const database = createMuseDatabase("phase0-debug-controller", { dependencies: { indexedDB, IDBKeyRange } });
  const project = { id: projectId, name: "调试项目", type: "brand", status: "active", stage: "brief", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time } satisfies Project;
  await database.table("projects").add(project);
  const controller = createPhase0DebugController(database);
  assert.deepEqual(await controller.listProjects(), [{ id: projectId, name: "调试项目" }]);
  assert.equal(controller.transition("DRAFT", "RESEARCHING"), "RESEARCHING");
  assert.notEqual((await controller.inspect()).state, "recovery_required");
  await controller.deleteProject(projectId);
  assert.deepEqual(await controller.listProjects(), []);
  database.close();
});
