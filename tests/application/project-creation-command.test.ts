import assert from "node:assert/strict";
import test from "node:test";
import {
  ProjectCreationValidationError,
  validateCreateProjectInput,
} from "../../src/application/project/index.js";

void test("project creation command normalizes a valid user intent", () => {
  const command = validateCreateProjectInput({
    name: "  山西文化遗产年轻化  ",
    description: "  面向年轻用户的文化传播项目  ",
    projectType: "campaign",
    targetOutputs: ["poster", "social_media"],
    templateId: "21000000-0000-4000-8000-000000000001",
    constraints: [" 保留历史力量 ", "避免轻浮"],
    references: [" https://example.test/reference "],
  });

  assert.deepEqual(command, {
    name: "山西文化遗产年轻化",
    description: "面向年轻用户的文化传播项目",
    projectType: "campaign",
    targetOutputs: ["poster", "social_media"],
    templateId: "21000000-0000-4000-8000-000000000001",
    constraints: ["保留历史力量", "避免轻浮"],
    references: ["https://example.test/reference"],
  });
});

void test("project creation command rejects empty names and descriptions", () => {
  for (const field of ["name", "description"] as const) {
    assert.throws(
      () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["brand_identity"], [field]: "   " }),
      (error: unknown) => error instanceof ProjectCreationValidationError && error.context.field === field,
    );
  }
});

void test("project creation command rejects unsupported project types and outputs", () => {
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "unknown", targetOutputs: ["poster"] }),
    ProjectCreationValidationError,
  );
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["video"] }),
    ProjectCreationValidationError,
  );
});

void test("project creation command rejects empty or duplicate arrays", () => {
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: [] }),
    ProjectCreationValidationError,
  );
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["poster", "poster"] }),
    ProjectCreationValidationError,
  );
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["poster"], constraints: ["相同", " 相同 "] }),
    ProjectCreationValidationError,
  );
});

void test("project creation command rejects unknown fields and invalid optional values", () => {
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["poster"], status: "active" }),
    (error: unknown) => error instanceof ProjectCreationValidationError && error.context.field === "status",
  );
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["poster"], templateId: "template-1" }),
    ProjectCreationValidationError,
  );
  assert.throws(
    () => validateCreateProjectInput({ name: "项目", description: "说明", projectType: "brand", targetOutputs: ["poster"], references: [""] }),
    ProjectCreationValidationError,
  );
});
