import { DndContext, type DndContextProps, type DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { TypedDragResult } from "./types.js";
import { isDragPayload } from "./utilities.js";

export interface MuseDndContextProps extends Omit<DndContextProps, "children" | "onDragEnd"> {
  readonly children: ReactNode;
  readonly onTypedDragEnd?: (result: TypedDragResult, event: DragEndEvent) => void;
}

export function MuseDndContext({ children, onTypedDragEnd, ...props }: MuseDndContextProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const active = event.active.data.current;
    const over = event.over?.data.current;
    if (!isDragPayload(active) || (over !== undefined && !isDragPayload(over))) return;
    onTypedDragEnd?.({ active, over }, event);
  };

  return <DndContext {...props} onDragEnd={handleDragEnd}>{children}</DndContext>;
}
