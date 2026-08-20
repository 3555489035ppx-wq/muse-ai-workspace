import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const MOODBOARD_STATUSES = ["draft", "curated"] as const;
export type MoodboardStatus = (typeof MOODBOARD_STATUSES)[number];

export const MOODBOARD_ITEM_ROLES = [
  "hero",
  "reference",
  "texture",
  "typography",
  "color",
] as const;
export type MoodboardItemRole = (typeof MOODBOARD_ITEM_ROLES)[number];

export interface Moodboard extends ProjectScopedEntity {
  readonly researchSessionId: EntityId;
  readonly title: string;
  readonly status: MoodboardStatus;
}

export interface MoodboardItem extends ProjectScopedEntity {
  readonly moodboardId: EntityId;
  readonly assetId: EntityId;
  readonly role: MoodboardItemRole;
  readonly position: number;
  readonly note?: string;
}

export interface VisualColor {
  readonly hex: string;
  readonly role: string;
}

export interface VisualDNA extends ProjectScopedEntity {
  readonly moodboardId: EntityId;
  readonly keywords: readonly string[];
  readonly colorPalette: readonly VisualColor[];
  readonly composition: readonly string[];
  readonly imagery: readonly string[];
  readonly typography?: readonly string[];
  readonly materials?: readonly string[];
}
