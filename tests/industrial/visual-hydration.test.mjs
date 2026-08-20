import assert from "node:assert/strict";
import test from "node:test";
import { createIndustrialDraftState } from "../../src/data/industrialDraft.js";
import { hydrateIndustrialVisuals } from "../../src/lib/ai/industrialVisuals.js";

test("V4 keeps research through direction image-free and does not fabricate concept visuals", () => {
  const project = { id: "project-visual-test", name: "夜间静音照明", description: "为夜间起身用户设计低干扰照明。" };
  const industrial = createIndustrialDraftState({ project, sourceBrief: { goal: project.description, audience: "夜间起身用户", context: "卧室与走廊之间", constraints: ["单手操作"] } });
  const hydrated = hydrateIndustrialVisuals(project, industrial);
  for (const collection of [hydrated.evidence, hydrated.insights, hydrated.directions, hydrated.conceptCandidates, hydrated.cmfSchemes]) {
    assert.ok(collection.every((item) => item.image === null && item.imageSource === "not-generated"));
  }
  assert.deepEqual(hydrated.generatedVisuals, []);
});

test("V4 removes legacy local SVGs but preserves traceable provider images", () => {
  const project = { id: "project-visual-migrate", name: "视觉迁移" };
  const industrial = createIndustrialDraftState({ project, sourceBrief: { goal: "验证真实生成边界" } });
  const liveUrl = "/api/ai/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
  const legacy = {
    ...industrial,
    concepts: industrial.conceptCandidates.map((item, index) => ({ ...item, title: item.name, image: index === 0 ? liveUrl : "data:image/svg+xml,legacy", imageSource: index === 0 ? "live-ai" : "local-schematic" })),
    generatedVisuals: [{ id: "v1", imageUrl: liveUrl, provider: "openai-image", model: "gpt-image-2", conceptId: industrial.conceptCandidates[0].id }],
  };
  const hydrated = hydrateIndustrialVisuals(project, legacy);
  assert.equal(hydrated.conceptCandidates[0].image, liveUrl);
  assert.equal(hydrated.conceptCandidates[1].image, null);
  assert.equal(hydrated.generatedVisuals.length, 1);
});
