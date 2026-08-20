import type { Project, ProjectStage, ProjectStatus } from "../domain/project/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type {
  CreateEntityInput,
  RepositoryClock,
  UpdateEntityInput,
} from "./base/types.js";

export class ProjectRepository {
  readonly #base: BaseRepository<Project>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#base = new BaseRepository(
      database.table<Project, EntityId>("projects"),
      "Project",
      clock,
    );
  }

  create(input: CreateEntityInput<Project>): Promise<Project> {
    return this.#base.create(input);
  }

  get(id: ProjectId): Promise<Project | undefined> {
    return this.#base.get(id);
  }

  require(id: ProjectId): Promise<Project> {
    return this.#base.require(id);
  }

  update(id: ProjectId, patch: UpdateEntityInput<Project>): Promise<Project> {
    return this.#base.update(id, patch);
  }

  delete(id: ProjectId): Promise<void> {
    return this.#base.delete(id);
  }

  list(): Promise<readonly Project[]> {
    return this.#base.list();
  }

  findByStatus(status: ProjectStatus): Promise<readonly Project[]> {
    return this.#base.query((project) => project.status === status);
  }

  findByStage(stage: ProjectStage): Promise<readonly Project[]> {
    return this.#base.query((project) => project.stage === stage);
  }

  findBySchemaVersion(schemaVersion: number): Promise<readonly Project[]> {
    return this.#base.query(
      (project) => project.schemaVersion === schemaVersion,
    );
  }
}
