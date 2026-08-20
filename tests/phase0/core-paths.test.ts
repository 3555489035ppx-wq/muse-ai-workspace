import "../repositories/base.test.js";
import "../db/asset-storage.test.js";
import "../db/migration-service.test.js";
import "../services/traceability.test.js";
import "../services/project-lifecycle.test.js";
import "../services/project-workflow.test.js";

import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import type { Direction } from "../../src/domain/direction/index.js";
import { ReferentialIntegrityError } from "../../src/domain/errors/index.js";
import type { Exploration } from "../../src/domain/exploration/index.js";
import type { GeneratedAsset, GenerationJob } from "../../src/domain/generation/index.js";
import type { Moodboard, VisualDNA } from "../../src/domain/moodboard/index.js";
import type { Project, ProjectBrief } from "../../src/domain/project/index.js";
import type { PromptSpec, PromptVersion } from "../../src/domain/prompt/index.js";
import type { ResearchSession } from "../../src/domain/research/index.js";
import { TraceabilityService, type TraceabilityReader } from "../../src/domain/services/TraceabilityService.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { isMuseSchemaVersionRecord, MUSE_SCHEMA_VERSION_KEY } from "../../src/db/migrations/metadata.js";
import { BaseRepository } from "../../src/repositories/base/BaseRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`19000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectId = asProjectId("19000000-0000-4000-8000-000000000001");
const otherProjectId = asProjectId("19000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

void test("core CRUD coverage includes list, query and delete", async () => {
  const database = createMuseDatabase(`coverage-base-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const repository = new BaseRepository<Project>(database.table("projects"), "Project", () => new Date(time));
  const project = await repository.create({ id: projectId, name: "覆盖验证", type: "brand", status: "active", stage: "brief", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4 });
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.query((item) => item.status === "active"))[0]?.id, project.id);
  await repository.delete(project.id);
  assert.equal(await repository.get(project.id), undefined);
  database.close();
});

void test("schema marker guard covers every rejected structural branch", () => {
  const valid = { id: MUSE_SCHEMA_VERSION_KEY, museSchemaVersion: 4, updatedAt: time };
  assert.equal(isMuseSchemaVersionRecord(valid), true);
  assert.equal(isMuseSchemaVersionRecord(null), false);
  assert.equal(isMuseSchemaVersionRecord([]), false);
  assert.equal(isMuseSchemaVersionRecord({ ...valid, id: "other" }), false);
  assert.equal(isMuseSchemaVersionRecord({ ...valid, museSchemaVersion: "4" }), false);
  assert.equal(isMuseSchemaVersionRecord({ ...valid, museSchemaVersion: 4.5 }), false);
  assert.equal(isMuseSchemaVersionRecord({ ...valid, museSchemaVersion: 0 }), false);
  assert.equal(isMuseSchemaVersionRecord({ ...valid, updatedAt: 1 }), false);
});

function traceFixture() {
  const project = { id: projectId, name: "P", type: "brand", status: "active", stage: "review", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time } satisfies Project;
  const brief = { id: id("2"), projectId, goal: "g", audience: "a", context: "c", deliverables: ["d"], constraints: ["c"], createdAt: time, updatedAt: time } satisfies ProjectBrief;
  const researchSession = { id: id("3"), projectId, briefId: brief.id, query: "q", status: "completed", createdAt: time, updatedAt: time } satisfies ResearchSession;
  const moodboard = { id: id("4"), projectId, researchSessionId: researchSession.id, title: "m", status: "curated", createdAt: time, updatedAt: time } satisfies Moodboard;
  const visualDNA = { id: id("5"), projectId, moodboardId: moodboard.id, keywords: ["k"], colorPalette: [{ hex: "#000000", role: "主色" }], composition: ["c"], imagery: ["i"], createdAt: time, updatedAt: time } satisfies VisualDNA;
  const direction = { id: id("6"), projectId, researchSessionId: researchSession.id, moodboardId: moodboard.id, visualDNAId: visualDNA.id, creativeSeedIds: [id("60")], opportunityIds: [id("61")], title: "d", concept: "c", narrative: "n", visualDNA: { keywords: ["k"], principles: ["p"] }, advantages: ["a"], risks: ["r"], status: "locked", createdAt: time, updatedAt: time } satisfies Direction;
  const exploration = { id: id("7"), projectId, directionId: direction.id, visualDNAId: visualDNA.id, title: "e", status: "selected", createdAt: time, updatedAt: time } satisfies Exploration;
  const promptSpec = { id: id("8"), projectId, explorationId: exploration.id, directionId: direction.id, visualDNAId: visualDNA.id, researchSessionId: researchSession.id, adapterTarget: "generic_image", objective: "o", constraints: ["c"], createdAt: time, updatedAt: time } satisfies PromptSpec;
  const promptVersion = { id: id("9"), projectId, promptSpecId: promptSpec.id, explorationId: exploration.id, directionId: direction.id, visualDNAId: visualDNA.id, researchSessionId: researchSession.id, adapterTarget: "generic_image", version: 1, promptText: "p", createdAt: time, updatedAt: time } satisfies PromptVersion;
  const generationJob = { id: id("10"), projectId, promptVersionId: promptVersion.id, adapterTarget: "generic_image", status: "succeeded", createdAt: time, updatedAt: time } satisfies GenerationJob;
  const asset = { id: id("11"), name: "a", type: "image", status: "ready", mimeType: "image/png", byteSize: 1, storageKey: "a", createdAt: time, updatedAt: time } satisfies Asset;
  const generatedAsset = { id: id("12"), projectId, generationJobId: generationJob.id, promptVersionId: promptVersion.id, assetId: asset.id, mimeType: "image/png", width: 1, height: 1, createdAt: time, updatedAt: time } satisfies GeneratedAsset;
  return { asset, brief, direction, exploration, generatedAsset, generationJob, moodboard, project, promptSpec, promptVersion, researchSession, visualDNA };
}

type TraceFixture = ReturnType<typeof traceFixture>;
function traceReader(data: TraceFixture): TraceabilityReader {
  return { getGeneratedAsset: () => Promise.resolve(data.generatedAsset), getAsset: () => Promise.resolve(data.asset), getGenerationJob: () => Promise.resolve(data.generationJob), getPromptVersion: () => Promise.resolve(data.promptVersion), getPromptSpec: () => Promise.resolve(data.promptSpec), getExploration: () => Promise.resolve(data.exploration), getDirection: () => Promise.resolve(data.direction), getVisualDNA: () => Promise.resolve(data.visualDNA), getMoodboard: () => Promise.resolve(data.moodboard), getResearchSession: () => Promise.resolve(data.researchSession), getBrief: () => Promise.resolve(data.brief), getProject: () => Promise.resolve(data.project) };
}

void test("traceability rejects an inconsistent relation and a mismatched project identity", async () => {
  const data = traceFixture();
  const badJob: TraceFixture = { ...data, generationJob: { ...data.generationJob, promptVersionId: id("99") } };
  await assert.rejects(new TraceabilityService(traceReader(badJob)).resolveGeneratedAsset(data.generatedAsset.id), ReferentialIntegrityError);
  const badProject: TraceFixture = { ...data, project: { ...data.project, id: otherProjectId } };
  await assert.rejects(new TraceabilityService(traceReader(badProject)).resolveGeneratedAsset(data.generatedAsset.id), ReferentialIntegrityError);
});
