import assert from "node:assert/strict";
import test from "node:test";
import { phase2DemoAssets } from "../../src/db/phase2DemoAssets.js";
import { filterProjects, projectDestination, projectProgress } from "../../src/features/projects/ProjectPages.jsx";

void test("P2 asset catalog exposes 50 deterministic licensed local records", () => {
  assert.equal(phase2DemoAssets.length, 50);
  assert.equal(new Set(phase2DemoAssets.map((asset) => asset.id)).size, 50);
  for (const asset of phase2DemoAssets) {
    assert.match(asset.id, /^[0-9a-f-]{36}$/i);
    assert.match(asset.url, /^\/assets\/templates\/.+\.webp$/);
    assert.ok(asset.source.length > 0);
    assert.ok(asset.license.length > 0);
    assert.ok(asset.tags.length >= 3);
  }
});

void test("P2 project grid and list share search, stage and route behavior", () => {
  const records = [
    { id: "a", name: "山西文化遗产", stage: "research", progress: 18 },
    { id: "b", name: "成都独立咖啡", stage: "directions", progress: 52 },
  ];
  assert.deepEqual(filterProjects(records, "成都", "all"), [records[1]]);
  assert.deepEqual(filterProjects(records, "", "research"), [records[0]]);
  assert.equal(projectDestination(records[0]), "/projects/a/workspace");
  assert.equal(projectProgress({ ...records[1], progress: undefined }), 58);
});
