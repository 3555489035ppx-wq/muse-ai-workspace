import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import {
  DuplicateEntityError,
  EntityNotFoundError,
} from "../../src/domain/errors/index.js";
import type { Project } from "../../src/domain/project/index.js";
import { asProjectId } from "../../src/domain/shared/id.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ProjectRepository } from "../../src/repositories/ProjectRepository.js";

let sequence = 0;
const dependencies = { indexedDB, IDBKeyRange };

function projectInput(id: ReturnType<typeof asProjectId>) {
  return {
    id,
    name: "山西文化遗产年轻化",
    type: "brand",
    status: "active",
    stage: "brief",
    outputTypes: ["brand_identity"],
    settings: { locale: "zh-CN", timezone: "Asia/Shanghai" },
    schemaVersion: 4,
  } as const;
}

void test("ProjectRepository persists CRUD, timestamps and query fields", async () => {
  const database = createMuseDatabase(`project-repo-${String(sequence++)}`, {
    dependencies,
  });
  const ticks = [
    new Date("2026-07-28T01:00:00.000Z"),
    new Date("2026-07-28T02:00:00.000Z"),
  ];
  const repository = new ProjectRepository(database, () => {
    const tick = ticks.shift();
    assert.ok(tick);
    return tick;
  });
  const id = asProjectId("80000000-0000-4000-8000-000000000001");
  const created = await repository.create(projectInput(id));
  assert.equal(created.createdAt, "2026-07-28T01:00:00.000Z");
  const updated = await repository.update(id, { name: "更新名称" });
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.updatedAt, "2026-07-28T02:00:00.000Z");
  assert.equal((await repository.findByStatus("active")).length, 1);
  assert.equal((await repository.findByStage("brief")).length, 1);
  assert.equal((await repository.findBySchemaVersion(4)).length, 1);
  assert.equal((await repository.list()).length, 1);
  database.close();
});

void test("ProjectRepository rejects duplicate and missing records", async () => {
  const database = createMuseDatabase(`project-repo-${String(sequence++)}`, {
    dependencies,
  });
  const repository = new ProjectRepository(database);
  const id = asProjectId("80000000-0000-4000-8000-000000000002");
  await repository.create(projectInput(id));
  await assert.rejects(repository.create(projectInput(id)), DuplicateEntityError);
  await assert.rejects(
    repository.require(asProjectId("80000000-0000-4000-8000-000000000003")),
    EntityNotFoundError,
  );
  await repository.delete(id);
  assert.equal(await repository.get(id), undefined);
  database.close();
});

void test("ProjectRepository reloads persisted projects from the same database", async () => {
  const name = `project-repo-${String(sequence++)}`;
  const id = asProjectId("80000000-0000-4000-8000-000000000004");
  const first = createMuseDatabase(name, { dependencies });
  await new ProjectRepository(first).create(projectInput(id));
  first.close();

  const second = createMuseDatabase(name, { dependencies });
  const reloaded: Project | undefined = await new ProjectRepository(second).get(id);
  assert.ok(reloaded);
  assert.equal(reloaded.name, "山西文化遗产年轻化");
  assert.equal(reloaded.schemaVersion, 4);
  second.close();
});
