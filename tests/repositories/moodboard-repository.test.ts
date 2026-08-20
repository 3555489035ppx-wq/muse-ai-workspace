import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import { DuplicateEntityError, EntityNotFoundError, ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import type { ResearchSession } from "../../src/domain/research/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { MoodboardRepository } from "../../src/repositories/MoodboardRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`a0000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("a0000000-0000-4000-8000-000000000001");
const projectB = asProjectId("a0000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`moodboard-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const session = { id: id("3"), projectId: projectA, briefId: id("4"), query: "q", status: "active", createdAt: time, updatedAt: time } satisfies ResearchSession;
  const asset = { id: id("5"), name: "asset", type: "image", status: "ready", mimeType: "image/png", byteSize: 1, storageKey: "blob/5", createdAt: time, updatedAt: time } satisfies Asset;
  await database.table<ResearchSession, ReturnType<typeof asEntityId>>("researchSessions").add(session);
  await database.table<Asset, ReturnType<typeof asEntityId>>("assets").add(asset);
  return { asset, database, repository: new MoodboardRepository(database), session };
}

void test("MoodboardRepository persists moodboard, items and VisualDNA with parents", async () => {
  const { asset, database, repository, session } = await fixture();
  const moodboard = await repository.createMoodboard({ id: id("10"), projectId: projectA, researchSessionId: session.id, title: "board", status: "draft" });
  const item = await repository.createItem({ id: id("11"), projectId: projectA, moodboardId: moodboard.id, assetId: asset.id, role: "hero", position: 0 });
  const dna = await repository.createVisualDNA({ id: id("12"), projectId: projectA, moodboardId: moodboard.id, keywords: ["克制"], colorPalette: [{ hex: "#853C29", role: "主色" }], composition: ["留白"], imagery: ["材料"] });
  assert.equal((await repository.listMoodboardsByProject(projectA)).length, 1);
  assert.equal((await repository.listMoodboardsByProject(projectB)).length, 0);
  assert.equal((await repository.listItemsByMoodboard(moodboard.id))[0]?.id, item.id);
  assert.equal((await repository.getVisualDNA(dna.id))?.moodboardId, moodboard.id);
  database.close();
});

void test("MoodboardRepository enforces duplicate asset and parent policy", async () => {
  const { asset, database, repository, session } = await fixture();
  const moodboard = await repository.createMoodboard({ id: id("20"), projectId: projectA, researchSessionId: session.id, title: "board", status: "draft" });
  await repository.createItem({ id: id("21"), projectId: projectA, moodboardId: moodboard.id, assetId: asset.id, role: "hero", position: 0 });
  await assert.rejects(repository.createItem({ id: id("22"), projectId: projectA, moodboardId: moodboard.id, assetId: asset.id, role: "reference", position: 1 }), DuplicateEntityError);
  await assert.rejects(repository.createItem({ id: id("23"), projectId: projectA, moodboardId: moodboard.id, assetId: id("99"), role: "reference", position: 1 }), EntityNotFoundError);
  await assert.rejects(repository.createMoodboard({ id: id("24"), projectId: projectB, researchSessionId: session.id, title: "cross", status: "draft" }), ParentEntityMismatchError);
  database.close();
});
