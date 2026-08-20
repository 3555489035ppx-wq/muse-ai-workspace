import assert from "node:assert/strict";
import test from "node:test";
import type { Asset } from "../../src/domain/asset/index.js";
import type { Direction } from "../../src/domain/direction/index.js";
import { ReferentialIntegrityError } from "../../src/domain/errors/index.js";
import type { Exploration } from "../../src/domain/exploration/index.js";
import type { GeneratedAsset, GenerationJob } from "../../src/domain/generation/index.js";
import type { Moodboard, VisualDNA } from "../../src/domain/moodboard/index.js";
import type { Project, ProjectBrief } from "../../src/domain/project/index.js";
import type { PromptSpec, PromptVersion } from "../../src/domain/prompt/index.js";
import type { ResearchSession } from "../../src/domain/research/index.js";
import { TraceabilityService, type TraceabilityReader } from "../../src/domain/services/TraceabilityService.js";
import { asEntityId, asProjectId, type EntityId, type ProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";

const id = (suffix: string) => asEntityId(`13000000-0000-4000-8000-${suffix.padStart(12, "0")}`);
const projectId = asProjectId("13000000-0000-4000-8000-000000000001");
const otherProjectId = asProjectId("13000000-0000-4000-8000-000000000002");
const time = requireIsoTimestamp("2026-07-28T08:00:00.000Z");

function chain() {
  const project = { id: projectId, name: "山西文旅", type: "brand", status: "active", stage: "review", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4, createdAt: time, updatedAt: time } satisfies Project;
  const brief = { id: id("2"), projectId, goal: "年轻化传播", audience: "青年", context: "山西文化遗产", deliverables: ["海报"], constraints: ["真实"], createdAt: time, updatedAt: time } satisfies ProjectBrief;
  const researchSession = { id: id("3"), projectId, briefId: brief.id, query: "山西文化", status: "completed", createdAt: time, updatedAt: time } satisfies ResearchSession;
  const moodboard = { id: id("4"), projectId, researchSessionId: researchSession.id, title: "东方极简", status: "curated", createdAt: time, updatedAt: time } satisfies Moodboard;
  const visualDNA = { id: id("5"), projectId, moodboardId: moodboard.id, keywords: ["克制"], colorPalette: [{ hex: "#853C29", role: "主色" }], composition: ["留白"], imagery: ["石窟"], createdAt: time, updatedAt: time } satisfies VisualDNA;
  const direction = { id: id("6"), projectId, researchSessionId: researchSession.id, moodboardId: moodboard.id, visualDNAId: visualDNA.id, creativeSeedIds: [id("60")], opportunityIds: [id("61")], title: "东方极简", concept: "古今共鸣", narrative: "以留白表达历史厚度", visualDNA: { keywords: ["克制"], principles: ["留白"] }, advantages: ["辨识度"], risks: ["距离感"], status: "locked", createdAt: time, updatedAt: time } satisfies Direction;
  const exploration = { id: id("7"), projectId, directionId: direction.id, visualDNAId: visualDNA.id, title: "主视觉", status: "selected", createdAt: time, updatedAt: time } satisfies Exploration;
  const promptSpec = { id: id("8"), projectId, explorationId: exploration.id, directionId: direction.id, visualDNAId: visualDNA.id, researchSessionId: researchSession.id, adapterTarget: "generic_image", objective: "海报", constraints: ["留白"], createdAt: time, updatedAt: time } satisfies PromptSpec;
  const promptVersion = { id: id("9"), projectId, promptSpecId: promptSpec.id, explorationId: exploration.id, directionId: direction.id, visualDNAId: visualDNA.id, researchSessionId: researchSession.id, adapterTarget: "generic_image", version: 1, promptText: "东方极简海报", createdAt: time, updatedAt: time } satisfies PromptVersion;
  const generationJob = { id: id("10"), projectId, promptVersionId: promptVersion.id, adapterTarget: "generic_image", status: "succeeded", createdAt: time, updatedAt: time } satisfies GenerationJob;
  const asset = { id: id("11"), name: "output.png", type: "image", status: "ready", mimeType: "image/png", byteSize: 1024, storageKey: "assets/11", createdAt: time, updatedAt: time } satisfies Asset;
  const generatedAsset = { id: id("12"), projectId, generationJobId: generationJob.id, promptVersionId: promptVersion.id, assetId: asset.id, mimeType: "image/png", width: 1024, height: 1024, createdAt: time, updatedAt: time } satisfies GeneratedAsset;
  return { asset, brief, direction, exploration, generatedAsset, generationJob, moodboard, project, promptSpec, promptVersion, researchSession, visualDNA };
}

type Chain = ReturnType<typeof chain>;
type ChainKey = keyof Chain;

function reader(data: Chain, missing?: ChainKey): TraceabilityReader {
  const value = <K extends ChainKey>(key: K): Chain[K] | undefined => missing === key ? undefined : data[key];
  return {
    getGeneratedAsset: () => Promise.resolve(value("generatedAsset")),
    getAsset: () => Promise.resolve(value("asset")),
    getGenerationJob: () => Promise.resolve(value("generationJob")),
    getPromptVersion: () => Promise.resolve(value("promptVersion")),
    getPromptSpec: () => Promise.resolve(value("promptSpec")),
    getExploration: () => Promise.resolve(value("exploration")),
    getDirection: () => Promise.resolve(value("direction")),
    getVisualDNA: () => Promise.resolve(value("visualDNA")),
    getMoodboard: () => Promise.resolve(value("moodboard")),
    getResearchSession: () => Promise.resolve(value("researchSession")),
    getBrief: () => Promise.resolve(value("brief")),
    getProject: () => Promise.resolve(value("project")),
  };
}

void test("TraceabilityService answers the complete GeneratedAsset-to-Project chain", async () => {
  const data = chain();
  const result = await new TraceabilityService(reader(data)).resolveGeneratedAsset(data.generatedAsset.id);
  assert.deepEqual(Object.keys(result), ["generatedAsset", "asset", "generationJob", "promptVersion", "promptSpec", "exploration", "direction", "visualDNA", "moodboard", "researchSession", "brief", "project"]);
  assert.equal(result.project.id, projectId);
  assert.equal(result.promptVersion.researchSessionId, result.researchSession.id);
});

void test("TraceabilityService reports every missing layer without fabricating it", async () => {
  for (const key of Object.keys(chain()) as ChainKey[]) {
    const data = chain();
    await assert.rejects(new TraceabilityService(reader(data, key)).resolveGeneratedAsset(data.generatedAsset.id), ReferentialIntegrityError, key);
  }
});

void test("TraceabilityService rejects cross-project pollution", async () => {
  const data = chain();
  const polluted: Chain = { ...data, direction: { ...data.direction, projectId: otherProjectId } };
  await assert.rejects(new TraceabilityService(reader(polluted)).resolveGeneratedAsset(data.generatedAsset.id), ReferentialIntegrityError);
});

void test("TraceabilityReader contract keeps IDs typed", () => {
  const entityId: EntityId = id("90");
  const scopedId: ProjectId = projectId;
  assert.notEqual(entityId, scopedId);
});
