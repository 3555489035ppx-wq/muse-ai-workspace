import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { NewProjectPage, ProjectCreationFormError, submitProjectCreation, submitProjectCreationAndHydrate, validateProjectCreationForm } from "../../src/features/projects/NewProjectPage.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";

void test("project form exposes Chinese labels and native keyboard submit semantics", () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/projects/new"] }, createElement(NewProjectPage)));
  assert.match(html, /创建创意项目/);
  assert.match(html, /项目名称/);
  assert.match(html, /type="submit"/);
});

void test("project form reports field validation before persistence", async () => {
  const errors = validateProjectCreationForm({ name: "", description: "短", projectType: "brand", targetOutput: "brand_identity" });
  assert.ok(errors.name);
  assert.ok(errors.description);
  await assert.rejects(
    submitProjectCreation({ instantiate: () => Promise.resolve({ projectId: asProjectId("25000000-0000-4000-8000-000000000001"), briefId: asEntityId("25000000-0000-4000-8000-000000000002"), workflowState: "DRAFT" }) }, { name: "", description: "短", projectType: "brand", targetOutput: "brand_identity" }),
    ProjectCreationFormError,
  );
});

void test("project submit forwards template once and returns persisted identifiers", async () => {
  let calls = 0;
  const templateId = asEntityId("23000000-0000-4000-8000-000000000001");
  const result = await submitProjectCreation({ instantiate: (input) => {
    calls += 1;
    assert.equal(input.templateId, templateId);
    return Promise.resolve({ projectId: asProjectId("25000000-0000-4000-8000-000000000001"), briefId: asEntityId("25000000-0000-4000-8000-000000000002"), workflowState: "DRAFT", templateId });
  } }, { name: "山西项目", description: "建立面向年轻人的文化传播视觉系统", projectType: "editorial", targetOutput: "poster", templateId });
  assert.equal(calls, 1);
  assert.equal(result.templateId, templateId);
});

void test("project creation hydrates the runtime store before workspace navigation can read the project", async () => {
  const calls: string[] = [];
  const projectId = asProjectId("25000000-0000-4000-8000-000000000001");
  const result = await submitProjectCreationAndHydrate(
    {
      instantiate: () => {
        calls.push("persist");
        return Promise.resolve({
          projectId,
          briefId: asEntityId("25000000-0000-4000-8000-000000000002"),
          workflowState: "DRAFT",
        });
      },
    },
    {
      refresh: () => {
        calls.push("hydrate");
        return Promise.resolve();
      },
    },
    {
      name: "运行时验收项目",
      description: "验证模板建项后工作台可以立即读取刚刚持久化的项目。",
      projectType: "editorial",
      targetOutput: "poster",
    },
  );
  assert.equal(result.projectId, projectId);
  assert.deepEqual(calls, ["persist", "hydrate"]);
});
