import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Project } from "../../src/domain/project/index.js";
import { asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ProjectRepository } from "../../src/repositories/ProjectRepository.js";
import { createMuseV3Store, queryActiveProject } from "../../src/stores/useMuseV3Store.js";

let sequence = 0;
const projectA = asProjectId("15000000-0000-4000-8000-000000000001");
const projectB = asProjectId("15000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");
const project = (id: typeof projectA, name: string): Project => ({ id, name, type: "brand", status: "active", stage: "brief", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time });

void test("thin store switches A/B while entity data remains repository isolated", async () => {
  const database = createMuseDatabase(`thin-store-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  await database.table("projects").bulkAdd([project(projectA, "A"), project(projectB, "B")]);
  const repository = new ProjectRepository(database);
  const store = createMuseV3Store();
  store.getState().setActiveProject(projectA);
  assert.equal((await queryActiveProject(store, repository))?.name, "A");
  store.getState().setSelection({ entityId: projectA, entityType: "project" });
  store.getState().setActiveProject(projectB);
  assert.equal((await queryActiveProject(store, repository))?.name, "B");
  assert.deepEqual(store.getState().selection, {});
  assert.equal((await repository.list()).length, 2);
  database.close();
});

void test("operation state is independent from workflow data", () => {
  const store = createMuseV3Store();
  const workflowState = "DIRECTIONS_READY";
  store.getState().setOperationState("pending");
  assert.equal(store.getState().operationState, "pending");
  assert.equal(workflowState, "DIRECTIONS_READY");
  assert.equal("workflowState" in store.getState(), false);
});

void test("recreating thin store does not erase persisted repository data", async () => {
  const database = createMuseDatabase(`thin-store-rebuild-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const repository = new ProjectRepository(database);
  await database.table("projects").add(project(projectA, "持久项目"));
  const first = createMuseV3Store();
  first.getState().setActiveProject(projectA);
  const rebuilt = createMuseV3Store();
  assert.equal(rebuilt.getState().activeProjectId, undefined);
  rebuilt.getState().setActiveProject(projectA);
  assert.equal((await queryActiveProject(rebuilt, repository))?.name, "持久项目");
  database.close();
});
