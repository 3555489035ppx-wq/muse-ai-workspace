import type { Entity } from "../shared/entity.js";

export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];
export type TemplateStrategy = Readonly<Record<string, never>>;
export interface ProjectTemplate extends Entity {
  readonly name: string;
  readonly status: TemplateStatus;
  readonly strategy: TemplateStrategy;
  readonly schemaVersion: number;
}
