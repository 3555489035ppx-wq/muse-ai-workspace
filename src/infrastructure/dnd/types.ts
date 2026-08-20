import type { UniqueIdentifier } from "@dnd-kit/core";

export const DRAG_PAYLOAD_KINDS = ["item", "container"] as const;
export type DragPayloadKind = (typeof DRAG_PAYLOAD_KINDS)[number];

export interface DragPayload {
  readonly kind: DragPayloadKind;
  readonly id: UniqueIdentifier;
  readonly containerId?: UniqueIdentifier;
}

export interface TypedDragResult {
  readonly active: DragPayload;
  readonly over?: DragPayload;
}
