import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredRoles = [
  "hero",
  "page-title",
  "section-title",
  "card-title",
  "body",
  "secondary",
  "metadata",
  "label",
  "control",
  "navigation",
  "inspector",
  "canvas-node",
] as const;

void test("P2-T02 defines the complete Muse typography role scale", async () => {
  const tokens = await readFile(new URL("../../tokens.css", import.meta.url), "utf8");
  for (const role of requiredRoles) {
    assert.match(tokens, new RegExp(`--muse-type-${role}:`), role);
  }
  assert.match(tokens, /--muse-type-body:\s*15px/);
  assert.match(tokens, /--muse-type-secondary:\s*14px/);
  assert.match(tokens, /--muse-type-metadata:\s*12px/);
});

void test("P2-T02 applies readable roles to navigation, controls and canvas text", async () => {
  const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.sidebar__nav a,[\s\S]*var\(--muse-type-navigation\)/);
  assert.match(styles, /\.button,[\s\S]*var\(--muse-type-control\)/);
  assert.match(styles, /\.canvas-node,[\s\S]*var\(--muse-type-canvas-node\)/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /text-wrap:\s*pretty/);
});
