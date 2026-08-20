import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { ProjectBrief } from "../../src/domain/project/index.js";
import type { VersionSnapshot } from "../../src/domain/version/index.js";
import { asEntityId, asProjectId, type EntityId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import {
  BRAND_IDENTITY_TEMPLATE_ID,
  CULTURAL_HERITAGE_TEMPLATE_ID,
  TemplateInstantiationService,
  type TemplateInstantiationProvenance,
} from "../../src/application/template/index.js";

let databaseSequence = 0;
const entity = (suffix: string) => asEntityId(`24000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const briefStrategy = (brief: ProjectBrief) => ({
  goal: brief.goal,
  audience: brief.audience,
  context: brief.context,
  deliverables: brief.deliverables,
  constraints: brief.constraints,
});

function fixture() {
  const database = createMuseDatabase(`template-instantiation-${String(databaseSequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  let projectSequence = 1;
  let entitySequence = 10;
  const service = new TemplateInstantiationService(database, {
    clock: () => new Date(requireIsoTimestamp("2026-07-28T13:00:00.000Z")),
    projectIdFactory: () => asProjectId(`24000000-0000-4000-8000-${String(projectSequence++).padStart(12, "0")}`),
    entityIdFactory: () => entity(String(entitySequence++)),
    provenanceIdFactory: () => entity(String(entitySequence++)),
  });
  return { database, service };
}

void test("no-template creation stays minimal and deterministic", async () => {
  const { database, service } = fixture();
  const created = await service.instantiate({ name: "空白项目", description: "从真实需求开始", projectType: "campaign", targetOutputs: ["poster"] });
  assert.equal(created.templateId, undefined);
  assert.equal(await database.table("versionSnapshots").count(), 0);
  assert.equal(await database.table("researchSessions").count(), 0);
  database.close();
});

void test("product templates produce distinct brief, strategy and provenance", async () => {
  const { database, service } = fixture();
  const culture = await service.instantiate({ name: "山西文化项目", templateId: CULTURAL_HERITAGE_TEMPLATE_ID });
  const brand = await service.instantiate({ name: "成都咖啡品牌", templateId: BRAND_IDENTITY_TEMPLATE_ID });
  const briefs = await database.table<ProjectBrief, EntityId>("briefs").toArray();
  const snapshots = await database.table<VersionSnapshot, EntityId>("versionSnapshots").toArray();
  assert.equal(briefs.length, 2);
  assert.notEqual(briefs[0]?.goal, briefs[1]?.goal);
  assert.ok(briefs[0]?.deliverables.length && briefs[1]?.deliverables.length);
  assert.equal(snapshots.length, 2);
  const provenances = snapshots.map((item) => item.snapshot as unknown as TemplateInstantiationProvenance);
  assert.notDeepEqual(provenances[0]?.researchStrategy, provenances[1]?.researchStrategy);
  assert.notDeepEqual(provenances[0]?.moodboardStrategy, provenances[1]?.moodboardStrategy);
  assert.notDeepEqual(provenances[0]?.directionStrategy, provenances[1]?.directionStrategy);
  assert.notEqual(culture.projectId, brand.projectId);
  assert.equal(await database.table("moodboards").count(), 0);
  assert.equal(await database.table("directions").count(), 0);
  database.close();
});

void test("same template input preserves the same creation strategy", async () => {
  const first = fixture();
  const second = fixture();
  await first.service.instantiate({ name: "同输入", templateId: CULTURAL_HERITAGE_TEMPLATE_ID });
  await second.service.instantiate({ name: "同输入", templateId: CULTURAL_HERITAGE_TEMPLATE_ID });
  const firstBrief = await first.database.table<ProjectBrief, EntityId>("briefs").toArray();
  const secondBrief = await second.database.table<ProjectBrief, EntityId>("briefs").toArray();
  assert.deepEqual(firstBrief.map(briefStrategy), secondBrief.map(briefStrategy));
  first.database.close();
  second.database.close();
});
