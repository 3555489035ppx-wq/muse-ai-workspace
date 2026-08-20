import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { asEntityId } from "../../src/domain/shared/id.js";
import { MoodboardLightbox, lightboxIndexForKey, returnMoodboardFocus } from "../../src/features/moodboard/MoodboardLightbox.js";
import { reduceMoodboardSelection } from "../../src/features/moodboard/useMoodboardSelection.js";

void test("lightbox keyboard navigation respects boundaries and Escape", () => { assert.equal(lightboxIndexForKey("ArrowLeft", 0, 3), 0); assert.equal(lightboxIndexForKey("ArrowRight", 2, 3), 2); assert.equal(lightboxIndexForKey("ArrowRight", 1, 3), 2); assert.equal(lightboxIndexForKey("Escape", 1, 3), "close"); });
void test("single and multi selection remain UI-only sets", () => { const a = asEntityId("37000000-0000-4000-8000-000000000001"); const b = asEntityId("37000000-0000-4000-8000-000000000002"); const single = reduceMoodboardSelection(new Set(), a, false); const multi = reduceMoodboardSelection(single, b, true); assert.deepEqual([...multi], [a, b]); assert.equal(reduceMoodboardSelection(multi, a, true).has(a), false); });
void test("lightbox handles missing asset and exposes accessible controls", () => { const html = renderToStaticMarkup(createElement(MoodboardLightbox, { assets: [undefined], activeIndex: 0, onChange: () => undefined, onClose: () => undefined })); assert.match(html, /role="dialog"/); assert.match(html, /素材缺失/); assert.match(html, /关闭预览/); });
void test("focus return invokes the captured focus target", () => { let focused = false; returnMoodboardFocus({ focus: () => { focused = true; } }); assert.equal(focused, true); });
