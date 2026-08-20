import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { TemplateCatalogRepository } from "../../src/application/template/index.js";
import { TemplatesPage } from "../../src/features/templates/TemplatesPage.js";

void test("template repository exposes eight structurally distinct creation strategies", () => {
  const templates = new TemplateCatalogRepository().list();
  assert.equal(templates.length, 8);
  assert.equal(new Set(templates.map((item) => item.briefPlaceholder)).size, 8);
  assert.equal(new Set(templates.map((item) => JSON.stringify(item.researchStrategy))).size, 8);
  assert.equal(new Set(templates.map((item) => JSON.stringify(item.moodboardStrategy))).size, 8);
  assert.equal(new Set(templates.map((item) => item.recommendedOutputs.join("|"))).size >= 5, true);
});

void test("template page renders repository records and uses template IDs in creation links", () => {
  const repository = new TemplateCatalogRepository();
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/templates"] }, createElement(TemplatesPage, { repository })));
  assert.match(html, /模板中心/);
  assert.match(html, /文化遗产活化/);
  assert.match(html, /品牌视觉系统/);
  for (const template of repository.list()) assert.match(html, new RegExp(`template=${template.id}`));
});
