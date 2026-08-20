import type { MuseDatabase } from "../../src/db/database.js";
import { GeneratedAssetService, GenerationJobService } from "../../src/application/generation/index.js";
import { createPromptCase } from "./prompt-case.js";

export async function createGeneratedCase(database: MuseDatabase, caseNumber: number, name: string) {
  const fixture = await createPromptCase(database, caseNumber, name); const jobs = new GenerationJobService(database, { entityIdFactory: fixture.nextId });
  const queued = await jobs.queue({ projectId: fixture.projectId, promptVersionId: fixture.promptVersionId, seed: `case-${String(caseNumber)}` }); const completed = await jobs.run(queued.jobId); if (!completed.result) throw new Error("Expected deterministic result");
  const generated = await new GeneratedAssetService(database, { entityIdFactory: fixture.nextId }).persist({ projectId: fixture.projectId, jobId: queued.jobId, result: completed.result });
  return { ...fixture, jobId: queued.jobId, generatedAssetId: generated.id, assetId: generated.assetId, generationResult: completed.result };
}
