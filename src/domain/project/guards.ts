import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import {
  PROJECT_OUTPUT_TYPES,
  PROJECT_STAGES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type Project,
  type ProjectBrief,
  type ProjectOutputType,
  type ProjectStage,
  type ProjectStatus,
  type ProjectType,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function hasEntityFields(value: Record<string, unknown>): boolean {
  return (
    isEntityId(value.id) &&
    isIsoTimestamp(value.createdAt) &&
    isIsoTimestamp(value.updatedAt)
  );
}

function hasValidSettings(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.locale === "zh-CN" &&
    isNonEmptyString(value.timezone) &&
    (value.colorMode === undefined ||
      value.colorMode === "dark" ||
      value.colorMode === "light" ||
      value.colorMode === "system")
  );
}

export function isProject(value: unknown): value is Project {
  if (!isRecord(value) || "brief" in value) {
    return false;
  }
  return (
    hasEntityFields(value) &&
    isNonEmptyString(value.name) &&
    (value.description === undefined || isNonEmptyString(value.description)) &&
    isEnumValue<ProjectType>(PROJECT_TYPES, value.type) &&
    isEnumValue<ProjectStatus>(PROJECT_STATUSES, value.status) &&
    isEnumValue<ProjectStage>(PROJECT_STAGES, value.stage) &&
    Array.isArray(value.outputTypes) &&
    value.outputTypes.length > 0 &&
    value.outputTypes.every((item) =>
      isEnumValue<ProjectOutputType>(PROJECT_OUTPUT_TYPES, item),
    ) &&
    hasValidSettings(value.settings) &&
    typeof value.schemaVersion === "number" &&
    Number.isInteger(value.schemaVersion) &&
    value.schemaVersion > 0
  );
}

export function isProjectBrief(value: unknown): value is ProjectBrief {
  if (!isRecord(value)) {
    return false;
  }
  return (
    hasEntityFields(value) &&
    isEntityId(value.projectId) &&
    isNonEmptyString(value.goal) &&
    isNonEmptyString(value.audience) &&
    isNonEmptyString(value.context) &&
    isStringArray(value.deliverables) &&
    isStringArray(value.constraints) &&
    (value.keywords === undefined || isStringArray(value.keywords)) &&
    (value.avoid === undefined || isStringArray(value.avoid))
  );
}
