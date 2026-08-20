import assert from "node:assert/strict";
import test from "node:test";
import { ReviewService } from "../../src/application/review/index.js";
import type { ProjectWorkflowState } from "../../src/domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../src/domain/shared/entity.js";
import type { EntityId } from "../../src/domain/shared/id.js";
interface WorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

void test("deterministic review persists seven complete evidence-backed dimensions", async () => {
  const database = gateDatabase("p16-review"); try { const fixture = await createGeneratedCase(database, 67, "山西文化遗产"); const service = new ReviewService(database, { entityIdFactory: fixture.nextId }); const first = await service.review(fixture.projectId, fixture.generatedAssetId); assert.equal(first.rubric.length, 7); for (const item of first.rubric) { assert.ok(item.evidenceIds.includes(fixture.generatedAssetId)); assert.ok(item.problem && item.reason && item.impact && item.recommendation); } assert.equal(first.review.generatedAssetId, fixture.generatedAssetId); assert.equal((await database.table<WorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(fixture.projectId).first())?.state, "REVIEWED"); } finally { database.close(); } });

void test("review output is deterministic, case-specific and rejects invalid asset", async () => {
  const a = gateDatabase("p16-review-a"); const b = gateDatabase("p16-review-b"); try { const fa = await createGeneratedCase(a, 68, "山西文化遗产"); const fb = await createGeneratedCase(b, 69, "成都独立咖啡"); const ra = await new ReviewService(a, { entityIdFactory: fa.nextId }).review(fa.projectId, fa.generatedAssetId); const rb = await new ReviewService(b, { entityIdFactory: fb.nextId }).review(fb.projectId, fb.generatedAssetId); assert.notEqual(ra.review.summary, rb.review.summary); assert.notDeepEqual(ra.rubric.map(item => item.score), rb.rubric.map(item => item.score)); await assert.rejects(() => new ReviewService(a).review(fa.projectId, fb.generatedAssetId)); } finally { a.close(); b.close(); } });
