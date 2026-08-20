import type { Collision, UniqueIdentifier } from "@dnd-kit/core";
import { DRAG_PAYLOAD_KINDS, type DragPayload } from "./types.js";

function isIdentifier(value: unknown): value is UniqueIdentifier {
  return typeof value === "string" || typeof value === "number";
}

export function isDragPayload(value: unknown): value is DragPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return DRAG_PAYLOAD_KINDS.some((kind) => kind === record.kind) && isIdentifier(record.id) && (record.containerId === undefined || isIdentifier(record.containerId));
}

export function reorderItems<T>(items: readonly T[], activeId: UniqueIdentifier, overId: UniqueIdentifier, getId: (item: T) => UniqueIdentifier): readonly T[] {
  const from = items.findIndex((item) => getId(item) === activeId);
  const to = items.findIndex((item) => getId(item) === overId);
  if (from < 0 || to < 0 || from === to) return [...items];
  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  if (moved === undefined) return [...items];
  reordered.splice(to, 0, moved);
  return reordered;
}

export function firstCollisionId(collisions: readonly Collision[] | null): UniqueIdentifier | undefined {
  return collisions?.[0]?.id;
}
