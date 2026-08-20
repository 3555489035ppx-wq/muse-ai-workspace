import assert from "node:assert/strict";
import test from "node:test";
import type { Direction } from "../../src/domain/direction/index.js";
import type { Exploration, ExplorationVariant } from "../../src/domain/exploration/index.js";
import type { Moodboard, VisualDNA } from "../../src/domain/moodboard/index.js";
import type { Project, ProjectBrief } from "../../src/domain/project/index.js";
import type { ResearchInsight, ResearchSession } from "../../src/domain/research/index.js";
import type { EntityId } from "../../src/domain/shared/id.js";
import { ExplorationService } from "../../src/application/exploration/index.js";
import { PromptCompiler, PromptCompilerError } from "../../src/application/prompt/index.js";
import { createLockedDirectionCase, gateDatabase } from "../helpers/phase-one-case.js";

let sequence = 80;
async function compileInput(name: string) {
  const db = gateDatabase(`compiler-${String(sequence++)}`); const fixture = await createLockedDirectionCase(db, sequence, name);
  const explorationResult = await new ExplorationService(db, { entityIdFactory: fixture.nextId }).generate({ projectId: fixture.projectId, visualDNAId: fixture.visualDNAId, sourceAssetIds: fixture.assets.map((item) => item.id), axes: ["composition", "color", "lighting"], seed: "fixed" });
  const variantId = explorationResult.variantIds[0]; if (variantId === undefined) throw new Error("Missing compiler variant");
  const input = {
    project: await db.table<Project, EntityId>("projects").get(fixture.projectId), brief: await db.table<ProjectBrief, EntityId>("briefs").get(fixture.briefId),
    research: await db.table<ResearchSession, EntityId>("researchSessions").get(fixture.researchSessionId), insights: await db.table<ResearchInsight, EntityId>("researchInsights").where("projectId").equals(fixture.projectId).toArray(),
    moodboard: await db.table<Moodboard, EntityId>("moodboards").get(fixture.moodboardId), visualDNA: await db.table<VisualDNA, EntityId>("visualDna").get(fixture.visualDNAId),
    direction: await db.table<Direction, EntityId>("directions").get(fixture.lockedDirectionId), exploration: await db.table<Exploration, EntityId>("explorations").get(explorationResult.explorationId),
    variant: await db.table<ExplorationVariant, EntityId>("explorationVariants").get(variantId), constraints: ["禁止空泛装饰"],
  };
  return { db, input };
}

void test("PromptCompiler maps every structured field to real source references deterministically", async () => {
  const { db, input } = await compileInput("山西文化遗产"); const compiler = new PromptCompiler(); const first = compiler.compile(input);
  assert.deepEqual(first, compiler.compile(input)); assert.equal(Object.values(first.fields).every((values) => values.length > 0), true); assert.equal(Object.values(first.sourceRefs).every((values) => values.length > 0), true); db.close();
});
void test("PromptCompiler rejects missing upstream and produces case-specific output", async () => {
  assert.throws(() => new PromptCompiler().compile({}), PromptCompilerError); const a = await compileInput("山西文化遗产"); const b = await compileInput("成都独立咖啡");
  assert.notDeepEqual(new PromptCompiler().compile(a.input).fields, new PromptCompiler().compile(b.input).fields); a.db.close(); b.db.close();
});
