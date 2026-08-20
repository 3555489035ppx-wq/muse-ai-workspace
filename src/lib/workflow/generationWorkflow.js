import { produce } from 'immer';

export const workflowStatus = Object.freeze({
  IDLE: 'idle', QUEUED: 'queued', RUNNING: 'running', SUCCEEDED: 'succeeded', FAILED: 'failed', CANCELLED: 'cancelled',
});

export function createWorkflowRun({ id, projectId, workflowId, provider = 'mock' }) {
  const timestamp = new Date().toISOString();
  return { id, projectId, workflowId, provider, status: workflowStatus.IDLE, currentNodeId: null, progress: 0, events: [], outputs: [], createdAt: timestamp, updatedAt: timestamp };
}

export function reduceWorkflowRun(run, event) {
  return produce(run, (draft) => {
    draft.events.push({ ...event, at: event.at ?? new Date().toISOString() });
    draft.updatedAt = new Date().toISOString();
    if (event.type === 'queued') draft.status = workflowStatus.QUEUED;
    if (event.type === 'node-started') { draft.status = workflowStatus.RUNNING; draft.currentNodeId = event.nodeId; }
    if (event.type === 'progress') draft.progress = Math.max(0, Math.min(100, event.value));
    if (event.type === 'output') draft.outputs.push(event.output);
    if (event.type === 'completed') { draft.status = workflowStatus.SUCCEEDED; draft.currentNodeId = null; draft.progress = 100; }
    if (event.type === 'failed') { draft.status = workflowStatus.FAILED; draft.error = event.error; }
    if (event.type === 'cancelled') draft.status = workflowStatus.CANCELLED;
  });
}

export function comfyMessageToWorkflowEvent(message) {
  const data = message.data ?? {};
  if (message.type === 'executing' && data.node) return { type: 'node-started', nodeId: data.node };
  if (message.type === 'progress') return { type: 'progress', value: data.max ? Math.round((data.value / data.max) * 100) : 0 };
  if (message.type === 'executed') return { type: 'output', output: data.output, nodeId: data.node };
  if (message.type === 'execution_error') return { type: 'failed', error: data.exception_message ?? '本地图像工作流执行失败' };
  if (message.type === 'executing' && data.node == null) return { type: 'completed' };
  return { type: 'provider-event', payload: message };
}
