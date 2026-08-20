import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import {
  PROMPT_ADAPTER_TARGETS,
  type PromptSpec,
  type PromptVersion,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function hasBase(value: Record<string, unknown>): boolean {
  return isEntityId(value.id) && isEntityId(value.projectId) && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt);
}
function hasLineage(value: Record<string, unknown>): boolean {
  return isEntityId(value.explorationId) && isEntityId(value.directionId) && isEntityId(value.visualDNAId) && isEntityId(value.researchSessionId);
}
function hasTarget(value: unknown): boolean {
  return PROMPT_ADAPTER_TARGETS.some((target) => target === value);
}

export function isPromptSpec(value: unknown): value is PromptSpec {
  return isRecord(value) && hasBase(value) && hasLineage(value) && hasTarget(value.adapterTarget) && isText(value.objective) && Array.isArray(value.constraints) && value.constraints.every(isText);
}

export function isPromptVersion(value: unknown): value is PromptVersion {
  return isRecord(value) && hasBase(value) && hasLineage(value) && isEntityId(value.promptSpecId) && hasTarget(value.adapterTarget) && typeof value.version === "number" && Number.isInteger(value.version) && value.version > 0 && isText(value.promptText) && (value.negativePrompt === undefined || isText(value.negativePrompt));
}
