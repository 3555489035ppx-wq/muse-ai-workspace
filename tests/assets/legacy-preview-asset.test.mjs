import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const legacyPreviewPath = path.resolve(
  process.cwd(),
  "public/assets/demo/chunjian-hero.png",
);

void test("legacy demo asset preview remains available to the asset library", () => {
  assert.equal(existsSync(legacyPreviewPath), true);
  assert.ok(statSync(legacyPreviewPath).size > 0);
});
