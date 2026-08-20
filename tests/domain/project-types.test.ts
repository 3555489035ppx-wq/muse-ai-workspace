import assert from "node:assert/strict";
import test from "node:test";

import {
  isProject,
  isProjectBrief,
  type Project,
  type ProjectBrief,
} from "../../src/domain/project/index.js";
import { asProjectId, asEntityId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";

const projectId = asProjectId("8dd33cc4-6c0f-4f95-a6f7-52c64c24c021");
const briefId = asEntityId("cf356055-73dc-4d4e-9f07-ae19cd589487");
const timestamp = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

const project: Project = {
  id: projectId,
  name: "山西文化遗产年轻化视觉传播",
  outputTypes: ["brand_identity", "social_media"],
  schemaVersion: 4,
  settings: { locale: "zh-CN", timezone: "Asia/Shanghai" },
  stage: "brief",
  status: "active",
  type: "brand",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const brief: ProjectBrief = {
  id: briefId,
  projectId,
  goal: "建立面向年轻人的文化视觉方向",
  audience: "18–30 岁中国年轻受众",
  context: "文化遗产品牌传播",
  deliverables: ["视觉方向"],
  constraints: ["避免符号堆砌"],
  createdAt: timestamp,
  updatedAt: timestamp,
};

void test("Project and ProjectBrief guards accept the minimal valid shapes", () => {
  assert.equal(isProject(project), true);
  assert.equal(isProjectBrief(brief), true);
});

void test("Project guard rejects invalid UUID, timestamp, enum and nested chain data", () => {
  assert.equal(isProject({ ...project, id: "project-1" }), false);
  assert.equal(isProject({ ...project, updatedAt: "today" }), false);
  assert.equal(isProject({ ...project, stage: "generated" }), false);
  assert.equal(isProject({ ...project, outputTypes: ["unknown"] }), false);
  assert.equal(isProject({ ...project, brief: { goal: "nested" } }), false);
  assert.equal(isProject(null), false);
});

void test("ProjectBrief guard rejects missing parents and malformed minimum fields", () => {
  const withoutProject: Record<string, unknown> = { ...brief };
  Reflect.deleteProperty(withoutProject, "projectId");
  assert.equal(isProjectBrief(withoutProject), false);
  assert.equal(isProjectBrief({ ...brief, projectId: "bad" }), false);
  assert.equal(isProjectBrief({ ...brief, goal: "" }), false);
  assert.equal(isProjectBrief({ ...brief, deliverables: [1] }), false);
  assert.equal(isProjectBrief({ ...brief, constraints: "none" }), false);
});
