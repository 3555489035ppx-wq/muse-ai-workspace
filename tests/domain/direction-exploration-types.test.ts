import assert from "node:assert/strict";
import test from "node:test";

import {
  isDirection,
  isDirectionReference,
  isDirectionScore,
} from "../../src/domain/direction/index.js";
import {
  isExploration,
  isExplorationVariant,
} from "../../src/domain/exploration/index.js";

const id = (suffix: string): string =>
  `20000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const base = {
  projectId: id("1"),
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z",
};
const direction = {
  ...base,
  id: id("2"),
  researchSessionId: id("3"),
  moodboardId: id("4"),
  visualDNAId: id("5"),
  creativeSeedIds: [id("6")],
  opportunityIds: [id("18")],
  title: "东方极简",
  concept: "以材料与留白形成文化识别",
  narrative: "从历史材料走向当代表达",
  visualDNA: { keywords: ["克制"], principles: ["大留白"] },
  advantages: ["文化关联清晰"],
  risks: ["避免过度复古"],
  status: "candidate",
};
const exploration = {
  ...base,
  id: id("9"),
  directionId: direction.id,
  visualDNAId: direction.visualDNAId,
  title: "版式探索",
  status: "draft",
};

void test("direction/reference/score guards accept explicit upstream IDs", () => {
  assert.equal(isDirection(direction), true);
  assert.equal(
    isDirectionReference({
      ...base,
      id: id("7"),
      directionId: direction.id,
      assetId: id("8"),
      role: "material",
    }),
    true,
  );
  assert.equal(
    isDirectionScore({
      ...base,
      id: id("10"),
      directionId: direction.id,
      dimension: "goal_alignment",
      value: 88,
      rationale: "与 brief 目标一致",
    }),
    true,
  );
});

void test("direction guards enforce statuses, parents and complete content", () => {
  assert.equal(isDirection({ ...direction, status: "approved" }), false);
  assert.equal(isDirection({ ...direction, moodboardId: "bad" }), false);
  assert.equal(isDirection({ ...direction, advantages: [] }), false);
  assert.equal(isDirection({ ...direction, visualDNA: { keywords: [] } }), false);
  assert.equal(
    isDirectionScore({ ...base, id: id("11"), directionId: direction.id, dimension: "coherence", value: 101, rationale: "bad" }),
    false,
  );
});

void test("exploration and variant guards keep project and upstream IDs explicit", () => {
  assert.equal(isExploration(exploration), true);
  const variant = {
    ...base,
    id: id("12"),
    explorationId: exploration.id,
    directionId: direction.id,
    visualDNAId: direction.visualDNAId,
    referenceIds: [id("7")],
    sourceAssetIds: [id("8")],
    label: "A1",
    status: "kept",
  };
  assert.equal(isExplorationVariant(variant), true);
  assert.equal(isExplorationVariant({ ...variant, explorationId: "bad" }), false);
  assert.equal(isExplorationVariant({ ...variant, status: "generated" }), false);
  assert.equal(isExploration({ ...exploration, projectId: "other" }), false);
});
