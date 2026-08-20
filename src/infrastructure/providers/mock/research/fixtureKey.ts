import type { ResearchProviderInput } from "../../../../application/research/index.js";

export type ResearchFixtureKey = "shanxi_heritage" | "chengdu_coffee" | "generic";

export function stableResearchHash(input: ResearchProviderInput): string {
  const value = [input.context.projectName, input.brief.goal, input.brief.audience, input.brief.context, input.seed].join("|");
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getResearchFixtureKey(input: ResearchProviderInput): ResearchFixtureKey {
  const text = `${input.context.projectName} ${input.brief.goal} ${input.brief.context}`.toLowerCase();
  if (/山西|文化遗产|非遗|文旅/.test(text)) return "shanxi_heritage";
  if (/成都|咖啡|coffee|独立品牌/.test(text)) return "chengdu_coffee";
  return "generic";
}
