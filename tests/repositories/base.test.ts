import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import {
  DuplicateEntityError,
  EntityNotFoundError,
  ParentEntityMismatchError,
  ProjectScopeViolationError,
} from "../../src/domain/errors/index.js";
import type { ProjectScopedEntity } from "../../src/domain/shared/entity.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { createMuseDatabase } from "../../src/db/database.js";
import {
  BaseRepository,
  assertProjectScope,
  requireParent,
} from "../../src/repositories/base/index.js";
import { runWriteTransaction } from "../../src/repositories/transaction.js";

interface FixtureEntity extends ProjectScopedEntity {
  readonly name: string;
}

let sequence = 0;
function fixture() {
  const database = createMuseDatabase(`repository-base-${String(sequence++)}`, {
    dependencies: { indexedDB, IDBKeyRange },
  });
  const table = database.table<FixtureEntity, ReturnType<typeof asEntityId>>("briefs");
  const ticks = [
    new Date("2026-07-28T01:00:00.000Z"),
    new Date("2026-07-28T02:00:00.000Z"),
  ];
  const repository = new BaseRepository(table, "Fixture", () => {
    const tick = ticks.shift();
    assert.ok(tick);
    return tick;
  });
  return { database, repository, table };
}

void test("base repository owns create/update timestamps and rejects duplicates", async () => {
  const { database, repository } = fixture();
  const id = asEntityId("70000000-0000-4000-8000-000000000001");
  const projectId = asProjectId("70000000-0000-4000-8000-000000000002");
  const attemptedCreate = {
    id,
    projectId,
    name: "初始",
    createdAt: "1999-01-01T00:00:00.000Z",
    updatedAt: "1999-01-01T00:00:00.000Z",
  };
  const created = await repository.create(attemptedCreate);
  assert.equal(created.createdAt, "2026-07-28T01:00:00.000Z");
  assert.equal(created.updatedAt, created.createdAt);

  const attemptedUpdate = {
    name: "更新",
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
  };
  const updated = await repository.update(id, attemptedUpdate);
  assert.equal(updated.name, "更新");
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.updatedAt, "2026-07-28T02:00:00.000Z");
  await assert.rejects(repository.create(attemptedCreate), DuplicateEntityError);
  database.close();
});

void test("base repository exposes typed not-found and project scope errors", async () => {
  const { database, repository } = fixture();
  const missing = asEntityId("70000000-0000-4000-8000-000000000003");
  await assert.rejects(repository.require(missing), EntityNotFoundError);
  const entity = {
    id: missing,
    projectId: asProjectId("70000000-0000-4000-8000-000000000004"),
    name: "scope",
    createdAt: "2026-07-28T01:00:00.000Z",
    updatedAt: "2026-07-28T01:00:00.000Z",
  } as FixtureEntity;
  assert.throws(
    () => {
      assertProjectScope(
        entity,
        asProjectId("70000000-0000-4000-8000-000000000005"),
      );
    },
    ProjectScopeViolationError,
  );
  database.close();
});

void test("parent validator rejects missing and cross-project parents", async () => {
  const { database, table } = fixture();
  const parentId = asEntityId("70000000-0000-4000-8000-000000000006");
  const projectA = asProjectId("70000000-0000-4000-8000-000000000007");
  const projectB = asProjectId("70000000-0000-4000-8000-000000000008");
  await table.put({
    id: parentId,
    projectId: projectA,
    name: "parent",
    createdAt: "2026-07-28T01:00:00.000Z",
    updatedAt: "2026-07-28T01:00:00.000Z",
  } as FixtureEntity);
  await assert.rejects(
    requireParent(table, asEntityId("70000000-0000-4000-8000-000000000009"), projectA, "Fixture"),
    EntityNotFoundError,
  );
  await assert.rejects(
    requireParent(table, parentId, projectB, "Fixture"),
    ParentEntityMismatchError,
  );
  assert.equal((await requireParent(table, parentId, projectA, "Fixture")).id, parentId);
  database.close();
});

void test("typed transaction helper rolls back every write on failure", async () => {
  const { database, table } = fixture();
  await assert.rejects(
    runWriteTransaction(database, [table], async () => {
      await table.add({
        id: asEntityId("70000000-0000-4000-8000-000000000010"),
        projectId: asProjectId("70000000-0000-4000-8000-000000000011"),
        name: "rollback",
        createdAt: "2026-07-28T01:00:00.000Z",
        updatedAt: "2026-07-28T01:00:00.000Z",
      } as FixtureEntity);
      throw new Error("rollback fixture");
    }),
    /rollback fixture/,
  );
  assert.equal(await table.count(), 0);
  database.close();
});
