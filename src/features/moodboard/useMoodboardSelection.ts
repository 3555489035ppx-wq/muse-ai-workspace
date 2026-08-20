import { useState, type Dispatch, type SetStateAction } from "react";
import type { EntityId } from "../../domain/shared/id.js";
export function reduceMoodboardSelection(current: ReadonlySet<EntityId>, id: EntityId, multi: boolean): ReadonlySet<EntityId> {
  if (!multi) return current.size === 1 && current.has(id) ? new Set() : new Set([id]);
  const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
}
export function useMoodboardSelection(): readonly [ReadonlySet<EntityId>, (id: EntityId, multi: boolean) => void, Dispatch<SetStateAction<ReadonlySet<EntityId>>>] {
  const [selection, setSelection] = useState<ReadonlySet<EntityId>>(() => new Set());
  return [selection, (id, multi) => setSelection((current) => reduceMoodboardSelection(current, id, multi)), setSelection] as const;
}
