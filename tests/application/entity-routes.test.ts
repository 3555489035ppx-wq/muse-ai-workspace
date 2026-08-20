import assert from "node:assert/strict";
import test from "node:test";
import { getDecisionEntityRoute } from "../../src/application/canvas/index.js";
import { asEntityId } from "../../src/domain/shared/id.js";
const projectId = "40820000-0000-4000-8000-000000000001"; const entityId = asEntityId("40820000-0000-4000-8000-000000000002");
void test("decision node routes map research, moodboard, direction, exploration and review to project pages", () => { assert.deepEqual(getDecisionEntityRoute(projectId, "research", entityId), { ok: true, route: `${projectId.startsWith("/") ? "" : "/projects/"}${projectId}/research` }); assert.equal(getDecisionEntityRoute(projectId, "moodboard", entityId).ok, true); assert.deepEqual(getDecisionEntityRoute(projectId, "direction", entityId), { ok: true, route: `/projects/${projectId}/directions/${entityId}` }); assert.deepEqual(getDecisionEntityRoute(projectId, "review", entityId), { ok: true, route: `/projects/${projectId}/generation` }); });
void test("decision node routes reject invalid project IDs and unsupported runtime types safely", () => { assert.deepEqual(getDecisionEntityRoute("bad", "research", entityId), { ok: false, reason: "INVALID_PROJECT" }); assert.deepEqual(getDecisionEntityRoute(projectId, "unknown" as never, entityId), { ok: false, reason: "UNSUPPORTED_TYPE" }); });
