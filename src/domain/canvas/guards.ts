import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { CANVAS_NODE_ENTITY_TYPES, type Canvas, type CanvasEdge, type CanvasNode, type CanvasViewport } from "./types.js";
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function base(value: Record<string, unknown>): boolean { return isEntityId(value.id) && isEntityId(value.projectId) && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt); }
export function isCanvas(value: unknown): value is Canvas { return record(value) && base(value) && text(value.name); }
export function isCanvasNode(value: unknown): value is CanvasNode { return record(value) && base(value) && isEntityId(value.canvasId) && isEntityId(value.entityId) && CANVAS_NODE_ENTITY_TYPES.some((type) => type === value.entityType) && record(value.position) && finite(value.position.x) && finite(value.position.y); }
export function isCanvasEdge(value: unknown): value is CanvasEdge { return record(value) && base(value) && isEntityId(value.canvasId) && isEntityId(value.sourceNodeId) && isEntityId(value.targetNodeId) && value.sourceNodeId !== value.targetNodeId && (value.label === undefined || text(value.label)); }
export function isCanvasViewport(value: unknown): value is CanvasViewport { return record(value) && base(value) && isEntityId(value.canvasId) && finite(value.x) && finite(value.y) && finite(value.zoom) && value.zoom > 0; }
