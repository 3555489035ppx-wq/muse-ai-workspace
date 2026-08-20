import type { Table } from "dexie";
import type { Project } from "../domain/project/index.js";
import { EntityNotFoundError, ParentEntityMismatchError } from "../domain/errors/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { VersionEntityType, VersionSnapshot } from "../domain/version/index.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type { CreateEntityInput, RepositoryClock } from "./base/types.js";
import { requireParent } from "./base/validators.js";

const ENTITY_TABLES: Readonly<Partial<Record<VersionEntityType, string>>> = {
  brief: "briefs", direction: "directions", exploration: "explorations", generated_asset: "generatedAssets", canvas: "canvases",
};

export class VersionRepository {
  readonly #database: MuseDatabase;
  readonly #projects: Table<Project, EntityId>;
  readonly #snapshotsTable: Table<VersionSnapshot, EntityId>;
  readonly #snapshots: BaseRepository<VersionSnapshot>;
  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#database = database;
    this.#projects = database.table("projects");
    this.#snapshotsTable = database.table("versionSnapshots");
    this.#snapshots = new BaseRepository(this.#snapshotsTable, "VersionSnapshot", clock);
  }
  async #validate(input: CreateEntityInput<VersionSnapshot>): Promise<void> {
    if ((await this.#projects.get(input.projectId)) === undefined) throw new EntityNotFoundError("Project", input.projectId);
    if (input.entityType === "project") {
      if (input.entityId !== input.projectId) throw new ParentEntityMismatchError("Project", input.entityId, input.projectId);
    } else {
      const tableName = ENTITY_TABLES[input.entityType];
      if (tableName === undefined) throw new ParentEntityMismatchError("SnapshotEntity", input.entityId, input.projectId);
      await requireParent(this.#database.table(tableName), input.entityId, input.projectId, input.entityType);
    }
    if (input.parentVersionId !== undefined) {
      const parent = await requireParent(this.#snapshotsTable, input.parentVersionId, input.projectId, "VersionSnapshot");
      if (parent.entityId !== input.entityId || parent.entityType !== input.entityType) throw new ParentEntityMismatchError("VersionSnapshot", parent.id, input.projectId);
    }
  }
  async create(input: CreateEntityInput<VersionSnapshot>): Promise<VersionSnapshot> { await this.#validate(input); return this.#snapshots.create(input); }
  get(id: EntityId) { return this.#snapshots.get(id); }
  listByEntity(projectId: ProjectId, entityId: EntityId) { return this.#snapshots.query((item) => item.projectId === projectId && item.entityId === entityId); }
}
