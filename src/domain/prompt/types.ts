import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";

export const PROMPT_ADAPTER_TARGETS = ["generic_image", "comfyui", "firefly"] as const;
export type PromptAdapterTarget = (typeof PROMPT_ADAPTER_TARGETS)[number];

export interface PromptSpec extends ProjectScopedEntity {
  readonly explorationId: EntityId;
  readonly directionId: EntityId;
  readonly visualDNAId: EntityId;
  readonly researchSessionId: EntityId;
  readonly adapterTarget: PromptAdapterTarget;
  readonly objective: string;
  readonly constraints: readonly string[];
}

export interface PromptVersion extends ProjectScopedEntity {
  readonly promptSpecId: EntityId;
  readonly explorationId: EntityId;
  readonly directionId: EntityId;
  readonly visualDNAId: EntityId;
  readonly researchSessionId: EntityId;
  readonly adapterTarget: PromptAdapterTarget;
  readonly version: number;
  readonly promptText: string;
  readonly negativePrompt?: string;
}
