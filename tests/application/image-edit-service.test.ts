import assert from "node:assert/strict";
import test from "node:test";
import { ImageEditService } from "../../src/application/generation/index.js";
import type { GeneratedAsset, ImageEdit } from "../../src/domain/generation/index.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import type { VersionSnapshot } from "../../src/domain/version/index.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

void test("prototype edit records crop/variation/prompt metadata without overwriting source", async () => {
  const database = gateDatabase("p16-image-edit");
  try {
    const fixture = await createGeneratedCase(database, 65, "山西文化遗产"); const service = new ImageEditService(database, { entityIdFactory: fixture.nextId });
    for (const type of ["crop", "variation", "prompt_edit"] as const) await service.create({ projectId: fixture.projectId, generatedAssetId: fixture.generatedAssetId, type, instruction: `${type} 指令` });
    const edits = await database.table<ImageEdit, EntityId>("imageEdits").where("generatedAssetId").equals(fixture.generatedAssetId).toArray(); assert.equal(edits.length, 3); assert.equal(new Set(edits.map(item => item.sourceAssetId)).size, 1);
    assert.equal((await database.table<GeneratedAsset, EntityId>("generatedAssets").get(fixture.generatedAssetId))?.assetId, fixture.assetId);
  } finally { database.close(); }
});

void test("result relationship is stored only after valid provider result and invalid type is rejected", async () => {
  const database = gateDatabase("p16-image-edit-result");
  try {
    const fixture = await createGeneratedCase(database, 66, "成都独立咖啡"); const service = new ImageEditService(database, { entityIdFactory: fixture.nextId });
    await service.create({ projectId: fixture.projectId, generatedAssetId: fixture.generatedAssetId, type: "variation", instruction: "保留构图", resultGeneratedAssetId: fixture.generatedAssetId });
    const snapshots = await database.table<VersionSnapshot, EntityId>("versionSnapshots").where("entityId").equals(fixture.generatedAssetId).toArray(); assert.ok(snapshots.some(item => item.snapshot.resultGeneratedAssetId === fixture.generatedAssetId));
    await assert.rejects(() => service.create({ projectId: fixture.projectId, generatedAssetId: fixture.generatedAssetId, type: "inpaint" as never, instruction: "bad" }));
  } finally { database.close(); }
});
