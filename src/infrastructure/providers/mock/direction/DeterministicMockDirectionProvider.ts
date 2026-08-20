import { DirectionProviderError, validateDirectionDifference, type DirectionCandidate, type DirectionProvider, type DirectionProviderInput, type DirectionProviderOutput } from "../../../../application/direction/index.js";
import { COFFEE_DIRECTIONS, GENERIC_DIRECTIONS, SHANXI_DIRECTIONS, type DirectionStrategyFixture } from "./fixtures.js";

function hash(text: string): number { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
function fixtureSet(input: DirectionProviderInput): readonly DirectionStrategyFixture[] {
  const corpus = `${input.brief.goal} ${input.brief.context} ${input.research.query} ${input.seed}`;
  if (/山西|文化遗产|文旅/.test(corpus)) return SHANXI_DIRECTIONS;
  if (/成都|咖啡|coffee/i.test(corpus)) return COFFEE_DIRECTIONS;
  const offset = hash(corpus) % GENERIC_DIRECTIONS.length;
  return [...GENERIC_DIRECTIONS.slice(offset), ...GENERIC_DIRECTIONS.slice(0, offset)];
}

export class DeterministicMockDirectionProvider implements DirectionProvider {
  async generate(input: DirectionProviderInput): Promise<DirectionProviderOutput> {
    await Promise.resolve();
    if (input.signal?.aborted) throw new DirectionProviderError("CANCELLED", "Direction generation was cancelled.");
    if (input.assets.length < 3) throw new DirectionProviderError("PROVIDER_FAILURE", "Direction generation requires at least three source assets.");
    const output = fixtureSet(input).map((fixture, index): DirectionCandidate => {
      const asset = input.assets[index];
      if (asset === undefined) throw new DirectionProviderError("PROVIDER_FAILURE", "Direction source asset is missing.");
      return { key: `direction-${String(index + 1)}`, ...fixture, heroAssetId: asset.id, references: [{ assetId: asset.id, role: "inspiration" }], status: "candidate", researchSessionId: input.research.id, moodboardId: input.moodboard.id, visualDNAId: input.visualDNA.id, creativeSeedIds: input.seeds.map((item) => item.id), opportunityIds: input.opportunities.map((item) => item.id) };
    });
    validateDirectionDifference(output);
    return { directions: output };
  }
}
