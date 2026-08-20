import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Project } from "../../src/domain/project/index.js";
import type { ResearchInsight } from "../../src/domain/research/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { AddEntityNodeCommand } from "../../src/application/canvas/index.js";

const time = requireIsoTimestamp("2026-07-28T17:00:00.000Z");
const projectA = asProjectId("30000000-0000-4000-8000-000000000001");
const projectB = asProjectId("30000000-0000-4000-8000-000000000002");
const id = (value: number) => asEntityId(`30000000-0000-4000-8000-${String(value).padStart(12, "0")}`);
const project = (projectId: typeof projectA): Project => ({ id: projectId, name: projectId, type: "brand", status: "active", stage: "research", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time });

void test("research entity command creates deterministic reference-only node and handles duplicate", async () => {
  const database = createMuseDatabase("add-research-node", { dependencies: { indexedDB, IDBKeyRange } });
  await database.table("projects").bulkAdd([project(projectA), project(projectB)]);
  const insight = { id: id(3), projectId: projectA, researchSessionId: id(4), observationIds: [id(5)], statement: "真实洞察", createdAt: time, updatedAt: time } satisfies ResearchInsight;
  await database.table("researchInsights").add(insight);
  let index = 10; const command = new AddEntityNodeCommand(database, { idFactory: () => id(index++) });
  const first = await command.execute({ projectId: projectA, entityType: "ResearchInsight", entityId: insight.id });
  const duplicate = await command.execute({ projectId: projectA, entityType: "ResearchInsight", entityId: insight.id });
  assert.equal(first.created, true); assert.equal(duplicate.created, false);
  assert.deepEqual(first.node.position, { x: 80, y: 100 });
  assert.deepEqual(Object.keys(first.node).filter((key) => key === "statement"), []);
  await database.table("researchInsights").update(insight.id, { statement: "更新后的洞察" });
  assert.equal((await command.resolve("ResearchInsight", insight.id) as ResearchInsight | undefined)?.statement, "更新后的洞察");
  await assert.rejects(command.execute({ projectId: projectB, entityType: "ResearchInsight", entityId: insight.id }), /不属于当前项目/);
  database.close();
});
