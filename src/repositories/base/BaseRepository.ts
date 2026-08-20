import type { Table } from "dexie";

import {
  DuplicateEntityError,
  EntityNotFoundError,
} from "../../domain/errors/index.js";
import type { Entity } from "../../domain/shared/entity.js";
import type { EntityId } from "../../domain/shared/id.js";
import { createTimestamps, touchTimestamps } from "../../domain/shared/time.js";
import type {
  CreateEntityInput,
  RepositoryClock,
  UpdateEntityInput,
} from "./types.js";

export class BaseRepository<T extends Entity> {
  protected readonly table: Table<T, EntityId>;
  readonly #entityType: string;
  readonly #clock: RepositoryClock;

  constructor(
    table: Table<T, EntityId>,
    entityType: string,
    clock: RepositoryClock = () => new Date(),
  ) {
    this.table = table;
    this.#entityType = entityType;
    this.#clock = clock;
  }

  async create(input: CreateEntityInput<T>): Promise<T> {
    if ((await this.table.get(input.id)) !== undefined) {
      throw new DuplicateEntityError(this.#entityType, input.id);
    }
    const entity = {
      ...input,
      ...createTimestamps(this.#clock()),
    } as T;
    await this.table.add(entity);
    return entity;
  }

  async get(id: EntityId): Promise<T | undefined> {
    return this.table.get(id);
  }

  async require(id: EntityId): Promise<T> {
    const entity = await this.get(id);
    if (entity === undefined) {
      throw new EntityNotFoundError(this.#entityType, id);
    }
    return entity;
  }

  async update(id: EntityId, patch: UpdateEntityInput<T>): Promise<T> {
    const current = await this.require(id);
    const timestamps = touchTimestamps(current, this.#clock());
    const updated = {
      ...current,
      ...patch,
      id: current.id,
      ...timestamps,
    };
    await this.table.put(updated);
    return updated;
  }

  async delete(id: EntityId): Promise<void> {
    await this.require(id);
    await this.table.delete(id);
  }

  async list(): Promise<readonly T[]> {
    return this.table.toArray();
  }

  async query(predicate: (entity: T) => boolean): Promise<readonly T[]> {
    return (await this.list()).filter(predicate);
  }
}
