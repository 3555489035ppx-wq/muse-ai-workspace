import assert from "node:assert/strict";
import test from "node:test";
import type { ExplorationVariant } from "../../src/domain/exploration/index.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import type { VersionSnapshot } from "../../src/domain/version/index.js";
import { ExplorationGalleryService, ExplorationService, IterationService } from "../../src/application/exploration/index.js";
import { createLockedDirectionCase, gateDatabase } from "../helpers/phase-one-case.js";

const required = <T,>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing gate item ${String(index)}`);
  return item;
};
const record = (value: unknown): Readonly<Record<string, unknown>> | undefined => typeof value === "object" && value !== null ? value as Readonly<Record<string, unknown>> : undefined;
const field = (value: unknown, key: string): unknown => record(value)?.[key];

void test("Phase 1.5 gate: two isolated cases keep one concept, multi-axis variants, selection and iteration lineage", async () => {
  const db = gateDatabase("phase-1-5-gate");
  const shanxi = await createLockedDirectionCase(db, 71, "山西文化遗产");
  const coffee = await createLockedDirectionCase(db, 72, "成都独立咖啡");
  const create = async (fixture: typeof shanxi) => new ExplorationService(db, { entityIdFactory: fixture.nextId }).generate({
    projectId: fixture.projectId, visualDNAId: fixture.visualDNAId, sourceAssetIds: fixture.assets.map((item) => item.id),
    axes: ["composition", "photography", "typography", "color", "material", "lighting", "imageTreatment"], seed: "fixed",
  });
  const shanxiExploration = await create(shanxi); const coffeeExploration = await create(coffee);
  const all = await db.table<ExplorationVariant, EntityId>("explorationVariants").toArray();
  assert.equal(all.filter((item) => item.projectId === shanxi.projectId).length, 6);
  assert.equal(all.filter((item) => item.projectId === coffee.projectId).length, 6);
  const snapshots = (await db.table<VersionSnapshot, EntityId>("versionSnapshots").toArray()).filter((item) => item.label === "exploration:initial");
  for (const snapshot of snapshots) {
    const variants = Array.isArray(snapshot.snapshot.variants) ? snapshot.snapshot.variants : [];
    const conceptIds = new Set(variants.map((item) => field(item, "conceptId")));
    const fixtures = new Set(variants.map((item) => field(field(item, "preview"), "fixtureKey")));
    assert.equal(conceptIds.size, 1); assert.equal(fixtures.size, 6);
  }
  await new ExplorationGalleryService(db, { entityIdFactory: shanxi.nextId }).select(shanxi.projectId, required(shanxiExploration.variantIds, 0));
  await new ExplorationGalleryService(db, { entityIdFactory: coffee.nextId }).select(coffee.projectId, required(coffeeExploration.variantIds, 1));
  await new IterationService(db, { entityIdFactory: shanxi.nextId }).iterate(shanxi.projectId, shanxiExploration.explorationId, { text: "更克制但保持文化证据", focusAxes: ["color", "lighting"] }, "fixed");
  assert.equal(await db.table<ExplorationVariant, EntityId>("explorationVariants").where("projectId").equals(shanxi.projectId).count(), 12);
  assert.equal(await db.table<ExplorationVariant, EntityId>("explorationVariants").where("projectId").equals(coffee.projectId).count(), 6);
  assert.equal(await db.table("promptSpecs").count(), 0); db.close();
});
