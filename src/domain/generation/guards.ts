import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { PROMPT_ADAPTER_TARGETS } from "../prompt/types.js";
import {
  GENERATION_JOB_STATUSES,
  IMAGE_EDIT_TYPES,
  type GeneratedAsset,
  type GenerationJob,
  type ImageEdit,
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
function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isGenerationJob(value: unknown): value is GenerationJob {
  return isRecord(value) && hasBase(value) && isEntityId(value.promptVersionId) && PROMPT_ADAPTER_TARGETS.some((target) => target === value.adapterTarget) && GENERATION_JOB_STATUSES.some((status) => status === value.status) && (value.errorCode === undefined || isText(value.errorCode));
}

export function isGeneratedAsset(value: unknown): value is GeneratedAsset {
  return isRecord(value) && hasBase(value) && isEntityId(value.generationJobId) && isEntityId(value.promptVersionId) && isEntityId(value.assetId) && isText(value.mimeType) && isPositiveInteger(value.width) && isPositiveInteger(value.height) && (value.seed === undefined || isText(value.seed));
}

export function isImageEdit(value: unknown): value is ImageEdit {
  return isRecord(value) && hasBase(value) && isEntityId(value.generatedAssetId) && isEntityId(value.sourceAssetId) && isEntityId(value.promptVersionId) && IMAGE_EDIT_TYPES.some((type) => type === value.type) && isText(value.instruction);
}
