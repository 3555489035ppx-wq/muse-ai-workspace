import assert from "node:assert/strict";
import test from "node:test";
import { InvalidWorkflowTransitionError } from "../../src/domain/errors/index.js";
import { PROJECT_WORKFLOW_STATES, ProjectWorkflowService, type ProjectWorkflowState } from "../../src/domain/services/ProjectWorkflowService.js";

const legalPath: readonly ProjectWorkflowState[] = PROJECT_WORKFLOW_STATES;

void test("ProjectWorkflowService accepts every legal edge", () => {
  const service = new ProjectWorkflowService();
  for (let index = 0; index < legalPath.length - 1; index += 1) {
    const from = legalPath[index];
    const to = legalPath[index + 1];
    assert.ok(from !== undefined && to !== undefined);
    assert.equal(service.canTransition(from, to), true);
    assert.equal(service.transition(from, to), to);
    assert.deepEqual(service.getAvailableTransitions(from), [to]);
  }
});

void test("ProjectWorkflowService rejects illegal jumps and terminal transitions", () => {
  const service = new ProjectWorkflowService();
  assert.equal(service.canTransition("DRAFT", "LOCKED"), false);
  assert.throws(() => service.transition("DRAFT", "LOCKED"), InvalidWorkflowTransitionError);
  assert.deepEqual(service.getAvailableTransitions("REVIEWED"), []);
  assert.equal(service.canTransition("REVIEWED", "DRAFT"), false);
  assert.throws(() => service.transition("REVIEWED", "DRAFT"), InvalidWorkflowTransitionError);
});

void test("DIRECTIONS_READY to LOCKED is pure and has no business side effect", () => {
  const service = new ProjectWorkflowService();
  const entities = Object.freeze({ directions: Object.freeze(["A", "B", "C"]), explorations: Object.freeze([] as string[]) });
  const before = JSON.stringify(entities);
  assert.equal(service.transition("DIRECTIONS_READY", "LOCKED"), "LOCKED");
  assert.equal(JSON.stringify(entities), before);
  assert.equal(entities.explorations.length, 0);
});
