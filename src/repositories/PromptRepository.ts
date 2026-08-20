import type { Table } from "dexie";
import type { Direction } from "../domain/direction/index.js";
import { DomainError, DuplicateEntityError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { Exploration } from "../domain/exploration/index.js";
import type { VisualDNA } from "../domain/moodboard/index.js";
import type { PromptSpec, PromptVersion } from "../domain/prompt/index.js";
import type { ResearchSession } from "../domain/research/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";
import { requireParent } from "./base/validators.js";

export class PromptRepository {
  readonly #explorations: Table<Exploration, EntityId>;
  readonly #directions: Table<Direction, EntityId>;
  readonly #visualDna: Table<VisualDNA, EntityId>;
  readonly #researchSessions: Table<ResearchSession, EntityId>;
  readonly #specsTable: Table<PromptSpec, EntityId>;
  readonly #versionsTable: Table<PromptVersion, EntityId>;
  readonly #specs: BaseRepository<PromptSpec>;
  readonly #versions: BaseRepository<PromptVersion>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#explorations = database.table("explorations");
    this.#directions = database.table("directions");
    this.#visualDna = database.table("visualDna");
    this.#researchSessions = database.table("researchSessions");
    this.#specsTable = database.table("promptSpecs");
    this.#versionsTable = database.table("promptVersions");
    this.#specs = new BaseRepository(this.#specsTable, "PromptSpec", clock);
    this.#versions = new BaseRepository(this.#versionsTable, "PromptVersion", clock);
  }

  async #validateSpec(entity: Pick<PromptSpec, "projectId" | "explorationId" | "directionId" | "visualDNAId" | "researchSessionId">): Promise<void> {
    const exploration = await requireParent(this.#explorations, entity.explorationId, entity.projectId, "Exploration");
    await requireParent(this.#directions, entity.directionId, entity.projectId, "Direction");
    await requireParent(this.#visualDna, entity.visualDNAId, entity.projectId, "VisualDNA");
    await requireParent(this.#researchSessions, entity.researchSessionId, entity.projectId, "ResearchSession");
    if (exploration.directionId !== entity.directionId || exploration.visualDNAId !== entity.visualDNAId) {
      throw new ParentEntityMismatchError("Exploration", entity.explorationId, entity.projectId);
    }
  }

  async #validateVersion(entity: Pick<PromptVersion, "id" | "projectId" | "promptSpecId" | "explorationId" | "directionId" | "visualDNAId" | "researchSessionId" | "adapterTarget" | "version">): Promise<void> {
    const spec = await requireParent(this.#specsTable, entity.promptSpecId, entity.projectId, "PromptSpec");
    if (spec.explorationId !== entity.explorationId || spec.directionId !== entity.directionId || spec.visualDNAId !== entity.visualDNAId || spec.researchSessionId !== entity.researchSessionId || spec.adapterTarget !== entity.adapterTarget) {
      throw new ParentEntityMismatchError("PromptSpec", entity.promptSpecId, entity.projectId);
    }
    if (!Number.isInteger(entity.version) || entity.version < 1) {
      throw new DomainError("INVALID_PROMPT_VERSION", "Prompt version must be a positive integer.", { version: entity.version });
    }
    const siblings = await this.#versionsTable.where("promptSpecId").equals(entity.promptSpecId).toArray();
    if (siblings.some((item) => item.id !== entity.id && item.version === entity.version)) {
      throw new DuplicateEntityError("PromptVersion", `${entity.promptSpecId}:${String(entity.version)}`);
    }
    const otherVersions = siblings.filter((item) => item.id !== entity.id).map((item) => item.version);
    const expected = otherVersions.length === 0 ? 1 : Math.max(...otherVersions) + 1;
    if (!siblings.some((item) => item.id === entity.id) && entity.version !== expected) {
      throw new DomainError("PROMPT_VERSION_GAP", "Prompt versions must be sequential.", { expected, received: entity.version });
    }
  }

  async createSpec(input: CreateEntityInput<PromptSpec>): Promise<PromptSpec> {
    await this.#validateSpec(input);
    return this.#specs.create(input);
  }
  async updateSpec(id: EntityId, patch: UpdateEntityInput<PromptSpec>): Promise<PromptSpec> {
    const current = await this.#specs.require(id);
    await this.#validateSpec({ ...current, ...patch });
    return this.#specs.update(id, patch);
  }
  getSpec(id: EntityId) { return this.#specs.get(id); }
  deleteSpec(id: EntityId) { return this.#specs.delete(id); }
  listSpecsByProject(projectId: ProjectId) { return this.#specs.query((item) => item.projectId === projectId); }

  async createVersion(input: CreateEntityInput<PromptVersion>): Promise<PromptVersion> {
    await this.#validateVersion(input);
    return this.#versions.create(input);
  }
  async updateVersion(id: EntityId, patch: UpdateEntityInput<PromptVersion>): Promise<PromptVersion> {
    const current = await this.#versions.require(id);
    await this.#validateVersion({ ...current, ...patch });
    return this.#versions.update(id, patch);
  }
  getVersion(id: EntityId) { return this.#versions.get(id); }
  deleteVersion(id: EntityId) { return this.#versions.delete(id); }
  async listVersionsBySpec(promptSpecId: EntityId): Promise<readonly PromptVersion[]> {
    const versions = await this.#versions.query((item) => item.promptSpecId === promptSpecId);
    return [...versions].sort((left, right) => left.version - right.version);
  }
}
