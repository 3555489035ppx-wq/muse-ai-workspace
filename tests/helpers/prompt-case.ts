import type { MuseDatabase } from "../../src/db/database.js";
import { ExplorationService } from "../../src/application/exploration/index.js";
import { PromptAdapterService, type StructuredPromptSpec } from "../../src/application/prompt/index.js";
import { deterministicPromptAdapters } from "../../src/infrastructure/providers/mock/prompt-adapters/index.js";
import { createLockedDirectionCase } from "./phase-one-case.js";

export async function createPromptCase(database: MuseDatabase, caseNumber: number, name: string) {
  const base = await createLockedDirectionCase(database, caseNumber, name);
  const exploration = await new ExplorationService(database, { entityIdFactory: base.nextId }).generate({ projectId: base.projectId, visualDNAId: base.visualDNAId, sourceAssetIds: base.assets.map(item => item.id), axes: ["composition", "color", "typography"], seed: "fixed" });
  const refs = [base.briefId, base.researchSessionId, base.moodboardId, base.visualDNAId, base.lockedDirectionId, exploration.explorationId];
  const values = (label: string) => [`${name}${label}`];
  const spec: StructuredPromptSpec = { projectId: base.projectId, explorationId: exploration.explorationId, directionId: base.lockedDirectionId, visualDNAId: base.visualDNAId, researchSessionId: base.researchSessionId, fields: { objective: values("目标"), composition: values("构图"), color: values("色彩"), material: values("材质"), camera: values("镜头"), lighting: values("光线"), typography: values("字体"), imagery: values("图像"), constraints: ["不使用无来源装饰"] }, sourceRefs: { objective: refs, composition: refs, color: refs, material: refs, camera: refs, lighting: refs, typography: refs, imagery: refs, constraints: refs } };
  const compiled = await new PromptAdapterService(deterministicPromptAdapters, database, { entityIdFactory: base.nextId }).compile(spec, "generic");
  return { ...base, explorationId: exploration.explorationId, promptSpecId: compiled.promptSpec.id, promptVersionId: compiled.promptVersion.id, structuredPrompt: spec };
}
