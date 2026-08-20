import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { TEMPLATE_STATUSES, type ProjectTemplate } from "./types.js";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isProjectTemplate(value: unknown): value is ProjectTemplate {
  if (!isRecord(value)) return false;
  const item = value;
  return isEntityId(item.id) && isIsoTimestamp(item.createdAt) && isIsoTimestamp(item.updatedAt) && typeof item.name === "string" && item.name.trim().length > 0 && TEMPLATE_STATUSES.some((status) => status === item.status) && typeof item.strategy === "object" && item.strategy !== null && !Array.isArray(item.strategy) && Object.keys(item.strategy).length === 0 && typeof item.schemaVersion === "number" && Number.isInteger(item.schemaVersion) && item.schemaVersion > 0;
}
