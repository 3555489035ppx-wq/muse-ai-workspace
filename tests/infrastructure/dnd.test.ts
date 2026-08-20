import assert from "node:assert/strict";
import test from "node:test";
import type { Collision } from "@dnd-kit/core";
import { isDragPayload, firstCollisionId, reorderItems } from "../../src/infrastructure/dnd/utilities.js";

void test("drag payload guard accepts generic typed payloads", () => {
  assert.equal(isDragPayload({ kind: "item", id: "a", containerId: 1 }), true);
  assert.equal(isDragPayload({ kind: "container", id: 2 }), true);
});

void test("drag payload guard rejects invalid and business-shaped payloads", () => {
  assert.equal(isDragPayload(null), false);
  assert.equal(isDragPayload({ kind: "asset", id: "a" }), false);
  assert.equal(isDragPayload({ kind: "item", id: {} }), false);
  assert.equal(isDragPayload({ kind: "item", id: "a", containerId: {} }), false);
});

void test("reorder helper is pure and deterministic", () => {
  const input = [{ id: "a" }, { id: "b" }, { id: "c" }] as const;
  const result = reorderItems(input, "a", "c", (item) => item.id);
  assert.deepEqual(result.map((item) => item.id), ["b", "c", "a"]);
  assert.deepEqual(input.map((item) => item.id), ["a", "b", "c"]);
  assert.notEqual(result, input);
  assert.deepEqual(reorderItems(input, "missing", "c", (item) => item.id), input);
});

void test("collision helper returns the first ranked collision", () => {
  const collisions = [{ id: "target", data: { droppableContainer: {}, value: 1 } }] as unknown as readonly Collision[];
  assert.equal(firstCollisionId(collisions), "target");
  assert.equal(firstCollisionId([]), undefined);
  assert.equal(firstCollisionId(null), undefined);
});
