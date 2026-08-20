import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Project, ProjectBrief } from "../../src/domain/project/index.js";
import type { EntityId, ProjectId } from "../../src/domain/shared/id.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import {
  ProjectCreationService,
  PROJECT_CREATION_IDEMPOTENCY_POLICY,
} from "../../src/application/project/index.js";

let sequence = 0;
const time = requireIsoTimestamp("2026-07-28T12:00:00.000Z");
const projectA = asProjectId("22000000-0000-4000-8000-000000000001");
const projectB = asProjectId("22000000-0000-4000-8000-000000000002");
const entity = (suffix: string) => asEntityId(`22000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const command = (name: string) => ({ name, description: `${name}目标`, projectType: "brand", targetOutputs: ["brand_identity"], constraints: ["保持可执行"] } as const);

function serviceFixture(projectIds: readonly ProjectId[] = [projectA]) {
  const database = createMuseDatabase(`project-creation-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  let projectIndex = 0;
  let entityIndex = 10;
  const fallbackProjectId = projectIds.at(-1) ?? projectA;
  const service = new ProjectCreationService(database, {
    clock: () => new Date(time),
    projectIdFactory: () => projectIds[projectIndex++] ?? fallbackProjectId,
    entityIdFactory: () => entity(String(entityIndex++)),
  });
  return { database, service };
}

void test("ProjectCreationService atomically creates and reloads Project, Brief and DRAFT workflow", async () => {
  const { database, service } = serviceFixture();
  const result = await service.create(command("真实项目"));
  assert.deepEqual(result, { projectId: projectA, briefId: entity("10"), workflowState: "DRAFT" });
  const project = await database.table<Project, EntityId>("projects").get(projectA);
  const brief = await database.table<ProjectBrief, EntityId>("briefs").get(result.briefId);
  const workflow = await database
    .table<{ readonly id: EntityId; readonly projectId: ProjectId; readonly state: string }, EntityId>("workflowRuns")
    .where("projectId")
    .equals(projectA)
    .first();
  assert.ok(project);
  assert.ok(brief);
  assert.ok(workflow);
  assert.equal(project.name, "真实项目");
  assert.equal(project.createdAt, time);
  assert.equal(brief.goal, "真实项目目标");
  assert.equal(brief.projectId, projectA);
  assert.equal(workflow.state, "DRAFT");
  database.close();
});

void test("ProjectCreationService rolls back every record when the transaction fails", async () => {
  const database = createMuseDatabase(`project-creation-rollback-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const service = new ProjectCreationService(database, {
    clock: () => new Date(time), projectIdFactory: () => projectA, entityIdFactory: (() => { let i = 20; return () => entity(String(i++)); })(),
    faultInjector: (stage) => { if (stage === "brief_created") throw new Error("injected project creation failure"); },
  });
  await assert.rejects(service.create(command("回滚项目")), /injected project creation failure/);
  assert.equal(await database.table("projects").count(), 0);
  assert.equal(await database.table("briefs").count(), 0);
  assert.equal(await database.table("workflowRuns").count(), 0);
  database.close();
});

void test("duplicate submissions follow the explicit create-new-project policy", async () => {
  const { database, service } = serviceFixture([projectA, projectB]);
  assert.equal(PROJECT_CREATION_IDEMPOTENCY_POLICY, "create-new-project-per-submission");
  const first = await service.create(command("同一意图"));
  const second = await service.create(command("同一意图"));
  assert.notEqual(first.projectId, second.projectId);
  assert.equal(await database.table("projects").count(), 2);
  database.close();
});

void test("projects A and B keep their briefs and workflows isolated", async () => {
  const { database, service } = serviceFixture([projectA, projectB]);
  await service.create(command("项目 A"));
  await service.create(command("项目 B"));
  assert.equal(await database.table("briefs").where("projectId").equals(projectA).count(), 1);
  assert.equal(await database.table("briefs").where("projectId").equals(projectB).count(), 1);
  assert.equal(await database.table("workflowRuns").where("projectId").equals(projectA).count(), 1);
  assert.equal(await database.table("workflowRuns").where("projectId").equals(projectB).count(), 1);
  database.close();
});
