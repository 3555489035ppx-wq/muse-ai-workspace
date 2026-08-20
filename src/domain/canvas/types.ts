import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";
export const CANVAS_NODE_ENTITY_TYPES = ["brief", "research", "insight", "opportunity", "moodboard", "direction", "exploration", "prompt", "asset", "generated_asset", "review", "version"] as const;
export type CanvasNodeEntityType = (typeof CANVAS_NODE_ENTITY_TYPES)[number];
export interface Canvas extends ProjectScopedEntity { readonly name: string; }
export interface CanvasPosition { readonly x: number; readonly y: number; }
export interface CanvasNode extends ProjectScopedEntity { readonly canvasId: EntityId; readonly entityId: EntityId; readonly entityType: CanvasNodeEntityType; readonly position: CanvasPosition; }
export interface CanvasEdge extends ProjectScopedEntity { readonly canvasId: EntityId; readonly sourceNodeId: EntityId; readonly targetNodeId: EntityId; readonly label?: string; }
export interface CanvasViewport extends ProjectScopedEntity { readonly canvasId: EntityId; readonly x: number; readonly y: number; readonly zoom: number; }
