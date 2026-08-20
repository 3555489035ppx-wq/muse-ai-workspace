import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import {
  MOODBOARD_ITEM_ROLES,
  MOODBOARD_STATUSES,
  type Moodboard,
  type MoodboardItem,
  type VisualColor,
  type VisualDNA,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasBase(value: Record<string, unknown>): boolean {
  return (
    isEntityId(value.id) &&
    isEntityId(value.projectId) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

function isTextList(value: unknown, required: boolean): value is readonly string[] {
  return (
    Array.isArray(value) &&
    (!required || value.length > 0) &&
    value.every(isText)
  );
}

function isOptionalTextList(value: unknown): value is readonly string[] | undefined {
  return value === undefined || isTextList(value, false);
}

function isVisualColor(value: unknown): value is VisualColor {
  return (
    isRecord(value) &&
    typeof value.hex === "string" &&
    /^#[0-9a-f]{6}$/i.test(value.hex) &&
    isText(value.role)
  );
}

export function isMoodboard(value: unknown): value is Moodboard {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.researchSessionId) &&
    isText(value.title) &&
    MOODBOARD_STATUSES.some((status) => status === value.status)
  );
}

export function isMoodboardItem(value: unknown): value is MoodboardItem {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.moodboardId) &&
    isEntityId(value.assetId) &&
    MOODBOARD_ITEM_ROLES.some((role) => role === value.role) &&
    typeof value.position === "number" &&
    Number.isInteger(value.position) &&
    value.position >= 0 &&
    (value.note === undefined || isText(value.note))
  );
}

export function isVisualDNA(value: unknown): value is VisualDNA {
  return (
    isRecord(value) &&
    hasBase(value) &&
    isEntityId(value.moodboardId) &&
    isTextList(value.keywords, true) &&
    Array.isArray(value.colorPalette) &&
    value.colorPalette.length > 0 &&
    value.colorPalette.every(isVisualColor) &&
    isTextList(value.composition, true) &&
    isTextList(value.imagery, true) &&
    isOptionalTextList(value.typography) &&
    isOptionalTextList(value.materials)
  );
}
