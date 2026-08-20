import type { ResearchProviderInput, ResearchProviderOutput } from "./contracts.js";

export interface ResearchProvider {
  research(input: ResearchProviderInput): Promise<ResearchProviderOutput>;
}
