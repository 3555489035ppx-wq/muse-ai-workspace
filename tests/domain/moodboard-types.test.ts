import assert from "node:assert/strict";
import test from "node:test";

import {
  isMoodboard,
  isMoodboardItem,
  isVisualDNA,
} from "../../src/domain/moodboard/index.js";

const id = (suffix: string): string =>
  `10000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const base = {
  projectId: id("1"),
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z",
};
const moodboard = {
  ...base,
  id: id("2"),
  researchSessionId: id("3"),
  title: "在地材料与当代秩序",
  status: "curated",
};
const item = {
  ...base,
  id: id("4"),
  moodboardId: moodboard.id,
  assetId: id("5"),
  role: "texture",
  position: 0,
};
const visualDNA = {
  ...base,
  id: id("6"),
  moodboardId: moodboard.id,
  keywords: ["克制", "在地"],
  colorPalette: [{ hex: "#853C29", role: "强调色" }],
  composition: ["大留白"],
  imagery: ["材料微距"],
};

void test("moodboard, item and required VisualDNA structures are valid", () => {
  assert.equal(isMoodboard(moodboard), true);
  assert.equal(isMoodboardItem(item), true);
  assert.equal(isVisualDNA(visualDNA), true);
  assert.equal(
    isVisualDNA({
      ...visualDNA,
      typography: ["现代黑体"],
      materials: ["岩石"],
    }),
    true,
  );
});

void test("moodboard guards reject invalid parents, roles and positions", () => {
  assert.equal(isMoodboard({ ...moodboard, researchSessionId: "bad" }), false);
  assert.equal(isMoodboardItem({ ...item, moodboardId: undefined }), false);
  assert.equal(isMoodboardItem({ ...item, assetId: "bad" }), false);
  assert.equal(isMoodboardItem({ ...item, role: "provider" }), false);
  assert.equal(isMoodboardItem({ ...item, position: -1 }), false);
});

void test("VisualDNA enforces required structure while optional fields stay optional", () => {
  assert.equal(isVisualDNA({ ...visualDNA, keywords: [] }), false);
  assert.equal(isVisualDNA({ ...visualDNA, colorPalette: [] }), false);
  assert.equal(
    isVisualDNA({ ...visualDNA, colorPalette: [{ hex: "red", role: "主色" }] }),
    false,
  );
  assert.equal(isVisualDNA({ ...visualDNA, composition: undefined }), false);
  assert.equal(isVisualDNA({ ...visualDNA, typography: [1] }), false);
});
