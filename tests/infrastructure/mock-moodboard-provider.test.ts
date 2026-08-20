import assert from "node:assert/strict";
import test from "node:test";
import type { CreativeSeed, ResearchSession } from "../../src/domain/research/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { DeterministicMockMoodboardProvider } from "../../src/infrastructure/providers/mock/moodboard/index.js";

const time = requireIsoTimestamp("2026-07-28T18:00:00.000Z");
const projectId = asProjectId("33000000-0000-4000-8000-000000000001");
const id = (value: number) => asEntityId(`33000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
const research = (query: string): ResearchSession => ({ id: id(1), projectId, briefId: id(2), query, status: "completed", createdAt: time, updatedAt: time });
const seed = (title: string): CreativeSeed => ({ id: id(3), projectId, researchSessionId: id(1), opportunityIds: [id(4)], title, premise: title, createdAt: time, updatedAt: time });
const input = (query: string, title: string) => ({ research: research(query), insights: [], opportunities: [], seeds: [seed(title)], availableAssetIds: [id(10), id(11), id(12), id(13)], seed: "fixed" });

void test("moodboard mock is deterministic with internally coherent distinct territories", async () => {
  const provider = new DeterministicMockMoodboardProvider();
  const first = await provider.generate(input("山西文化遗产", "文明仍在现场"));
  const second = await provider.generate(input("山西文化遗产", "文明仍在现场"));
  assert.deepEqual(first, second);
  assert.equal(first.territories.length, 3);
  assert.equal(new Set(first.territories.flatMap((item) => item.assetRefs)).size, 3);
  assert.equal(new Set(first.territories.map((item) => item.visualDNA.colorPalette.map((color) => color.hex).join("|"))).size, 3);
  assert.equal(new Set(first.territories.map((item) => item.visualDNA.composition.join("|"))).size, 3);
  assert.equal(new Set(first.territories.map((item) => item.visualDNA.materials.join("|"))).size, 3);
});

void test("Shanxi, coffee and fallback territories are case-specific", async () => {
  const provider = new DeterministicMockMoodboardProvider();
  const shanxi = await provider.generate(input("山西文化遗产", "文明"));
  const coffee = await provider.generate(input("成都独立咖啡", "街角慢萃"));
  const fallback = await provider.generate(input("校园活动", "清晰信号"));
  assert.deepEqual(shanxi.territories.map((item) => item.name), ["档案新编", "文明现场", "东方编辑"]);
  assert.deepEqual(coffee.territories.map((item) => item.name), ["日常温度", "街头编辑", "材料手作"]);
  assert.equal(fallback.territories.length, 2);
  assert.notDeepEqual(shanxi.territories.map((item) => item.visualDNA.imagery), coffee.territories.map((item) => item.visualDNA.imagery));
});
