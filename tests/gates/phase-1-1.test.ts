import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Project, ProjectBrief } from "../../src/domain/project/index.js";
import type { VersionSnapshot } from "../../src/domain/version/index.js";
import { asEntityId, asProjectId, type EntityId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import {
  BRAND_IDENTITY_TEMPLATE_ID,
  CULTURAL_HERITAGE_TEMPLATE_ID,
  TemplateInstantiationService,
} from "../../src/application/template/index.js";

void test("Phase 1.1 gate: blank, culture and brand projects persist with isolated provenance only", async () => {
  const databaseName = "phase-1-1-gate";
  const database = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } });
  let projectIndex = 1;
  let entityIndex = 10;
  const service = new TemplateInstantiationService(database, {
    clock: () => new Date(requireIsoTimestamp("2026-07-28T14:00:00.000Z")),
    projectIdFactory: () => asProjectId(`26000000-0000-4000-8000-${String(projectIndex++).padStart(12, "0")}`),
    entityIdFactory: () => asEntityId(`26000000-0000-4000-8000-${String(entityIndex++).padStart(12, "0")}`),
    provenanceIdFactory: () => asEntityId(`26000000-0000-4000-8000-${String(entityIndex++).padStart(12, "0")}`),
  });
  const blank = await service.instantiate({ name: "空白项目", description: "从具体业务问题建立创意方向", projectType: "campaign", targetOutputs: ["poster"] });
  const culture = await service.instantiate({ name: "山西文化遗产", templateId: CULTURAL_HERITAGE_TEMPLATE_ID });
  const brand = await service.instantiate({ name: "成都咖啡品牌", templateId: BRAND_IDENTITY_TEMPLATE_ID });
  database.close();

  const reloaded = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } });
  const projects = await reloaded.table<Project, EntityId>("projects").toArray();
  const briefs = await reloaded.table<ProjectBrief, EntityId>("briefs").toArray();
  const provenance = await reloaded.table<VersionSnapshot, EntityId>("versionSnapshots").toArray();
  assert.equal(projects.length, 3);
  assert.equal(briefs.length, 3);
  assert.equal(provenance.length, 2);
  assert.equal(provenance.some((item) => item.projectId === blank.projectId), false);
  assert.equal(provenance.some((item) => item.projectId === culture.projectId && item.snapshot.templateId === CULTURAL_HERITAGE_TEMPLATE_ID), true);
  assert.equal(provenance.some((item) => item.projectId === brand.projectId && item.snapshot.templateId === BRAND_IDENTITY_TEMPLATE_ID), true);
  assert.equal(new Set(briefs.map((item) => item.projectId)).size, 3);
  for (const table of ["researchSessions", "moodboards", "directions"] as const) assert.equal(await reloaded.table(table).count(), 0);
  reloaded.close();
});
