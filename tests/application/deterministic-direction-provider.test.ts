import assert from "node:assert/strict";
import test from "node:test";
import { DirectionProviderError, validateDirectionDifference, type DirectionProviderInput } from "../../src/application/direction/index.js";
import { DeterministicMockDirectionProvider } from "../../src/infrastructure/providers/mock/direction/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";

const eid = (n: number) => asEntityId(`${String(n).padStart(8, "0")}-0000-4000-8000-000000000111`);
const now = requireIsoTimestamp("2026-07-28T00:00:00.000Z"); const projectId = asProjectId(eid(1));
function makeInput(query: string): DirectionProviderInput {
  const base = { projectId, createdAt: now, updatedAt: now };
  return { brief: { ...base, id: eid(2), goal: query, audience: "年轻人", context: query, deliverables: ["海报"], constraints: [] }, research: { ...base, id: eid(3), briefId: eid(2), query, status: "completed" }, opportunities: [{ ...base, id: eid(4), researchSessionId: eid(3), insightIds: [eid(5)], statement: "机会" }], seeds: [{ ...base, id: eid(6), researchSessionId: eid(3), opportunityIds: [eid(4)], title: "种子", premise: "前提" }], moodboard: { ...base, id: eid(7), researchSessionId: eid(3), title: "板", status: "curated" }, visualDNA: { ...base, id: eid(8), moodboardId: eid(7), keywords: ["证据"], colorPalette: [{ hex: "#111111", role: "主色" }], composition: ["网格"], imagery: ["纪实"] }, assets: [9, 10, 11].map((n) => ({ id: eid(n), createdAt: now, updatedAt: now, name: `asset-${String(n)}`, type: "image" as const, status: "ready" as const, mimeType: "image/png", byteSize: 1, storageKey: `fixture/${String(n)}` })), constraints: [], seed: "fixed" };
}

void test("deterministic direction provider is stable and passes difference validator", async () => {
  const provider = new DeterministicMockDirectionProvider(); const input = makeInput("山西文化遗产年轻化");
  const first = await provider.generate(input); const second = await provider.generate(input);
  assert.deepEqual(first, second); assert.equal(validateDirectionDifference(first.directions), first.directions);
  assert.equal(new Set(first.directions.map((item) => item.heroAssetId)).size, 3);
});

void test("Shanxi and coffee cases use different concepts instead of template sentences", async () => {
  const provider = new DeterministicMockDirectionProvider(); const shanxi = await provider.generate(makeInput("山西文化遗产")); const coffee = await provider.generate(makeInput("成都独立咖啡品牌"));
  assert.notDeepEqual(shanxi.directions.map((item) => item.concept), coffee.directions.map((item) => item.concept));
  assert.deepEqual(shanxi.directions.map((item) => item.title), ["档案新编", "文明现场", "东方编辑"]);
  assert.deepEqual(coffee.directions.map((item) => item.title), ["日常温度", "街头编辑", "材料手作"]);
});

void test("provider rejects missing assets and cancellation", async () => {
  const provider = new DeterministicMockDirectionProvider();
  await assert.rejects(provider.generate({ ...makeInput("generic"), assets: [] }), DirectionProviderError);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(provider.generate({ ...makeInput("generic"), signal: controller.signal }), DirectionProviderError);
});
