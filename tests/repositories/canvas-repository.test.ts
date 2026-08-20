import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import type { Project } from "../../src/domain/project/index.js";
import type { ResearchSession } from "../../src/domain/research/index.js";
import { EntityNotFoundError, ParentEntityMismatchError } from "../../src/domain/errors/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import { CanvasRepository } from "../../src/repositories/CanvasRepository.js";

let sequence = 0;
const id = (suffix: string) => asEntityId(`12000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("12000000-0000-4000-8000-000000000001");
const projectB = asProjectId("12000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");
const project = (projectId: typeof projectA): Project => ({ id: projectId, name: projectId, type: "brand", status: "active", stage: "research", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time });

async function fixture() {
  const databaseName = `canvas-repo-${String(sequence++)}`;
  const database = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } });
  await database.table("projects").bulkAdd([project(projectA), project(projectB)]);
  const researchA = { id: id("3"), projectId: projectA, briefId: id("4"), query: "A", status: "completed", createdAt: time, updatedAt: time } satisfies ResearchSession;
  const researchB = { ...researchA, id: id("5"), projectId: projectB, query: "B" } satisfies ResearchSession;
  await database.table("researchSessions").bulkAdd([researchA, researchB]);
  return { database, databaseName, researchA, researchB, repository: new CanvasRepository(database) };
}

void test("CanvasRepository reloads persisted node positions", async () => {
  const f = await fixture();
  const canvas = await f.repository.createCanvas({ id: id("10"), projectId: projectA, name: "决策地图" });
  const node = await f.repository.createNode({ id: id("11"), projectId: projectA, canvasId: canvas.id, entityType: "research", entityId: f.researchA.id, position: { x: 10, y: 20 } });
  await f.repository.updateNode(node.id, { position: { x: 320, y: -80 } });
  f.database.close();
  const reopened = createMuseDatabase(f.databaseName, { dependencies: { indexedDB, IDBKeyRange } });
  assert.deepEqual((await new CanvasRepository(reopened).getNode(node.id))?.position, { x: 320, y: -80 });
  reopened.close();
});

void test("CanvasRepository rejects orphan and cross-project node relationships", async () => {
  const f = await fixture();
  const canvas = await f.repository.createCanvas({ id: id("20"), projectId: projectA, name: "A" });
  await assert.rejects(f.repository.createNode({ id: id("21"), projectId: projectA, canvasId: canvas.id, entityType: "research", entityId: id("999"), position: { x: 0, y: 0 } }), EntityNotFoundError);
  await assert.rejects(f.repository.createNode({ id: id("22"), projectId: projectA, canvasId: canvas.id, entityType: "research", entityId: f.researchB.id, position: { x: 0, y: 0 } }), ParentEntityMismatchError);
  f.database.close();
});

void test("CanvasRepository rejects orphan and cross-project edges", async () => {
  const f = await fixture();
  const canvasA = await f.repository.createCanvas({ id: id("30"), projectId: projectA, name: "A" });
  const canvasB = await f.repository.createCanvas({ id: id("31"), projectId: projectB, name: "B" });
  const nodeA1 = await f.repository.createNode({ id: id("32"), projectId: projectA, canvasId: canvasA.id, entityType: "research", entityId: f.researchA.id, position: { x: 0, y: 0 } });
  const nodeA2 = await f.repository.createNode({ id: id("33"), projectId: projectA, canvasId: canvasA.id, entityType: "research", entityId: f.researchA.id, position: { x: 1, y: 1 } });
  await f.repository.createNode({ id: id("34"), projectId: projectB, canvasId: canvasB.id, entityType: "research", entityId: f.researchB.id, position: { x: 2, y: 2 } });
  await assert.rejects(f.repository.createEdge({ id: id("35"), projectId: projectA, canvasId: canvasA.id, sourceNodeId: nodeA1.id, targetNodeId: id("999") }), EntityNotFoundError);
  await f.repository.createEdge({ id: id("36"), projectId: projectA, canvasId: canvasA.id, sourceNodeId: nodeA1.id, targetNodeId: nodeA2.id });
  await assert.rejects(f.repository.createEdge({ id: id("37"), projectId: projectB, canvasId: canvasB.id, sourceNodeId: nodeA1.id, targetNodeId: nodeA2.id }), ParentEntityMismatchError);
  f.database.close();
});
