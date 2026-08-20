import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Asset } from "../../src/domain/asset/index.js";
import { ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import type { PromptVersion } from "../../src/domain/prompt/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { GenerationRepository } from "../../src/repositories/GenerationRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`e0000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("e0000000-0000-4000-8000-000000000001");
const projectB = asProjectId("e0000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

async function fixture() {
  const database = createMuseDatabase(`generation-repo-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const prompt = { id: id("3"), projectId: projectA, promptSpecId: id("4"), explorationId: id("5"), directionId: id("6"), visualDNAId: id("7"), researchSessionId: id("8"), adapterTarget: "generic_image", version: 1, promptText: "prompt", createdAt: time, updatedAt: time } satisfies PromptVersion;
  const asset = { id: id("9"), name: "metadata", type: "image", status: "ready", mimeType: "image/png", byteSize: 0, storageKey: "blob/9", createdAt: time, updatedAt: time } satisfies Asset;
  const source = { ...asset, id: id("10"), storageKey: "blob/10" } satisfies Asset;
  await database.table<PromptVersion, ReturnType<typeof asEntityId>>("promptVersions").add(prompt);
  await database.table<Asset, ReturnType<typeof asEntityId>>("assets").bulkAdd([asset, source]);
  return { asset, database, prompt, repository: new GenerationRepository(database), source };
}

void test("GenerationRepository preserves Job→Prompt→Asset→Edit lineage", async () => {
  const f = await fixture();
  const job = await f.repository.createJob({ id: id("20"), projectId: projectA, promptVersionId: f.prompt.id, adapterTarget: "generic_image", status: "succeeded" });
  const generated = await f.repository.createGeneratedAsset({ id: id("21"), projectId: projectA, generationJobId: job.id, promptVersionId: f.prompt.id, assetId: f.asset.id, mimeType: "image/png", width: 1024, height: 1024 });
  const edit = await f.repository.createImageEdit({ id: id("22"), projectId: projectA, generatedAssetId: generated.id, sourceAssetId: f.source.id, promptVersionId: f.prompt.id, type: "crop", instruction: "crop" });
  assert.equal((await f.repository.listGeneratedByJob(job.id))[0]?.id, generated.id);
  assert.equal((await f.repository.getImageEdit(edit.id))?.generatedAssetId, generated.id);
  assert.equal((await f.repository.listJobsByProject(projectB)).length, 0);
  f.database.close();
});

void test("GenerationRepository rejects cross-project and mismatched parent chains", async () => {
  const f = await fixture();
  await assert.rejects(f.repository.createJob({ id: id("30"), projectId: projectB, promptVersionId: f.prompt.id, adapterTarget: "generic_image", status: "queued" }), ParentEntityMismatchError);
  const job = await f.repository.createJob({ id: id("31"), projectId: projectA, promptVersionId: f.prompt.id, adapterTarget: "generic_image", status: "succeeded" });
  const otherPrompt = { ...f.prompt, id: id("32"), version: 2 };
  await f.database.table("promptVersions").add(otherPrompt);
  await assert.rejects(f.repository.createGeneratedAsset({ id: id("33"), projectId: projectA, generationJobId: job.id, promptVersionId: otherPrompt.id, assetId: f.asset.id, mimeType: "image/png", width: 1, height: 1 }), ParentEntityMismatchError);
  f.database.close();
});
