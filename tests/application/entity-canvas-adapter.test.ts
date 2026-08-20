import assert from "node:assert/strict";
import test from "node:test";
import { EntityCanvasAdapter } from "../../src/application/canvas/index.js";
import { ReviewService } from "../../src/application/review/index.js";
import type { CanvasNodeEntityType } from "../../src/domain/canvas/index.js";
import type { ProjectBrief } from "../../src/domain/project/index.js";
import type { ProjectScopedEntity } from "../../src/domain/shared/entity.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import { CanvasRepository } from "../../src/repositories/CanvasRepository.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

void test("entity adapter maps every Phase 1 entity to reference-only canvas nodes with live lookup", async () => {
  const database = gateDatabase("p17-entity-adapter");
  try {
    const fixture = await createGeneratedCase(database, 74, "山西文化遗产");
    const review = await new ReviewService(database, { entityIdFactory: fixture.nextId }).review(fixture.projectId, fixture.generatedAssetId);
    const repository = new CanvasRepository(database);
    const canvas = await repository.createCanvas({ id: fixture.nextId(), projectId: fixture.projectId, name: "决策地图" });
    const first = async (table: string): Promise<EntityId> => {
      const item = await database.table<ProjectScopedEntity, EntityId>(table).where("projectId").equals(fixture.projectId).first();
      if (!item) throw new Error(`Missing ${table}`);
      return item.id;
    };
    const cases: readonly (readonly [CanvasNodeEntityType, EntityId])[] = [
      ["brief", fixture.briefId], ["research", fixture.researchSessionId], ["insight", await first("researchInsights")], ["opportunity", await first("researchOpportunities")], ["moodboard", fixture.moodboardId], ["direction", fixture.lockedDirectionId], ["exploration", fixture.explorationId], ["prompt", fixture.promptVersionId], ["asset", fixture.assetId], ["generated_asset", fixture.generatedAssetId], ["review", review.review.id],
    ];
    const adapter = new EntityCanvasAdapter(database, { entityIdFactory: fixture.nextId });
    for (const [index, entry] of cases.entries()) {
      const node = await adapter.add(fixture.projectId, canvas.id, entry[0], entry[1], { x: index * 180, y: index % 2 * 140 });
      assert.deepEqual(Object.keys(node).sort(), ["canvasId", "createdAt", "entityId", "entityType", "id", "position", "projectId", "updatedAt"].sort());
      assert.equal((await adapter.resolve(fixture.projectId, entry[0], entry[1])).id, entry[1]);
    }
    const brief = await database.table<ProjectBrief, EntityId>("briefs").get(fixture.briefId);
    if (!brief) throw new Error("Missing brief");
    await database.table<ProjectBrief, EntityId>("briefs").update(fixture.briefId, { goal: `${brief.goal} 更新` });
    assert.match(String((await adapter.resolve(fixture.projectId, "brief", fixture.briefId)).goal), /更新/);
  } finally { database.close(); }
});

void test("entity adapter rejects missing and cross-project entities", async () => {
  const database = gateDatabase("p17-entity-scope");
  try {
    const a = await createGeneratedCase(database, 75, "山西文化遗产"); const b = await createGeneratedCase(database, 76, "成都独立咖啡");
    const canvas = await new CanvasRepository(database).createCanvas({ id: a.nextId(), projectId: a.projectId, name: "A" }); const adapter = new EntityCanvasAdapter(database, { entityIdFactory: a.nextId });
    await assert.rejects(() => adapter.add(a.projectId, canvas.id, "brief", b.briefId, { x: 0, y: 0 })); await assert.rejects(() => adapter.resolve(a.projectId, "review", a.nextId()));
  } finally { database.close(); }
});
