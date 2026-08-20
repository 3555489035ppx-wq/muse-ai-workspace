import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Direction } from "../../src/domain/direction/index.js";
import { DomainError, DuplicateEntityError, ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import type { Exploration } from "../../src/domain/exploration/index.js";
import type { VisualDNA } from "../../src/domain/moodboard/index.js";
import type { ResearchSession } from "../../src/domain/research/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { PromptRepository } from "../../src/repositories/PromptRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`d0000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("d0000000-0000-4000-8000-000000000001");
const projectB = asProjectId("d0000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`prompt-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const session = { id: id("3"), projectId: projectA, briefId: id("4"), query: "q", status: "completed", createdAt: time, updatedAt: time } satisfies ResearchSession;
  const dna = { id: id("5"), projectId: projectA, moodboardId: id("6"), keywords: ["k"], colorPalette: [{ hex: "#853C29", role: "主色" }], composition: ["c"], imagery: ["i"], createdAt: time, updatedAt: time } satisfies VisualDNA;
  const direction = { id: id("7"), projectId: projectA, researchSessionId: session.id, moodboardId: dna.moodboardId, visualDNAId: dna.id, creativeSeedIds: [id("8")], opportunityIds: [id("9")], title: "d", concept: "c", narrative: "n", visualDNA: { keywords: ["k"], principles: ["p"] }, advantages: ["a"], risks: ["r"], status: "locked", createdAt: time, updatedAt: time } satisfies Direction;
  const exploration = { id: id("10"), projectId: projectA, directionId: direction.id, visualDNAId: dna.id, title: "e", status: "selected", createdAt: time, updatedAt: time } satisfies Exploration;
  await database.table<ResearchSession, ReturnType<typeof asEntityId>>("researchSessions").add(session);
  await database.table<VisualDNA, ReturnType<typeof asEntityId>>("visualDna").add(dna);
  await database.table<Direction, ReturnType<typeof asEntityId>>("directions").add(direction);
  await database.table<Exploration, ReturnType<typeof asEntityId>>("explorations").add(exploration);
  return { database, direction, dna, exploration, repository: new PromptRepository(database), session };
}

function specInput(f: Awaited<ReturnType<typeof fixture>>) {
  return { id: id("20"), projectId: projectA, explorationId: f.exploration.id, directionId: f.direction.id, visualDNAId: f.dna.id, researchSessionId: f.session.id, adapterTarget: "generic_image", objective: "visual", constraints: ["safe"] } as const;
}

void test("PromptRepository persists specs and sequential versions", async () => {
  const f = await fixture();
  const spec = await f.repository.createSpec(specInput(f));
  const base = { projectId: projectA, promptSpecId: spec.id, explorationId: spec.explorationId, directionId: spec.directionId, visualDNAId: spec.visualDNAId, researchSessionId: spec.researchSessionId, adapterTarget: spec.adapterTarget } as const;
  await f.repository.createVersion({ ...base, id: id("21"), version: 1, promptText: "v1" });
  await f.repository.createVersion({ ...base, id: id("22"), version: 2, promptText: "v2" });
  assert.deepEqual((await f.repository.listVersionsBySpec(spec.id)).map((item) => item.version), [1, 2]);
  assert.equal((await f.repository.listSpecsByProject(projectB)).length, 0);
  f.database.close();
});

void test("PromptRepository rejects cross-project, duplicate and gapped versions", async () => {
  const f = await fixture();
  await assert.rejects(f.repository.createSpec({ ...specInput(f), projectId: projectB }), ParentEntityMismatchError);
  const spec = await f.repository.createSpec(specInput(f));
  const base = { projectId: projectA, promptSpecId: spec.id, explorationId: spec.explorationId, directionId: spec.directionId, visualDNAId: spec.visualDNAId, researchSessionId: spec.researchSessionId, adapterTarget: spec.adapterTarget } as const;
  await f.repository.createVersion({ ...base, id: id("30"), version: 1, promptText: "v1" });
  await assert.rejects(f.repository.createVersion({ ...base, id: id("31"), version: 1, promptText: "duplicate" }), DuplicateEntityError);
  await assert.rejects(f.repository.createVersion({ ...base, id: id("32"), version: 3, promptText: "gap" }), (error: unknown) => error instanceof DomainError && error.code === "PROMPT_VERSION_GAP");
  f.database.close();
});
