import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { VERSION_ENTITY_TYPES, type VersionSnapshot } from "./types.js";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isVersionSnapshot(value: unknown): value is VersionSnapshot {
  if (!isRecord(value)) return false;
  const item = value;
  return isEntityId(item.id) && isEntityId(item.projectId) && isIsoTimestamp(item.createdAt) && isIsoTimestamp(item.updatedAt) && (item.parentVersionId === undefined || isEntityId(item.parentVersionId)) && VERSION_ENTITY_TYPES.some((type) => type === item.entityType) && isEntityId(item.entityId) && typeof item.schemaVersion === "number" && Number.isInteger(item.schemaVersion) && item.schemaVersion > 0 && typeof item.label === "string" && item.label.trim().length > 0 && typeof item.snapshot === "object" && item.snapshot !== null && !Array.isArray(item.snapshot);
}
