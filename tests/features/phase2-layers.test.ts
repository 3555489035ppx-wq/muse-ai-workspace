import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const tokens = await readFile(new URL("../../tokens.css", import.meta.url), "utf8");
const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../../src/components/ui.jsx", import.meta.url), "utf8");

void test("P2-T05 defines the complete semantic layer order", () => {
  const roles = ["base", "sticky", "dropdown", "popover", "inspector", "overlay", "modal", "toast", "tour"];
  const values = roles.map((role) => {
    const match = new RegExp(`--muse-layer-${role}:\\s*(\\d+)`).exec(tokens);
    assert.ok(match, `missing ${role} layer`);
    return Number(match[1]);
  });
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(new Set(values).size, values.length);
});

void test("P2-T05 portals modal content and makes the app background inert", () => {
  assert.match(ui, /createPortal\(/);
  assert.match(ui, /setAttribute\('inert', ''\)/);
  assert.match(ui, /aria-modal="true"/);
  assert.match(styles, /z-index:\s*var\(--muse-layer-modal\)/);
  assert.match(styles, /z-index:\s*var\(--muse-layer-tour\)/);
});
