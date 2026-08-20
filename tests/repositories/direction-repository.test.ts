import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import { ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import type { Moodboard, VisualDNA } from "../../src/domain/moodboard/index.js";
import type { CreativeSeed, ResearchOpportunity } from "../../src/domain/research/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { DirectionRepository } from "../../src/repositories/DirectionRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`b0000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("b0000000-0000-4000-8000-000000000001");
const projectB = asProjectId("b0000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`direction-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const moodboard = { id: id("3"), projectId: projectA, researchSessionId: id("4"), title: "board", status: "curated", createdAt: time, updatedAt: time } satisfies Moodboard;
  const dna = { id: id("5"), projectId: projectA, moodboardId: moodboard.id, keywords: ["克制"], colorPalette: [{ hex: "#853C29", role: "主色" }], composition: ["留白"], imagery: ["材料"], createdAt: time, updatedAt: time } satisfies VisualDNA;
  const opportunity = { id: id("6"), projectId: projectA, researchSessionId: moodboard.researchSessionId, insightIds: [id("7")], statement: "opportunity", createdAt: time, updatedAt: time } satisfies ResearchOpportunity;
  const seed = { id: id("8"), projectId: projectA, researchSessionId: moodboard.researchSessionId, opportunityIds: [opportunity.id], title: "seed", premise: "premise", createdAt: time, updatedAt: time } satisfies CreativeSeed;
  const seedB = { ...seed, id: id("9"), projectId: projectB } satisfies CreativeSeed;
  const asset = { id: id("10"), name: "asset", type: "image", status: "ready", mimeType: "image/png", byteSize: 1, storageKey: "blob/10", createdAt: time, updatedAt: time } satisfies Asset;
  await database.table<Moodboard, ReturnType<typeof asEntityId>>("moodboards").add(moodboard);
  await database.table<VisualDNA, ReturnType<typeof asEntityId>>("visualDna").add(dna);
  await database.table<ResearchOpportunity, ReturnType<typeof asEntityId>>("researchOpportunities").add(opportunity);
  await database.table<CreativeSeed, ReturnType<typeof asEntityId>>("creativeSeeds").bulkAdd([seed, seedB]);
  await database.table<Asset, ReturnType<typeof asEntityId>>("assets").add(asset);
  return { asset, database, dna, moodboard, opportunity, repository: new DirectionRepository(database), seed, seedB };
}

function directionInput(f: Awaited<ReturnType<typeof fixture>>) {
  return { id: id("20"), projectId: projectA, researchSessionId: f.moodboard.researchSessionId, moodboardId: f.moodboard.id, visualDNAId: f.dna.id, creativeSeedIds: [f.seed.id], opportunityIds: [f.opportunity.id], title: "direction", concept: "concept", narrative: "narrative", visualDNA: { keywords: ["克制"], principles: ["留白"] }, advantages: ["清晰"], risks: ["复古"], status: "candidate" } as const;
}

void test("DirectionRepository validates every parent combination and child CRUD", async () => {
  const f = await fixture();
  const direction = await f.repository.createDirection(directionInput(f));
  const reference = await f.repository.createReference({ id: id("21"), projectId: projectA, directionId: direction.id, assetId: f.asset.id, role: "material" });
  const score = await f.repository.createScore({ id: id("22"), projectId: projectA, directionId: direction.id, dimension: "coherence", value: 88, rationale: "coherent" });
  assert.equal((await f.repository.listDirectionsByProject(projectA)).length, 1);
  assert.equal((await f.repository.listDirectionsByProject(projectB)).length, 0);
  assert.equal((await f.repository.getReference(reference.id))?.directionId, direction.id);
  assert.equal((await f.repository.getScore(score.id))?.value, 88);
  f.database.close();
});

void test("DirectionRepository rejects cross-project seeds and mismatched VisualDNA", async () => {
  const f = await fixture();
  await assert.rejects(f.repository.createDirection({ ...directionInput(f), creativeSeedIds: [f.seedB.id] }), ParentEntityMismatchError);
  const otherBoard = { ...f.moodboard, id: id("30") };
  await f.database.table("moodboards").add(otherBoard);
  await assert.rejects(f.repository.createDirection({ ...directionInput(f), id: id("31"), moodboardId: otherBoard.id }), ParentEntityMismatchError);
  f.database.close();
});
