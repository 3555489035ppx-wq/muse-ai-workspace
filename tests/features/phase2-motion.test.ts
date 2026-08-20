import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const tokens = await readFile(new URL("../../tokens.css", import.meta.url), "utf8");
const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../../src/components/ui.jsx", import.meta.url), "utf8");

void test("P2-T04 defines intent-specific motion tokens", () => {
  for (const token of [
    "--muse-duration-fast",
    "--muse-duration-panel",
    "--muse-duration-modal",
    "--muse-ease-enter",
    "--muse-ease-exit",
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
});

void test("P2-T04 reduces nonessential motion and keeps operation state semantic", () => {
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(styles, /transition-duration:\s*0\.01ms\s*!important/);
  assert.match(ui, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(ui, /data-state=\{job\.status\}/);
});
