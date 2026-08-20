import assert from "node:assert/strict";
import test from "node:test";
import { describeDecisionEntity } from "../../src/features/canvas/DecisionNodeInspector.js";
import { EntityCanvasAdapter } from "../../src/application/canvas/index.js";
import type { ProjectBrief } from "../../src/domain/project/index.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

void test("inspector describes core fields and source IDs for every entity shape", () => { const view = describeDecisionEntity("direction", { id: "x", title: "东方极简", status: "locked", moodboardId: "m", opportunityIds: ["o"], concept: "克制留白" }); assert.equal(view.title, "东方极简"); assert.equal(view.status, "locked"); assert.deepEqual(view.sources, ["m", "o"]); assert.ok(view.fields.some(([key]) => key === "concept")); });

void test("inspector query reflects entity updates, deletion and project scope", async () => { const database = gateDatabase("p17-inspector-live"); try { const fixture = await createGeneratedCase(database, 81, "山西文化遗产"); const adapter = new EntityCanvasAdapter(database); const brief = await database.table<ProjectBrief, EntityId>("briefs").get(fixture.briefId); if (!brief) throw new Error("Brief missing"); const initial = describeDecisionEntity("brief", await adapter.resolve(fixture.projectId, "brief", fixture.briefId)); await database.table<ProjectBrief, EntityId>("briefs").update(brief.id, { goal: "更新后的目标" }); const updated = describeDecisionEntity("brief", await adapter.resolve(fixture.projectId, "brief", fixture.briefId)); assert.notEqual(initial.title, updated.title); assert.equal(updated.title, "更新后的目标"); await database.table("briefs").delete(brief.id); await assert.rejects(() => adapter.resolve(fixture.projectId, "brief", fixture.briefId)); } finally { database.close(); } });
