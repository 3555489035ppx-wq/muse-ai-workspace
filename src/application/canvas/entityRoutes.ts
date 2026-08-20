import type { CanvasNodeEntityType } from "../../domain/canvas/index.js";
import { isEntityId, type EntityId } from "../../domain/shared/id.js";

export type EntityRouteResult = { readonly ok: true; readonly route: string } | { readonly ok: false; readonly reason: "INVALID_PROJECT" | "UNSUPPORTED_TYPE" };
export function getDecisionEntityRoute(projectId: string, entityType: CanvasNodeEntityType, entityId: EntityId): EntityRouteResult {
  if (!isEntityId(projectId)) return { ok: false, reason: "INVALID_PROJECT" };
  const base = `/projects/${projectId}`;
  switch (entityType) {
    case "brief": return { ok: true, route: `${base}/brief` };
    case "research": case "insight": case "opportunity": return { ok: true, route: `${base}/research` };
    case "moodboard": case "asset": return { ok: true, route: `${base}/moodboard` };
    case "direction": return { ok: true, route: `${base}/directions/${entityId}` };
    case "exploration": return { ok: true, route: `${base}/exploration` };
    case "prompt": case "generated_asset": case "review": return { ok: true, route: `${base}/generation` };
    case "version": return { ok: true, route: `${base}/versions` };
    default: return { ok: false, reason: "UNSUPPORTED_TYPE" };
  }
}
