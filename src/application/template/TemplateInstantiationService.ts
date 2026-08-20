import type { VersionSnapshot } from "../../domain/version/index.js";
import { createEntityId, type EntityId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { ProjectCreationService, type ProjectCreationServiceOptions } from "../project/index.js";
import { getPhaseOneTemplate } from "./catalog.js";
import type {
  InstantiateProjectInput,
  TemplateInstantiationProvenance,
  TemplateInstantiationResult,
} from "./contracts.js";

export class UnknownProjectTemplateError extends Error {
  constructor(readonly templateId: EntityId) {
    super(`Unknown project template: ${templateId}`);
    this.name = "UnknownProjectTemplateError";
  }
}

export interface TemplateInstantiationServiceOptions extends ProjectCreationServiceOptions {
  readonly provenanceIdFactory?: () => EntityId;
  readonly clock?: RepositoryClock;
}

export class TemplateInstantiationService {
  readonly #projects: ProjectCreationService;
  readonly #snapshots: BaseRepository<VersionSnapshot>;
  readonly #provenanceIdFactory: () => EntityId;

  constructor(database: MuseDatabase, options: TemplateInstantiationServiceOptions = {}) {
    this.#projects = new ProjectCreationService(database, options);
    this.#snapshots = new BaseRepository(database.table("versionSnapshots"), "TemplateInstantiationProvenance", options.clock);
    this.#provenanceIdFactory = options.provenanceIdFactory ?? (() => createEntityId());
  }

  async instantiate(input: InstantiateProjectInput): Promise<TemplateInstantiationResult> {
    const template = input.templateId === undefined ? undefined : getPhaseOneTemplate(input.templateId);
    if (input.templateId !== undefined && template === undefined) throw new UnknownProjectTemplateError(input.templateId);

    const created = await this.#projects.create({
      name: input.name,
      description: input.description?.trim() || template?.briefPlaceholder || "请补充项目目标与设计语境。",
      projectType: input.projectType ?? template?.projectType ?? "brand",
      targetOutputs: input.targetOutputs ?? template?.recommendedOutputs ?? ["brand_identity"],
      audience: input.audience,
      context: input.context,
      deliverables: input.deliverables,
      constraints: input.constraints,
      references: input.references,
      keywords: input.keywords,
      avoid: input.avoid,
      templateId: template?.id,
    });

    if (template === undefined) return created;
    const provenanceId = this.#provenanceIdFactory();
    const provenance: TemplateInstantiationProvenance = {
      templateId: template.id,
      templateName: template.name,
      researchStrategy: template.researchStrategy,
      moodboardStrategy: template.moodboardStrategy,
      directionStrategy: template.directionStrategy,
    };
    await this.#snapshots.create({
      id: provenanceId,
      projectId: created.projectId,
      entityType: "project",
      entityId: created.projectId,
      schemaVersion: 1,
      label: `模板来源：${template.name}`,
      snapshot: { ...provenance },
    });
    return { ...created, templateId: template.id, provenanceId };
  }
}

export function createTemplateInstantiationService(database: MuseDatabase = getDefaultDatabase()): TemplateInstantiationService {
  return new TemplateInstantiationService(database);
}
