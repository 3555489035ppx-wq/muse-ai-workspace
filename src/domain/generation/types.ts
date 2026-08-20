import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";
import type { PromptAdapterTarget } from "../prompt/types.js";

export const GENERATION_JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export const IMAGE_EDIT_TYPES = ["crop", "remove_background", "inpaint", "outpaint", "color_adjust"] as const;
export type ImageEditType = (typeof IMAGE_EDIT_TYPES)[number];

export interface GenerationJob extends ProjectScopedEntity {
  readonly promptVersionId: EntityId;
  readonly adapterTarget: PromptAdapterTarget;
  readonly status: GenerationJobStatus;
  readonly errorCode?: string;
}

export interface GeneratedAsset extends ProjectScopedEntity {
  readonly generationJobId: EntityId;
  readonly promptVersionId: EntityId;
  readonly assetId: EntityId;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly seed?: string;
  readonly remoteAssetUrl?: string;
  readonly providerId?: string;
  readonly model?: string;
  readonly modelVersion?: string;
  readonly providerRunId?: string;
  readonly estimatedCostCny?: number;
}

export interface ImageEdit extends ProjectScopedEntity {
  readonly generatedAssetId: EntityId;
  readonly sourceAssetId: EntityId;
  readonly promptVersionId: EntityId;
  readonly type: ImageEditType;
  readonly instruction: string;
}
