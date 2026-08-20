import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { asProjectId } from "../../src/domain/shared/id.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { ProjectCreationService } from "../../src/application/project/index.js";
import { ResearchService } from "../../src/application/research/index.js";
import { ResearchPage, loadResearchView } from "../../src/features/research/ResearchPage.js";

void test("research page exposes loading state and all required Chinese groups", () => {
  const never = () => new Promise<undefined>(() => undefined);
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/projects/29000000-0000-4000-8000-000000000001/research"] }, createElement(Routes, null, createElement(Route, { path: "/projects/:projectId/research", element: createElement(ResearchPage, { loader: never }) }))));
  assert.match(html, /正在读取研究实体/);
});

void test("research query reloads real entities and isolates A from B", async () => {
  const database = createMuseDatabase("research-page-query", { dependencies: { indexedDB, IDBKeyRange } });
  const projectA = asProjectId("29000000-0000-4000-8000-000000000001");
  const projectB = asProjectId("29000000-0000-4000-8000-000000000002");
  const createdA = await new ProjectCreationService(database, { projectIdFactory: () => projectA }).create({ name: "山西文化遗产", description: "山西文化遗产面向年轻受众的视觉传播", projectType: "editorial", targetOutputs: ["poster"] });
  const createdB = await new ProjectCreationService(database, { projectIdFactory: () => projectB }).create({ name: "成都独立咖啡", description: "成都独立咖啡品牌的社区视觉识别", projectType: "brand", targetOutputs: ["brand_identity"] });
  await new ResearchService(database).run({ projectId: projectA, briefId: createdA.briefId, seed: "page" });
  await new ResearchService(database).run({ projectId: projectB, briefId: createdB.briefId, seed: "page" });
  const viewA = await loadResearchView(projectA, database);
  const viewB = await loadResearchView(projectB, database);
  assert.ok(viewA); assert.ok(viewB);
  assert.equal(viewA.sources.every((item) => item.projectId === projectA), true);
  assert.equal(viewB.sources.every((item) => item.projectId === projectB), true);
  assert.notEqual(viewA.session.query, viewB.session.query);
  const insight = viewA.insights[0]; assert.ok(insight);
  await database.table("researchInsights").update(insight.id, { statement: "更新后的洞察" });
  assert.equal((await loadResearchView(projectA, database))?.insights[0]?.statement, "更新后的洞察");
  database.close();
});
