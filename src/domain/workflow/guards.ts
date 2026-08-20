import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { ASYNC_TASK_STATUSES, OPERATION_STATES, WORKFLOW_STATES, type AsyncTask, type Operation, type WorkflowRun } from "./types.js";
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function base(value: Record<string, unknown>): boolean { return isEntityId(value.id) && isEntityId(value.projectId) && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt); }
export function isWorkflowRun(value: unknown): value is WorkflowRun { return record(value) && base(value) && isEntityId(value.entityId) && text(value.entityType) && WORKFLOW_STATES.some((state) => state === value.state); }
export function isOperation(value: unknown): value is Operation { return record(value) && base(value) && text(value.kind) && OPERATION_STATES.some((state) => state === value.state) && (value.targetEntityId === undefined || isEntityId(value.targetEntityId)); }
export function isAsyncTask(value: unknown): value is AsyncTask { return record(value) && base(value) && isEntityId(value.operationId) && ASYNC_TASK_STATUSES.some((status) => status === value.status) && (value.errorCode === undefined || text(value.errorCode)); }
