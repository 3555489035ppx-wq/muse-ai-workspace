import assert from "node:assert/strict";
import test from "node:test";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { runFinalPhaseOneCase } from "../helpers/phase-one-final-case.js";
import type { ProjectWorkflowState } from "../../src/domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../src/domain/shared/entity.js";
import type { EntityId } from "../../src/domain/shared/id.js";
interface WorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
void test("Case A runs Shanxi heritage from Project through Decision Map with Direction B locked", async () => { const database = gateDatabase("phase-1-final-shanxi"); try { const result = await runFinalPhaseOneCase(database, 87, "山西文化遗产年轻化视觉传播"); assert.equal(result.directions.length, 3); assert.equal(result.directions[1]?.status, "locked"); assert.equal(result.variants.length, 6); assert.equal(result.review.dimensions.length, 7); assert.ok(result.edges.length >= 9); assert.equal((await database.table<WorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(result.projectId).first())?.state, "REVIEWED"); assert.equal((await database.table("canvasNodes").where("projectId").equals(result.projectId).count()), 11); } finally { database.close(); } });
