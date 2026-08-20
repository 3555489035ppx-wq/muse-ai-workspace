import { DomainError } from "./domainError.js";

export class EntityNotFoundError extends DomainError {
  constructor(entityType: string, entityId: string) {
    super("ENTITY_NOT_FOUND", `${entityType} was not found.`, {
      entityId,
      entityType,
    });
  }
}

export class ProjectScopeViolationError extends DomainError {
  constructor(expectedProjectId: string, actualProjectId: string, entityId: string) {
    super("PROJECT_SCOPE_VIOLATION", "Entity belongs to another project.", {
      actualProjectId,
      entityId,
      expectedProjectId,
    });
  }
}

export class ParentEntityMismatchError extends DomainError {
  constructor(parentType: string, parentId: string, projectId: string) {
    super("PARENT_ENTITY_MISMATCH", "Parent relationship is invalid.", {
      parentId,
      parentType,
      projectId,
    });
  }
}

export class ReferentialIntegrityError extends DomainError {
  constructor(entityId: string, referencingEntityIds: readonly string[]) {
    super("REFERENTIAL_INTEGRITY", "Entity is still referenced.", {
      entityId,
      referencingEntityIds: [...referencingEntityIds],
    });
  }
}

export class DuplicateEntityError extends DomainError {
  constructor(entityType: string, entityId: string) {
    super("DUPLICATE_ENTITY", `${entityType} already exists.`, {
      entityId,
      entityType,
    });
  }
}

export class InvalidEntityIdError extends DomainError {
  constructor(value: unknown) {
    super("INVALID_ENTITY_ID", "Entity ID must be a UUID.", { value });
  }
}

export class UuidGenerationError extends DomainError {
  constructor(reason: "unavailable" | "invalid") {
    super("UUID_GENERATION_FAILED", "A secure UUID could not be generated.", {
      reason,
    });
  }
}
