import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectBrief } from "../../src/domain/project/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { DeterministicMockResearchProvider } from "../../src/infrastructure/providers/mock/research/index.js";

const provider = new DeterministicMockResearchProvider();
const brief = (name: string): ProjectBrief => ({ id: asEntityId("27000000-0000-4000-8000-000000000001"), projectId: asProjectId("27000000-0000-4000-8000-000000000002"), goal: name, audience: "18—30 岁设计关注者", context: name, deliverables: ["视觉方向"], constraints: ["待核验"], createdAt: requireIsoTimestamp("2026-07-28T15:00:00.000Z"), updatedAt: requireIsoTimestamp("2026-07-28T15:00:00.000Z") });
const input = (name: string, seed = "phase-1") => ({ brief: brief(name), context: { projectName: name, projectType: "brand" as const, locale: "zh-CN" as const }, seed });

void test("mock research is deeply deterministic for the same input", async () => {
  assert.deepEqual(await provider.research(input("山西文化遗产年轻化")), await provider.research(input("山西文化遗产年轻化")));
});

void test("Shanxi, Chengdu coffee and generic fixtures differ semantically and structurally", async () => {
  const shanxi = await provider.research(input("山西文化遗产年轻化"));
  const coffee = await provider.research(input("成都独立咖啡品牌"));
  const generic = await provider.research(input("校园活动视觉"));
  assert.match(shanxi.understanding, /山西文化遗产/);
  assert.match(coffee.understanding, /成都独立咖啡/);
  assert.match(generic.understanding, /目标、受众/);
  assert.notDeepEqual(shanxi.sources, coffee.sources);
  assert.notDeepEqual(shanxi.observations.map((item) => item.category), coffee.observations.map((item) => item.category));
  assert.equal(JSON.stringify(shanxi).includes("http"), false);
});

void test("seed/input changes deterministic batch identity without random output", async () => {
  const first = await provider.research(input("山西文化遗产年轻化", "one"));
  const second = await provider.research(input("山西文化遗产年轻化", "two"));
  assert.notEqual(first.understanding, second.understanding);
  assert.deepEqual(first.sources, second.sources);
});

void test("already aborted research follows cancellation contract", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(provider.research({ ...input("通用项目"), signal: controller.signal }), /取消/);
});
