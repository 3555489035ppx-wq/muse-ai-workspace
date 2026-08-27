import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createIndustrialPortfolioSeeds } from "../../src/data/industrialPortfolio.js";
import { createJinganbaoSeed } from "../../src/data/jinganbao.js";
import { enrichDemoProjectSeed, repairDemoIndustrialSelection } from "../../src/data/demoProjectSeed.js";
import { buildProjectBrain } from "../../src/services/ai/projectBrain.ts";
import {
  DEMO_PROJECT_IDS,
  DEMO_PROJECT_REGISTRY,
  getDemoProjectRegistryEntry,
} from "../../src/data/demoProjectRegistry.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function localAssetPath(assetUrl) {
  return path.join(repoRoot, "public", String(assetUrl).replace(/^\//, "").split("?")[0]);
}

function createEnrichedDemoProjects() {
  const jinganbao = createJinganbaoSeed();
  const portfolioProjects = createIndustrialPortfolioSeeds().map(({ project }) => project);
  return [
    enrichDemoProjectSeed(jinganbao.project, jinganbao.brief),
    ...portfolioProjects.map((project) => enrichDemoProjectSeed(project, project.industrial.brief)),
  ];
}

test("V4.2 registry contains only the four approved industrial demo projects", () => {
  assert.deepEqual(DEMO_PROJECT_IDS, [
    "f1000000-0000-4000-8000-000000000001",
    "f1000000-0000-4000-8000-000000000101",
    "f1000000-0000-4000-8000-000000000103",
    "f1000000-0000-4000-8000-000000000104",
  ]);
  assert.equal(DEMO_PROJECT_REGISTRY.length, 4);
  assert.equal(getDemoProjectRegistryEntry("f1000000-0000-4000-8000-000000000102"), null);
  assert.deepEqual(
    DEMO_PROJECT_REGISTRY.map((item) => item.id),
    DEMO_PROJECT_IDS,
  );
});

test("legacy demo data repairs missing workflow selections instead of showing empty gate pages", () => {
  const { project } = createJinganbaoSeed();
  const staleIndustrial = {
    ...project.industrial,
    selectedDirectionId: null,
    directionLocked: false,
    selectedConceptId: null,
    selectedCMFId: null,
    currentReviewId: null,
    selectedVisualId: null,
  };
  const repaired = repairDemoIndustrialSelection(staleIndustrial);
  assert.equal(repaired.directionLocked, true);
  assert.equal(repaired.selectedDirectionId, project.industrial.directions[0].id);
  assert.equal(repaired.selectedConceptId, project.industrial.conceptCandidates[0].id);
  assert.equal(repaired.selectedCMFId, project.industrial.cmfSchemes[0].id);
  assert.equal(repaired.currentReviewId, project.industrial.reviews[0].id);
  assert.ok(repaired.selectedVisualId);
});

test("each V4.2 demo project has a complete traceable workflow and local visual set", () => {
  const projects = createEnrichedDemoProjects();
  assert.deepEqual(
    projects.map((project) => project.id).sort(),
    [...DEMO_PROJECT_IDS].sort(),
  );

  const projectImagePaths = new Map();
  for (const project of projects) {
    const industrial = project.industrial;
    const registryEntry = getDemoProjectRegistryEntry(project.id);
    assert.ok(registryEntry, `${project.id} is missing from demo registry`);
    assert.equal(project.demoPortfolioReady, true);
    assert.equal(industrial.demoPortfolioReady, true);
    assert.equal(industrial.visualMode, "demo-asset");
    assert.ok(project.projectOverview?.projectSummary, `${project.name} overview is missing`);
    assert.equal(project.designBrief?.status, "confirmed", `${project.name} brief is not confirmed`);
    assert.ok(project.researchWorkspace?.evidence?.length >= 5, `${project.name} research workspace is incomplete`);
    assert.ok(project.researchWorkspace.evidence.every((item) => item.traceableSource), `${project.name} has untraceable seed evidence`);

    assert.equal(industrial.evidence.length, 5, `${project.name} evidence count changed`);
    assert.equal(industrial.insights.length, 5, `${project.name} insight count changed`);
    assert.equal(industrial.directions.length, 3, `${project.name} direction count changed`);
    assert.equal(industrial.conceptCandidates.length, 9, `${project.name} concept count changed`);
    assert.equal(industrial.cmfSchemes.length, 3, `${project.name} CMF count changed`);
    assert.equal(industrial.versionStory.length, 3, `${project.name} version count changed`);
    assert.ok(industrial.reviews?.length >= 1, `${project.name} review is missing`);
    for (const stage of ["research", "insight", "direction", "concept", "cmf", "review", "versions", "decision-map"]) {
      assert.ok(industrial.completedStages.includes(stage), `${project.name} is missing completed stage ${stage}`);
    }
    assert.equal(industrial.directions.some((item) => item.id === industrial.selectedDirectionId), true);
    assert.equal(industrial.conceptCandidates.some((item) => item.id === industrial.selectedConceptId), true);
    assert.equal(industrial.cmfSchemes.some((item) => item.id === industrial.selectedCMFId), true);

    const visuals = industrial.demoVisuals ?? [];
    assert.ok(visuals.length >= 9, `${project.name} does not have enough demo visuals`);
    assert.ok(visuals.every((visual) => visual.projectId === project.id), `${project.name} has cross-project visual records`);
    assert.ok(visuals.every((visual) => visual.imageSource === "demo-asset" && visual.visualMode === "demo-asset"), `${project.name} has a misleading visual provider label`);
    assert.equal(new Set(visuals.map((visual) => visual.imagePath)).size, visuals.length, `${project.name} repeats a visual image path`);
    for (const visual of visuals) {
      assert.ok(visual.imagePath.startsWith(registryEntry.assetRoot), `${project.name} visual escaped its asset root: ${visual.imagePath}`);
      assert.equal(fs.existsSync(localAssetPath(visual.imagePath)), true, `${project.name} visual file is missing: ${visual.imagePath}`);
      assert.ok(visual.rationale && visual.visualDescription, `${project.name} visual is missing text linkage`);
      if (visual.stage === "concept") {
        const concept = industrial.conceptCandidates.find((item) => item.id === visual.conceptId);
        assert.ok(concept, `${project.name} concept visual has no concept relation`);
        assert.match(visual.rationale, new RegExp(concept.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
      if (visual.stage === "cmf") {
        const cmf = industrial.cmfSchemes.find((item) => item.id === visual.cmfId);
        assert.ok(cmf, `${project.name} CMF visual has no CMF relation`);
        assert.match(visual.rationale, new RegExp(cmf.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
    projectImagePaths.set(project.id, new Set(visuals.map((visual) => visual.imagePath)));
  }

  const allVisualPaths = projects.flatMap((project) => [...projectImagePaths.get(project.id)]);
  assert.equal(new Set(allVisualPaths).size, allVisualPaths.length, "demo projects share image assets");
});

test("demo insight confirmation follows the explicit selected subset", () => {
  const { project } = createJinganbaoSeed();
  const enriched = enrichDemoProjectSeed(project, project.industrial.brief);
  const brain = buildProjectBrain(enriched);
  assert.equal(enriched.designInsights.filter((item) => item.status === "confirmed").length, enriched.confirmedInsightIds.length);
  assert.deepEqual(
    brain.confirmedInsights.map((item) => item.id),
    enriched.confirmedInsightIds,
  );
});
