import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const tokens = await readFile(new URL("../../tokens.css", import.meta.url), "utf8");
const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");

void test("P2-T03 defines semantic density, sizing and content width tokens", () => {
  for (const token of [
    "--muse-density-compact-y",
    "--muse-density-default-y",
    "--muse-density-comfortable-y",
    "--muse-control-height-default",
    "--muse-hit-target",
    "--muse-content-narrow",
    "--muse-content-default",
    "--muse-content-wide",
    "--muse-page-gutter",
  ]) {
    assert.match(tokens, new RegExp(`${token}:`));
  }
});

void test("P2-T03 protects touch targets, wrapping and responsive gutters", () => {
  assert.match(styles, /min-height:\s*var\(--muse-control-height-default\)/);
  assert.match(styles, /min-width:\s*var\(--muse-hit-target\)/);
  assert.match(styles, /textarea[\s\S]*height:\s*auto/);
  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /--muse-page-gutter:\s*12px/);
});
