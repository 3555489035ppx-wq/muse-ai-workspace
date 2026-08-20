import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import type { Direction, DirectionReference } from "../../src/domain/direction/index.js";
import { ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ExplorationRepository } from "../../src/repositories/ExplorationRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`c0000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("c0000000-0000-4000-8000-000000000001");
const projectB = asProjectId("c0000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`exploration-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const direction = { id: id("3"), projectId: projectA, researchSessionId: id("4"), moodboardId: id("5"), visualDNAId: id("6"), creativeSeedIds: [id("7")], opportunityIds: [id("8")], title: "direction", concept: "concept", narrative: "narrative", visualDNA: { keywords: ["k"], principles: ["p"] }, advantages: ["a"], risks: ["r"], status: "locked", createdAt: time, updatedAt: time } satisfies Direction;
  const reference = { id: id("9"), projectId: projectA, directionId: direction.id, assetId: id("10"), role: "material", createdAt: time, updatedAt: time } satisfies DirectionReference;
  const asset = { id: reference.assetId, name: "asset", type: "image", status: "ready", mimeType: "image/png", byteSize: 1, storageKey: "blob/10", createdAt: time, updatedAt: time } satisfies Asset;
  await database.table<Direction, ReturnType<typeof asEntityId>>("directions").add(direction);
  await database.table<DirectionReference, ReturnType<typeof asEntityId>>("directionReferences").add(reference);
  await database.table<Asset, ReturnType<typeof asEntityId>>("assets").add(asset);
  const ticks = [new Date("2026-07-28T09:00:00.000Z"), new Date("2026-07-28T10:00:00.000Z"), new Date("2026-07-28T11:00:00.000Z")];
  const repository = new ExplorationRepository(database, () => {
    const tick = ticks.shift();
    assert.ok(tick);
    return tick;
  });
  return { asset, database, direction, reference, repository };
}

void test("ExplorationRepository persists parents, variants, updates and isolation", async () => {
  const f = await fixture();
  const exploration = await f.repository.createExploration({ id: id("20"), projectId: projectA, directionId: f.direction.id, visualDNAId: f.direction.visualDNAId, title: "explore", status: "draft" });
  const updated = await f.repository.updateExploration(exploration.id, { title: "updated" });
  assert.equal(updated.updatedAt, "2026-07-28T10:00:00.000Z");
  const variant = await f.repository.createVariant({ id: id("21"), projectId: projectA, explorationId: exploration.id, directionId: f.direction.id, visualDNAId: f.direction.visualDNAId, referenceIds: [f.reference.id], sourceAssetIds: [f.asset.id], label: "A", status: "draft" });
  assert.equal((await f.repository.listVariantsByExploration(exploration.id))[0]?.id, variant.id);
  assert.equal((await f.repository.listExplorationsByProject(projectB)).length, 0);
  f.database.close();
});

void test("ExplorationRepository rejects cross-project and mismatched lineage", async () => {
  const f = await fixture();
  await assert.rejects(f.repository.createExploration({ id: id("30"), projectId: projectB, directionId: f.direction.id, visualDNAId: f.direction.visualDNAId, title: "cross", status: "draft" }), ParentEntityMismatchError);
  const exploration = await f.repository.createExploration({ id: id("31"), projectId: projectA, directionId: f.direction.id, visualDNAId: f.direction.visualDNAId, title: "ok", status: "draft" });
  await assert.rejects(f.repository.createVariant({ id: id("32"), projectId: projectA, explorationId: exploration.id, directionId: f.direction.id, visualDNAId: id("99"), referenceIds: [], sourceAssetIds: [], label: "bad", status: "draft" }), ParentEntityMismatchError);
  f.database.close();
});
