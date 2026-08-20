import type { Table } from "dexie";

import {
  EntityNotFoundError,
  ParentEntityMismatchError,
  ProjectScopeViolationError,
} from "../../domain/errors/index.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import type { EntityId, ProjectId } from "../../domain/shared/id.js";

export function assertProjectScope(
  entity: ProjectScopedEntity,
  expectedProjectId: ProjectId,
): void {
  if (entity.projectId !== expectedProjectId) {
    throw new ProjectScopeViolationError(
      expectedProjectId,
      entity.projectId,
      entity.id,
    );
  }
}

export async function requireParent<T extends ProjectScopedEntity>(
  table: Table<T, EntityId>,
  parentId: EntityId,
  expectedProjectId: ProjectId,
  parentType: string,
): Promise<T> {
  const parent = await table.get(parentId);
  if (parent === undefined) {
    throw new EntityNotFoundError(parentType, parentId);
  }
  if (parent.projectId !== expectedProjectId) {
    throw new ParentEntityMismatchError(parentType, parentId, expectedProjectId);
  }
  return parent;
}
