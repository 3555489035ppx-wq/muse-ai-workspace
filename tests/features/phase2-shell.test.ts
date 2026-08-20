import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

void test("P2-T14 brand uses the restrained Muse wordmark and keeps the Projects destination", async () => {
  const shell = await readFile(new URL("../../src/components/shell.jsx", import.meta.url), "utf8");
  const wordmark = await readFile(new URL("../../public/assets/brand/muse-handwritten-wordmark.jpg", import.meta.url));
  assert.match(shell, /assets\/brand\/muse-handwritten-wordmark\.jpg/);
  assert.doesNotMatch(shell, /assets\/brand\/muse-logo\.svg/);
  assert.match(shell, /to="\/projects" aria-label="返回 Muse 项目首页"/);
  assert.ok(wordmark.byteLength > 0);
});

void test("P2-T15 shell keeps real navigation labels without a desktop collapse control", async () => {
  const shell = await readFile(new URL("../../src/components/shell.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(shell, /muse-nav-compact/);
  assert.doesNotMatch(shell, /PanelLeftClose/);
  for (const path of ["/projects", "/templates", "/assets", "/direction-library", "/settings", "/trash"]) {
    assert.match(shell, new RegExp(path.replaceAll("/", "\\/")));
  }
});

void test("P2-T16 desktop shell owns explicit inspector state and Escape behavior", async () => {
  const shell = await readFile(new URL("../../src/components/shell.jsx", import.meta.url), "utf8");
  assert.match(shell, /aria-label="项目辅助面板"/);
  assert.match(shell, /Escape/);
  assert.match(shell, /contextOpen/);
});
