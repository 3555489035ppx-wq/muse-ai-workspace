import type { Asset } from "../asset/index.js";
import type { Direction } from "../direction/index.js";
import { ReferentialIntegrityError } from "../errors/index.js";
import type { Exploration } from "../exploration/index.js";
import type { GeneratedAsset, GenerationJob } from "../generation/index.js";
import type { Moodboard, VisualDNA } from "../moodboard/index.js";
import type { Project, ProjectBrief } from "../project/index.js";
import type { PromptSpec, PromptVersion } from "../prompt/index.js";
import type { ResearchSession } from "../research/index.js";
import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId, ProjectId } from "../shared/id.js";

export interface TraceabilityReader {
  getGeneratedAsset(id: EntityId): Promise<GeneratedAsset | undefined>;
  getAsset(id: EntityId): Promise<Asset | undefined>;
  getGenerationJob(id: EntityId): Promise<GenerationJob | undefined>;
  getPromptVersion(id: EntityId): Promise<PromptVersion | undefined>;
  getPromptSpec(id: EntityId): Promise<PromptSpec | undefined>;
  getExploration(id: EntityId): Promise<Exploration | undefined>;
  getDirection(id: EntityId): Promise<Direction | undefined>;
  getVisualDNA(id: EntityId): Promise<VisualDNA | undefined>;
  getMoodboard(id: EntityId): Promise<Moodboard | undefined>;
  getResearchSession(id: EntityId): Promise<ResearchSession | undefined>;
  getBrief(id: EntityId): Promise<ProjectBrief | undefined>;
  getProject(id: ProjectId): Promise<Project | undefined>;
}

export interface GeneratedAssetTraceabilityChain {
  readonly generatedAsset: GeneratedAsset;
  readonly asset: Asset;
  readonly generationJob: GenerationJob;
  readonly promptVersion: PromptVersion;
  readonly promptSpec: PromptSpec;
  readonly exploration: Exploration;
  readonly direction: Direction;
  readonly visualDNA: VisualDNA;
  readonly moodboard: Moodboard;
  readonly researchSession: ResearchSession;
  readonly brief: ProjectBrief;
  readonly project: Project;
}

function requireEntity<T>(entity: T | undefined, missingId: EntityId, referencedBy: EntityId): T {
  if (entity === undefined) throw new ReferentialIntegrityError(missingId, [referencedBy]);
  return entity;
}

function requireScoped<T extends ProjectScopedEntity>(entity: T | undefined, id: EntityId, projectId: ProjectId, referencedBy: EntityId): T {
  const found = requireEntity(entity, id, referencedBy);
  if (found.projectId !== projectId) throw new ReferentialIntegrityError(id, [referencedBy]);
  return found;
}

function assertEqual(actual: EntityId, expected: EntityId, referencedBy: EntityId): void {
  if (actual !== expected) throw new ReferentialIntegrityError(expected, [referencedBy]);
}

export class TraceabilityService {
  readonly #reader: TraceabilityReader;
  constructor(reader: TraceabilityReader) { this.#reader = reader; }

  async resolveGeneratedAsset(generatedAssetId: EntityId): Promise<GeneratedAssetTraceabilityChain> {
    const generatedAsset = requireEntity(await this.#reader.getGeneratedAsset(generatedAssetId), generatedAssetId, generatedAssetId);
    const projectId = generatedAsset.projectId;
    const asset = requireEntity(await this.#reader.getAsset(generatedAsset.assetId), generatedAsset.assetId, generatedAsset.id);
    const generationJob = requireScoped(await this.#reader.getGenerationJob(generatedAsset.generationJobId), generatedAsset.generationJobId, projectId, generatedAsset.id);
    const promptVersion = requireScoped(await this.#reader.getPromptVersion(generatedAsset.promptVersionId), generatedAsset.promptVersionId, projectId, generatedAsset.id);
    assertEqual(generationJob.promptVersionId, promptVersion.id, generationJob.id);
    const promptSpec = requireScoped(await this.#reader.getPromptSpec(promptVersion.promptSpecId), promptVersion.promptSpecId, projectId, promptVersion.id);
    assertEqual(promptSpec.explorationId, promptVersion.explorationId, promptSpec.id);
    assertEqual(promptSpec.directionId, promptVersion.directionId, promptSpec.id);
    assertEqual(promptSpec.visualDNAId, promptVersion.visualDNAId, promptSpec.id);
    assertEqual(promptSpec.researchSessionId, promptVersion.researchSessionId, promptSpec.id);
    const exploration = requireScoped(await this.#reader.getExploration(promptVersion.explorationId), promptVersion.explorationId, projectId, promptVersion.id);
    const direction = requireScoped(await this.#reader.getDirection(promptVersion.directionId), promptVersion.directionId, projectId, promptVersion.id);
    const visualDNA = requireScoped(await this.#reader.getVisualDNA(promptVersion.visualDNAId), promptVersion.visualDNAId, projectId, promptVersion.id);
    assertEqual(exploration.directionId, direction.id, exploration.id);
    assertEqual(exploration.visualDNAId, visualDNA.id, exploration.id);
    assertEqual(direction.visualDNAId, visualDNA.id, direction.id);
    const moodboard = requireScoped(await this.#reader.getMoodboard(visualDNA.moodboardId), visualDNA.moodboardId, projectId, visualDNA.id);
    assertEqual(direction.moodboardId, moodboard.id, direction.id);
    const researchSession = requireScoped(await this.#reader.getResearchSession(moodboard.researchSessionId), moodboard.researchSessionId, projectId, moodboard.id);
    assertEqual(direction.researchSessionId, researchSession.id, direction.id);
    assertEqual(promptVersion.researchSessionId, researchSession.id, promptVersion.id);
    const brief = requireScoped(await this.#reader.getBrief(researchSession.briefId), researchSession.briefId, projectId, researchSession.id);
    const project = requireEntity(await this.#reader.getProject(projectId), projectId, brief.id);
    if (project.id !== projectId) throw new ReferentialIntegrityError(projectId, [brief.id]);
    return { generatedAsset, asset, generationJob, promptVersion, promptSpec, exploration, direction, visualDNA, moodboard, researchSession, brief, project };
  }
}
