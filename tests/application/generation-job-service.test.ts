import assert from "node:assert/strict";
import test from "node:test";
import { asEntityId } from "../../src/domain/shared/id.js";
import { GenerationJobService, GenerationProviderError } from "../../src/application/generation/index.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createPromptCase } from "../helpers/prompt-case.js";

void test("mock job persists queued, succeeded, failed, cancelled and retry attempts", async () => {
  const database = gateDatabase("p16-job-states");
  try {
    const fixture = await createPromptCase(database, 61, "山西文化遗产");
    const ids = [900, 901, 902, 903, 904, 905].map(value => asEntityId(`40610000-0000-4000-8000-${String(value).padStart(12, "0")}`));
    const service = new GenerationJobService(database, { entityIdFactory: () => { const next = ids.shift(); if (!next) throw new Error("ids exhausted"); return next; } });
    const queued = await service.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: "stable" });
    assert.equal((await service.get(queued.jobId))?.status, "queued");
    const completed = await service.run(queued.jobId); assert.equal(completed.status, "succeeded"); assert.match(completed.result?.fixtureKey ?? "", /^muse-mock-/);
    await assert.rejects(() => service.cancel(queued.jobId), GenerationProviderError);
    const failed = await service.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: "fail-on-purpose" });
    assert.equal((await service.run(failed.jobId)).status, "failed");
    const retry = await service.retry(failed.jobId); assert.equal(retry.attempt, 3); assert.equal((await service.run(retry.jobId)).status, "succeeded");
  } finally { database.close(); }
});

void test("queued cancellation persists and survives repository reload", async () => {
  const database = gateDatabase("p16-job-cancel");
  try {
    const fixture = await createPromptCase(database, 62, "成都独立咖啡");
    const service = new GenerationJobService(database);
    const queued = await service.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: "cancel" });
    await service.cancel(queued.jobId);
    assert.equal((await new GenerationJobService(database).get(queued.jobId))?.status, "cancelled");
    await assert.rejects(() => service.run(queued.jobId), GenerationProviderError);
  } finally { database.close(); }
});
