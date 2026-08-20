import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { EntityNotFoundError, ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import type { ProjectBrief } from "../../src/domain/project/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ResearchRepository } from "../../src/repositories/ResearchRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`90000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("90000000-0000-4000-8000-000000000001");
const projectB = asProjectId("90000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`research-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const briefA = { id: id("3"), projectId: projectA, goal: "goal", audience: "audience", context: "context", deliverables: ["direction"], constraints: [], createdAt: time, updatedAt: time } satisfies ProjectBrief;
  const briefB = { ...briefA, id: id("4"), projectId: projectB } satisfies ProjectBrief;
  await database.table<ProjectBrief, ReturnType<typeof asEntityId>>("briefs").bulkAdd([briefA, briefB]);
  return { database, briefA, briefB, repository: new ResearchRepository(database) };
}

async function createChain(repository: ResearchRepository, briefId = id("3"), projectId = projectA) {
  const session = await repository.createSession({ id: id("10"), projectId, briefId, query: "query", status: "active" });
  const source = await repository.createSource({ id: id("11"), projectId, researchSessionId: session.id, type: "archive", title: "source" });
  const evidence = await repository.createEvidence({ id: id("12"), projectId, researchSessionId: session.id, sourceId: source.id, excerpt: "evidence" });
  const observation = await repository.createObservation({ id: id("13"), projectId, researchSessionId: session.id, evidenceIds: [evidence.id], statement: "observation" });
  const insight = await repository.createInsight({ id: id("14"), projectId, researchSessionId: session.id, observationIds: [observation.id], statement: "insight" });
  const opportunity = await repository.createOpportunity({ id: id("15"), projectId, researchSessionId: session.id, insightIds: [insight.id], statement: "opportunity" });
  const seed = await repository.createCreativeSeed({ id: id("16"), projectId, researchSessionId: session.id, opportunityIds: [opportunity.id], title: "seed", premise: "premise" });
  return { session, source, evidence, observation, insight, opportunity, seed };
}

void test("ResearchRepository persists a complete parent-validated research chain", async () => {
  const { database, repository } = await fixture();
  const chain = await createChain(repository);
  assert.equal((await repository.getCreativeSeed(chain.seed.id))?.opportunityIds[0], chain.opportunity.id);
  assert.equal((await repository.listSourcesBySession(chain.session.id)).length, 1);
  assert.equal((await repository.listEvidenceBySession(chain.session.id)).length, 1);
  assert.equal((await repository.listObservationsBySession(chain.session.id)).length, 1);
  assert.equal((await repository.listInsightsBySession(chain.session.id)).length, 1);
  assert.equal((await repository.listOpportunitiesBySession(chain.session.id)).length, 1);
  assert.equal((await repository.listSeedsBySession(chain.session.id)).length, 1);
  database.close();
});

void test("ResearchRepository rejects missing and cross-project parents and isolates queries", async () => {
  const { database, briefB, repository } = await fixture();
  const chain = await createChain(repository);
  await assert.rejects(repository.createSource({ id: id("20"), projectId: projectB, researchSessionId: chain.session.id, type: "web", title: "cross" }), ParentEntityMismatchError);
  await assert.rejects(repository.createEvidence({ id: id("21"), projectId: projectA, researchSessionId: chain.session.id, sourceId: id("99"), excerpt: "missing" }), EntityNotFoundError);
  await repository.createSession({ id: id("22"), projectId: projectB, briefId: briefB.id, query: "B", status: "draft" });
  assert.equal((await repository.listSessionsByProject(projectA)).length, 1);
  assert.equal((await repository.listSessionsByProject(projectB)).length, 1);
  database.close();
});

void test("ResearchRepository batch transaction rolls back when any parent is invalid", async () => {
  const { database, repository } = await fixture();
  const chain = await createChain(repository);
  await assert.rejects(
    repository.createEvidenceBatch([
      { id: id("30"), projectId: projectA, researchSessionId: chain.session.id, sourceId: chain.source.id, excerpt: "valid first" },
      { id: id("31"), projectId: projectA, researchSessionId: chain.session.id, sourceId: id("98"), excerpt: "invalid second" },
    ]),
    EntityNotFoundError,
  );
  assert.equal(await repository.getEvidence(id("30")), undefined);
  database.close();
});
