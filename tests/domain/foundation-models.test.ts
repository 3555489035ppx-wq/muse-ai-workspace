import assert from "node:assert/strict";
import test from "node:test";
import { isAsset, isAssetAnalysis, isAssetCollection, isAssetSource } from "../../src/domain/asset/index.js";
import { isProjectTemplate } from "../../src/domain/template/index.js";
import { isVersionSnapshot } from "../../src/domain/version/index.js";
import { isAsyncTask, isOperation, isWorkflowRun } from "../../src/domain/workflow/index.js";
import { isCanvas, isCanvasEdge, isCanvasNode, isCanvasViewport } from "../../src/domain/canvas/index.js";

const id = (suffix: string): string => `40000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const time = "2026-07-28T08:00:00.000Z";
const entity = { id: id("1"), createdAt: time, updatedAt: time };
const scoped = { ...entity, projectId: id("2") };

void test("asset source/status/type enums and guards are enforced", () => {
  const asset = { ...entity, name: "参考图", type: "image", status: "ready", mimeType: "image/png", byteSize: 20, storageKey: "blob/1" };
  assert.equal(isAsset(asset), true);
  assert.equal(isAsset({ ...asset, status: "uploaded" }), false);
  assert.equal(isAssetSource({ ...scoped, id: id("3"), assetId: asset.id, type: "upload", label: "用户上传" }), true);
  assert.equal(isAssetAnalysis({ ...scoped, id: id("4"), assetId: asset.id, kind: "metadata", values: { width: 100 } }), true);
  assert.equal(isAssetCollection({ ...scoped, id: id("5"), name: "参考", assetIds: [asset.id] }), true);
});

void test("template strategy stays empty and version snapshots are entity scoped", () => {
  const template = { ...entity, name: "空策略模板", status: "draft", strategy: {}, schemaVersion: 1 };
  assert.equal(isProjectTemplate(template), true);
  assert.equal(isProjectTemplate({ ...template, strategy: { prompt: "fake" } }), false);
  const snapshot = { ...scoped, id: id("6"), entityType: "direction", entityId: id("7"), schemaVersion: 1, label: "V1", snapshot: { status: "candidate" } };
  assert.equal(isVersionSnapshot(snapshot), true);
  assert.equal(isVersionSnapshot({ ...snapshot, entityType: "entire_project" }), false);
});

void test("workflow, operation and async task states use separate enums", () => {
  assert.equal(isWorkflowRun({ ...scoped, id: id("8"), entityId: id("9"), entityType: "direction", state: "running" }), true);
  assert.equal(isWorkflowRun({ ...scoped, id: id("8"), entityId: id("9"), entityType: "direction", state: "pending" }), false);
  assert.equal(isOperation({ ...scoped, id: id("10"), kind: "save", state: "pending" }), true);
  assert.equal(isOperation({ ...scoped, id: id("10"), kind: "save", state: "running" }), false);
  assert.equal(isAsyncTask({ ...scoped, id: id("11"), operationId: id("10"), status: "queued" }), true);
});

void test("canvas node, edge and viewport guards preserve normalized relationships", () => {
  const canvas = { ...scoped, id: id("12"), name: "决策地图" };
  const nodeA = { ...scoped, id: id("13"), canvasId: canvas.id, entityId: id("14"), entityType: "direction", position: { x: 10, y: 20 } };
  const nodeB = { ...nodeA, id: id("15"), entityId: id("16"), position: { x: 50, y: 20 } };
  assert.equal(isCanvas(canvas), true);
  assert.equal(isCanvasNode(nodeA), true);
  assert.equal(isCanvasNode({ ...nodeA, entityType: "provider" }), false);
  assert.equal(isCanvasEdge({ ...scoped, id: id("17"), canvasId: canvas.id, sourceNodeId: nodeA.id, targetNodeId: nodeB.id }), true);
  assert.equal(isCanvasEdge({ ...scoped, id: id("17"), canvasId: canvas.id, sourceNodeId: nodeA.id, targetNodeId: nodeA.id }), false);
  assert.equal(isCanvasViewport({ ...scoped, id: id("18"), canvasId: canvas.id, x: 0, y: 0, zoom: 1 }), true);
});
