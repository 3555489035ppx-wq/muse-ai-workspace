import { DomainError } from "../domain/errors/index.js";
import type { ProjectTemplate } from "../domain/template/index.js";
import type { EntityId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock, UpdateEntityInput } from "./base/types.js";

export class TemplateRepository {
  readonly #templates: BaseRepository<ProjectTemplate>;
  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#templates = new BaseRepository(database.table("templates"), "ProjectTemplate", clock);
  }
  #validate(entity: Pick<ProjectTemplate, "strategy" | "schemaVersion">): void {
    if (Object.keys(entity.strategy).length > 0 || !Number.isInteger(entity.schemaVersion) || entity.schemaVersion < 1) {
      throw new DomainError("INVALID_TEMPLATE", "Phase 0 templates require an empty strategy and positive schemaVersion.");
    }
  }
  create(input: CreateEntityInput<ProjectTemplate>) { this.#validate(input); return this.#templates.create(input); }
  async update(id: EntityId, patch: UpdateEntityInput<ProjectTemplate>): Promise<ProjectTemplate> { const current = await this.#templates.require(id); this.#validate({ ...current, ...patch }); return this.#templates.update(id, patch); }
  get(id: EntityId) { return this.#templates.get(id); }
  delete(id: EntityId) { return this.#templates.delete(id); }
  list() { return this.#templates.list(); }
}
