import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MoodboardItem } from "../../src/domain/moodboard/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { MoodboardGrid, calculateMoodboardLayout } from "../../src/features/moodboard/MoodboardGrid.js";

void test("5, 20 and 50 items grow rows while preserving readable card width", () => {
  const five = calculateMoodboardLayout(5, 1200); const twenty = calculateMoodboardLayout(20, 1200); const fifty = calculateMoodboardLayout(50, 1200);
  assert.equal(five.cardWidth >= 240, true); assert.equal(twenty.cardWidth >= 240, true); assert.equal(fifty.cardWidth >= 240, true);
  assert.equal(five.columns, twenty.columns); assert.equal(twenty.columns, fifty.columns); assert.equal(five.rows < twenty.rows && twenty.rows < fifty.rows, true);
  assert.equal(fifty.overflowsHorizontally, false);
});
void test("narrow layout remains one readable column without horizontal overflow", () => { const layout = calculateMoodboardLayout(50, 320); assert.equal(layout.columns, 1); assert.equal(layout.cardWidth, 320); assert.equal(layout.overflowsHorizontally, false); });
void test("MoodboardGrid renders one readable card per entity instead of a thumbnail strip", () => {
  const time = requireIsoTimestamp("2026-07-28T20:00:00.000Z"); const projectId = asProjectId("35000000-0000-4000-8000-000000000001");
  const items = Array.from({ length: 5 }, (_, index): MoodboardItem => ({ id: asEntityId(`35000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`), projectId, moodboardId: asEntityId("35000000-0000-4000-8000-000000000002"), assetId: asEntityId(`35000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`), role: "reference", position: index, createdAt: time, updatedAt: time }));
  const html = renderToStaticMarkup(createElement(MoodboardGrid, { items: items.map((item) => ({ item })) })); assert.equal((html.match(/moodboard-grid__card/g) ?? []).length, 5); assert.match(html, /素材缺失/);
});
