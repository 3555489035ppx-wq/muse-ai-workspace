import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createJinganbaoSeed } from "../../src/data/jinganbao.js";
import { createIndustrialPortfolioSeeds } from "../../src/data/industrialPortfolio.js";

test("industrial portfolio seeds contain four distinct, available cover images", () => {
  const jinganbao = createJinganbaoSeed();
  const seeds = [{ project: jinganbao.project, asset: jinganbao.assets[0] }, ...createIndustrialPortfolioSeeds()];
  const urls = seeds.map(({ project }) => project.coverImage);
  const ids = seeds.flatMap(({ project, asset }) => [project.id, asset.id, project.industrial.currentVersionId]);
  const workflowImages = seeds.flatMap(({ project }) => [
    project.coverImage,
    ...project.industrial.evidence.map((item) => item.image),
    ...project.industrial.insights.map((item) => item.image),
    ...project.industrial.directions.map((item) => item.image),
    ...project.industrial.conceptCandidates.map((item) => item.image),
    ...project.industrial.cmfSchemes.map((item) => item.image),
    ...project.industrial.versionStory.map((item) => item.image),
  ]);

  assert.equal(seeds.length, 4);
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(workflowImages.length, 116);
  assert.equal(new Set(workflowImages).size, workflowImages.length);
  for (const url of urls) assert.equal(fs.existsSync(path.resolve("public", `.${url}`)), true);
  for (const url of workflowImages) assert.equal(fs.existsSync(path.resolve("public", `.${url}`)), true);
  for (const { project } of seeds) {
    assert.equal(project.industrial.evidence.length, 5);
    assert.equal(project.industrial.insights.length, 5);
    assert.equal(project.industrial.directions.length, 3);
    assert.equal(project.industrial.conceptCandidates.length, 9);
    assert.equal(project.industrial.cmfSchemes.length, 3);
    assert.equal(project.industrial.versionStory.length, 3);
  }
});
