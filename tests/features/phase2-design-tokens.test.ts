import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredColorRoles = [
  "--muse-canvas",
  "--muse-surface",
  "--muse-surface-raised",
  "--muse-text-primary",
  "--muse-text-secondary",
  "--muse-border",
  "--muse-accent",
  "--muse-focus",
  "--muse-success",
  "--muse-warning",
  "--muse-danger",
  "--muse-disabled-surface",
  "--muse-disabled-text",
] as const;

void test("P2-T01 exposes the complete semantic color contract", async () => {
  const tokens = await readFile(new URL("../../tokens.css", import.meta.url), "utf8");
  for (const role of requiredColorRoles) {
    assert.match(tokens, new RegExp(`${role.replaceAll("-", "\\-")}\\s*:`), role);
  }
  assert.match(tokens, /--muse-accent:\s*var\(--muse-cosmic-dust\)/);
  assert.match(tokens, /--muse-warning-surface:/);
  assert.match(tokens, /--muse-danger-surface:/);
});

void test("P2-T01 binds global canvas, text, selection and focus to semantic roles", async () => {
  const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /background:\s*var\(--muse-canvas-subtle\)/);
  assert.match(styles, /color:\s*var\(--muse-text-primary\)/);
  assert.match(styles, /::selection\s*\{[^}]*var\(--muse-selection\)/s);
  assert.match(styles, /:focus-visible\s*\{[^}]*var\(--muse-focus\)/s);
  assert.match(styles, /input,\s*textarea,\s*select\s*\{[^}]*var\(--muse-surface\)/s);
  assert.match(styles, /input:disabled[^}]*var\(--muse-disabled-surface\)/s);
});
