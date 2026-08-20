import { ResearchProviderError, validateResearchProviderOutput, type ResearchProvider, type ResearchProviderInput, type ResearchProviderOutput } from "../../../../application/research/index.js";
import { getResearchFixtureKey, stableResearchHash } from "./fixtureKey.js";
import { researchFixture } from "./fixtures.js";

export class DeterministicMockResearchProvider implements ResearchProvider {
  research(input: ResearchProviderInput): Promise<ResearchProviderOutput> {
    if (input.signal?.aborted) return Promise.reject(new ResearchProviderError("CANCELLED", "研究任务已取消"));
    const output = researchFixture(getResearchFixtureKey(input));
    const hash = stableResearchHash(input);
    return Promise.resolve(validateResearchProviderOutput({ ...output, understanding: `${output.understanding}｜研究批次 ${hash}` }));
  }
}
