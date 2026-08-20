import type { ProjectScopedEntity } from "../shared/entity.js";
import type { EntityId } from "../shared/id.js";
export const WORKFLOW_STATES = ["idle", "ready", "running", "completed", "failed", "cancelled"] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number] & { readonly __workflowState: unique symbol };
export const OPERATION_STATES = ["idle", "pending", "success", "error"] as const;
export type OperationState = (typeof OPERATION_STATES)[number] & { readonly __operationState: unique symbol };
export const ASYNC_TASK_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type AsyncTaskStatus = (typeof ASYNC_TASK_STATUSES)[number];
export interface WorkflowRun extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: string; readonly state: WorkflowState; }
export interface Operation extends ProjectScopedEntity { readonly kind: string; readonly state: OperationState; readonly targetEntityId?: EntityId; }
export interface AsyncTask extends ProjectScopedEntity { readonly operationId: EntityId; readonly status: AsyncTaskStatus; readonly errorCode?: string; }
