import assert from "node:assert/strict";
import test from "node:test";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { submitProjectCreation } from "../../src/features/projects/NewProjectPage.js";

void test("rich project intent reaches the persisted project creation command", async () => {
  let received: Record<string, unknown> | undefined;
  await submitProjectCreation({
    instantiate: (input) => {
      received = input as unknown as Record<string, unknown>;
      return Promise.resolve({
        projectId: asProjectId("26000000-0000-4000-8000-000000000001"),
        briefId: asEntityId("26000000-0000-4000-8000-000000000002"),
        workflowState: "DRAFT" as const,
      });
    },
  }, {
    name: "夜间静音照明设备",
    description: "为夜间起身且不希望打扰家人的用户设计一款低干扰照明设备。",
    audience: "夜间起身的居家用户",
    background: "卧室与走廊之间，用户需要快速找到方向并恢复安静状态。",
    deliverables: "研究证据, 三条设计方向, 产品概念图",
    constraints: "单手操作, 低亮度, 易清洁",
    keywords: "克制, 可靠, 温和",
    avoid: "高频提示, 复杂菜单, 廉价塑料感",
    projectType: "ui",
    targetOutput: "digital_experience",
  });

  assert.ok(received);
  assert.equal(received.audience, "夜间起身的居家用户");
  assert.equal(received.context, "卧室与走廊之间，用户需要快速找到方向并恢复安静状态。");
  assert.deepEqual(received.deliverables, ["研究证据", "三条设计方向", "产品概念图"]);
  assert.deepEqual(received.constraints, ["单手操作", "低亮度", "易清洁"]);
  assert.deepEqual(received.keywords, ["克制", "可靠", "温和"]);
  assert.deepEqual(received.avoid, ["高频提示", "复杂菜单", "廉价塑料感"]);
});
