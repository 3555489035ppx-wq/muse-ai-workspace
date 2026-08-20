import assert from "node:assert/strict";
import test, { after } from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import type { CanvasNode } from "../../src/domain/canvas/index.js";
import type { Project } from "../../src/domain/project/index.js";
import type { ResearchSession } from "../../src/domain/research/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { createMuseDatabase } from "../../src/db/database.js";
import type { CreativeDecisionMapShell, persistCanvasNodePosition, toFlowEdges, toFlowNodes } from "../../src/infrastructure/canvas/CreativeDecisionMapShell.js";
import { CanvasRepository } from "../../src/repositories/CanvasRepository.js";

interface DecisionMapModule {
  readonly CreativeDecisionMapShell: typeof CreativeDecisionMapShell;
  readonly persistCanvasNodePosition: typeof persistCanvasNodePosition;
  readonly toFlowEdges: typeof toFlowEdges;
  readonly toFlowNodes: typeof toFlowNodes;
}
let viteServer: ViteDevServer | undefined;
const modulePromise = createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" }).then(async (server) => {
  viteServer = server;
  return server.ssrLoadModule("/src/infrastructure/canvas/CreativeDecisionMapShell.tsx") as Promise<DecisionMapModule>;
});
after(async () => { await viteServer?.close(); });

let sequence = 0;
const id = (suffix: string) => asEntityId(`16000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectA = asProjectId("16000000-0000-4000-8000-000000000001");
const projectB = asProjectId("16000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");
const project = (projectId: typeof projectA): Project => ({ id: projectId, name: projectId, type: "brand", status: "active", stage: "research", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time });

void test("CreativeDecisionMapShell mounts and exposes normalized nodes and edges", async () => {
  const { CreativeDecisionMapShell, toFlowEdges, toFlowNodes } = await modulePromise;
  const node = { id: id("3"), projectId: projectA, canvasId: id("4"), entityType: "research", entityId: id("5"), position: { x: 12, y: 34 }, createdAt: time, updatedAt: time } satisfies CanvasNode;
  assert.deepEqual(toFlowNodes([node])[0], { id: node.id, position: node.position, data: { entityId: node.entityId, entityType: "research" } });
  assert.deepEqual(toFlowEdges([{ id: id("6"), projectId: projectA, canvasId: node.canvasId, sourceNodeId: node.id, targetNodeId: id("7"), label: "来源", createdAt: time, updatedAt: time }])[0], { id: id("6"), source: node.id, target: id("7"), label: "来源" });
  const database = createMuseDatabase(`decision-shell-mount-${String(sequence++)}`, { dependencies: { indexedDB, IDBKeyRange } });
  const html = renderToStaticMarkup(createElement(CreativeDecisionMapShell, { projectId: projectA, repository: new CanvasRepository(database), nodes: [node], edges: [] }));
  assert.match(html, /data-testid="creative-decision-map-shell"/);
  database.close();
});

void test("position persistence reloads through CanvasRepository and enforces project scope", async () => {
  const { persistCanvasNodePosition } = await modulePromise;
  const databaseName = `decision-shell-${String(sequence++)}`;
  const database = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } });
  await database.table("projects").bulkAdd([project(projectA), project(projectB)]);
  const research = { id: id("10"), projectId: projectA, briefId: id("11"), query: "q", status: "completed", createdAt: time, updatedAt: time } satisfies ResearchSession;
  await database.table("researchSessions").add(research);
  const repository = new CanvasRepository(database);
  const canvas = await repository.createCanvas({ id: id("12"), projectId: projectA, name: "map" });
  const node = await repository.createNode({ id: id("13"), projectId: projectA, canvasId: canvas.id, entityType: "research", entityId: research.id, position: { x: 0, y: 0 } });
  await persistCanvasNodePosition(repository, projectA, node.id, { x: 240, y: 180 });
  await assert.rejects(persistCanvasNodePosition(repository, projectB, node.id, { x: 1, y: 1 }), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "PROJECT_SCOPE_VIOLATION");
  database.close();
  const reopened = createMuseDatabase(databaseName, { dependencies: { indexedDB, IDBKeyRange } });
  assert.deepEqual((await new CanvasRepository(reopened).getNode(node.id))?.position, { x: 240, y: 180 });
  reopened.close();
});
