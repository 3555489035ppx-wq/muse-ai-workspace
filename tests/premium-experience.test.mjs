import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { templateCatalog } from "../src/data/catalog.js";
import { onboardingSteps } from "../src/features/onboarding/tourConfig.js";

test("product-design template catalog has focused category depth and metadata", () => {
  assert.equal(templateCatalog.length, 9);
  const counts = Object.groupBy(templateCatalog, (item) => item.categoryKey);
  assert.equal(counts.concept?.length, 2);
  assert.equal(counts.device?.length, 3);
  assert.equal(counts.scenario?.length, 2);
  assert.equal(counts.cmf?.length, 1);
  assert.equal(counts.portfolio?.length, 1);
  for (const template of templateCatalog) {
    assert.ok(template.id);
    assert.ok(template.name);
    assert.ok(template.category);
    assert.ok(template.description);
    assert.ok(template.cover);
    assert.ok(
      existsSync(new URL(`../public${template.cover}`, import.meta.url)),
      `missing template cover: ${template.cover}`,
    );
    assert.ok(template.bestFor.length > 0);
    assert.ok(template.defaults.deliverables.length > 0);
    assert.ok(template.defaults.keywords.length > 0);
  }
});

test("guided onboarding is a complete seven-step Chinese flow", () => {
  assert.equal(onboardingSteps.length, 7);
  assert.deepEqual(
    onboardingSteps.map((step) => step.key),
    ["home", "create", "brief", "research", "moodboard", "direction", "critique"],
  );
  for (const step of onboardingSteps) {
    assert.ok(step.title.length > 0 && step.title.length <= 18);
    assert.ok(step.content.length > 0 && step.content.length <= 70);
    assert.ok(step.target.startsWith("[data-tour="));
  }
});

test("premium visual contract includes dark autofill, focus and responsive safeguards", () => {
  const tokens = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(tokens, /color-scheme:\s*dark/);
  assert.match(tokens, /--muse-hit-target:\s*44px/);
  assert.match(styles, /:-webkit-autofill/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.ok(existsSync(new URL("../public/assets/brand/muse-logo.svg", import.meta.url)));
  assert.ok(existsSync(new URL("../public/assets/brand/muse-goddess-hero.webp", import.meta.url)));
  assert.ok(existsSync(new URL("../public/assets/brand/muse-goddess-hero-mobile.webp", import.meta.url)));
  for (const asset of ["symbol.svg", "wordmark.svg", "lockup-horizontal.svg", "favicon.svg"]) {
    assert.ok(existsSync(new URL(`../public/assets/brand/${asset}`, import.meta.url)), `missing brand asset: ${asset}`);
  }
  assert.equal(packageJson.dependencies["react-joyride"], "3.2.0");
  assert.equal(packageJson.dependencies["lucide-react"], "1.27.0");
});
