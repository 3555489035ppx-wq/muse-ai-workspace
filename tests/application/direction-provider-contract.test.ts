import assert from "node:assert/strict";
import test from "node:test";
import { validateDirectionProviderOutput, type DirectionCandidate, type DirectionProviderInput } from "../../src/application/direction/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";

const id = (value: number) => asEntityId(`${String(value).padStart(8, "0")}-0000-4000-8000-000000000001`);
const base = { id: id(1), projectId: asProjectId(id(2)), createdAt: requireIsoTimestamp("2026-07-28T00:00:00.000Z"), updatedAt: requireIsoTimestamp("2026-07-28T00:00:00.000Z") } as const;
const input = {
  brief: { ...base, goal: "目标", audience: "受众", context: "语境", deliverables: ["海报"], constraints: [] },
  research: { ...base, id: id(3), briefId: base.id, query: "山西文化", status: "completed" },
  opportunities: [{ ...base, id: id(4), researchSessionId: id(3), insightIds: [id(5)], statement: "机会" }],
  seeds: [{ ...base, id: id(6), researchSessionId: id(3), opportunityIds: [id(4)], title: "种子", premise: "前提" }],
  moodboard: { ...base, id: id(7), researchSessionId: id(3), title: "情绪板", status: "curated" },
  visualDNA: { ...base, id: id(8), moodboardId: id(7), keywords: ["文化"], colorPalette: [{ hex: "#111111", role: "主色" }], composition: ["留白"], imagery: ["文物"] },
  assets: [{ id: id(9), createdAt: base.createdAt, updatedAt: base.updatedAt, name: "hero", type: "image", mimeType: "image/png", byteSize: 1, storageKey: "fixture/hero", status: "ready" }],
  constraints: [], seed: "stable",
} satisfies DirectionProviderInput;

function candidate(index: number): DirectionCandidate {
  const label = String(index);
  return { key: `d-${label}`, title: `方向${label}`, concept: `概念${label}`, narrative: `叙事${label}`, keywords: [`词${label}`], axisValues: { composition: `构图${label}`, typography: `字体${label}`, color: `色彩${label}`, image: `图像${label}`, material: `材质${label}` }, heroAssetId: id(9), references: [{ assetId: id(9), role: "inspiration" }], advantages: ["优势"], risks: ["风险"], status: "candidate", researchSessionId: id(3), moodboardId: id(7), visualDNAId: id(8), creativeSeedIds: [id(6)], opportunityIds: [id(4)] };
}

void test("DirectionProvider contract accepts exactly three candidates with complete provenance", () => {
  assert.equal(validateDirectionProviderOutput({ directions: [candidate(1), candidate(2), candidate(3)] }, input).directions.length, 3);
});

void test("DirectionProvider contract rejects count and provenance violations", () => {
  assert.throws(() => validateDirectionProviderOutput({ directions: [candidate(1)] }, input), /invalid provenance/i);
  assert.throws(() => validateDirectionProviderOutput({ directions: [candidate(1), { ...candidate(2), moodboardId: id(10) }, candidate(3)] }, input), /invalid provenance/i);
});
