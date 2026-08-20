import type { Entity } from "../../domain/shared/entity.js";

export type CreateEntityInput<T extends Entity> = Omit<
  T,
  "createdAt" | "updatedAt"
>;

export type UpdateEntityInput<T extends Entity> = Partial<
  Omit<T, "id" | "createdAt" | "updatedAt">
>;

export type RepositoryClock = () => Date;
