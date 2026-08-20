import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { ResearchSession } from "../../src/domain/research/index.js";
import type { ProjectWorkflowState } from "../../src/domain/services/ProjectWorkflowService.js";
import { asEntityId, asProjectId, type EntityId, type ProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ProjectCreationService } from "../../src/application/project/index.js";
import { ResearchProviderError, ResearchService, type ResearchProvider } from "../../src/application/research/index.js";

let databaseIndex = 0;
const id = (value: number) => asEntityId(`28000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
interface WorkflowView { readonly id: EntityId; readonly projectId: ProjectId; readonly state: ProjectWorkflowState; }
interface OperationView { readonly id: EntityId; readonly projectId: ProjectId; readonly state: "pending" | "success" | "error"; }

async function projectFixture(name: string, projectId: ProjectId, start = 10) {
  const database = createMuseDatabase(`research-service-${String(databaseIndex++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  let entityIndex = start;
  const project = await new ProjectCreationService(database, { clock: () => new Date(requireIsoTimestamp("2026-07-28T16:00:00.000Z")), projectIdFactory: () => projectId, entityIdFactory: () => id(entityIndex++) }).create({ name, description: `${name}的完整设计研究目标`, projectType: "brand", targetOutputs: ["brand_identity"] });
  return { database, project, nextId: () => id(entityIndex++) };
}

void test("ResearchService persists complete lineage, workflow and reloadable isolation", async () => {
  const projectId = asProjectId("28000000-0000-4000-8000-000000000001");
  const fixture = await projectFixture("山西文化遗产年轻化", projectId);
  const result = await new ResearchService(fixture.database, { clock: () => new Date(requireIsoTimestamp("2026-07-28T16:00:00.000Z")), entityIdFactory: fixture.nextId }).run({ projectId, briefId: fixture.project.briefId, seed: "research-v1" });
  assert.equal(result.workflowState, "RESEARCH_READY");
  assert.equal((await fixture.database.table<ResearchSession, EntityId>("researchSessions").get(result.researchSessionId))?.status, "completed");
  assert.equal(await fixture.database.table("creativeSeeds").where("projectId").equals(projectId).count(), 1);
  assert.equal((await fixture.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(projectId).first())?.state, "RESEARCH_READY");
  fixture.database.close();
});

void test("provider failure restores DRAFT and records operation error without research rows", async () => {
  const projectId = asProjectId("28000000-0000-4000-8000-000000000002");
  const fixture = await projectFixture("失败研究", projectId, 30);
  const provider: ResearchProvider = { research: () => Promise.reject(new ResearchProviderError("PROVIDER_FAILURE", "模拟失败")) };
  await assert.rejects(new ResearchService(fixture.database, { provider, entityIdFactory: fixture.nextId }).run({ projectId, briefId: fixture.project.briefId, seed: "fail" }), /模拟失败/);
  assert.equal(await fixture.database.table("researchSessions").count(), 0);
  assert.equal((await fixture.database.table<WorkflowView, EntityId>("workflowRuns").where("projectId").equals(projectId).first())?.state, "DRAFT");
  assert.equal((await fixture.database.table<OperationView, EntityId>("operations").where("projectId").equals(projectId).first())?.state, "error");
  fixture.database.close();
});

void test("persistence failure rolls back Session-to-Seed and permits retry", async () => {
  const projectId = asProjectId("28000000-0000-4000-8000-000000000003");
  const fixture = await projectFixture("成都独立咖啡品牌", projectId, 50);
  const broken = new ResearchService(fixture.database, { entityIdFactory: fixture.nextId, faultInjector: (stage) => { if (stage === "persisting") throw new Error("persist failure"); } });
  await assert.rejects(broken.run({ projectId, briefId: fixture.project.briefId, seed: "retry" }), /persist failure/);
  for (const table of ["researchSessions", "researchSources", "researchEvidence", "researchObservations", "researchInsights", "researchOpportunities", "creativeSeeds"] as const) assert.equal(await fixture.database.table(table).count(), 0);
  const retried = await new ResearchService(fixture.database, { entityIdFactory: fixture.nextId }).run({ projectId, briefId: fixture.project.briefId, seed: "retry" });
  assert.equal(retried.workflowState, "RESEARCH_READY");
  fixture.database.close();
});

void test("already cancelled provider input restores workflow and keeps project scope clean", async () => {
  const projectId = asProjectId("28000000-0000-4000-8000-000000000004");
  const fixture = await projectFixture("取消研究", projectId, 80);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new ResearchService(fixture.database, { entityIdFactory: fixture.nextId }).run({ projectId, briefId: fixture.project.briefId, seed: "cancel", signal: controller.signal }), /取消/);
  assert.equal(await fixture.database.table("researchSessions").count(), 0);
  fixture.database.close();
});
