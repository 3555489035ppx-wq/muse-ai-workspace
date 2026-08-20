import {
  InvalidEntityIdError,
  UuidGenerationError,
} from "../errors/entityErrors.js";

declare const entityIdBrand: unique symbol;
declare const projectIdBrand: unique symbol;

export type EntityId = string & { readonly [entityIdBrand]: true };
export type ProjectId = EntityId & { readonly [projectIdBrand]: true };

interface UuidSource {
  randomUUID(): string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEntityId(value: unknown): value is EntityId {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function asEntityId(value: unknown): EntityId {
  if (!isEntityId(value)) {
    throw new InvalidEntityIdError(value);
  }
  return value;
}

export function asProjectId(value: unknown): ProjectId {
  return asEntityId(value) as ProjectId;
}

export function createEntityId(
  source: UuidSource | null = globalThis.crypto,
): EntityId {
  if (source === null || typeof source.randomUUID !== "function") {
    throw new UuidGenerationError("unavailable");
  }

  const value = source.randomUUID();
  if (!isEntityId(value)) {
    throw new UuidGenerationError("invalid");
  }
  return value;
}

export function createProjectId(source?: UuidSource | null): ProjectId {
  return createEntityId(source) as ProjectId;
}
