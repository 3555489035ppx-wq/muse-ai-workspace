import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCollection, normalizeCollection } from '../src/lib/workspace/collectionRules.js';
import { createWorkflowRun, reduceWorkflowRun, workflowStatus } from '../src/lib/workflow/generationWorkflow.js';
import { buildVersionLineage, compareVersionSnapshots, getVersionAncestors } from '../src/lib/versions/versionLineage.js';
import { ComfyUIProvider } from '../src/lib/ai/ComfyUIProvider.js';

test('AFFiNE-style collections combine rules and explicit allow lists', () => {
  const collection = normalizeCollection({
    id: 'direction-library',
    name: '东方方向库',
    rules: { mode: 'and', filters: [{ field: 'type', operator: 'equals', value: 'direction' }, { field: 'tags', operator: 'contains', value: '东方' }] },
    allowList: ['pinned-reference'],
  });
  assert.equal(matchesCollection({ id: 'a', type: 'direction', tags: ['东方', '留白'] }, collection), true);
  assert.equal(matchesCollection({ id: 'b', type: 'asset', tags: ['东方'] }, collection), false);
  assert.equal(matchesCollection({ id: 'pinned-reference', type: 'asset', tags: [] }, collection), true);
});

test('generation workflow advances through deterministic states', () => {
  const initial = createWorkflowRun({ id: 'run-1', projectId: 'project-1', workflowId: 'workflow-1' });
  const queued = reduceWorkflowRun(initial, { type: 'queued' });
  const running = reduceWorkflowRun(queued, { type: 'node-started', nodeId: 'sampler' });
  const complete = reduceWorkflowRun(running, { type: 'completed' });
  assert.equal(initial.status, workflowStatus.IDLE);
  assert.equal(running.currentNodeId, 'sampler');
  assert.equal(complete.status, workflowStatus.SUCCEEDED);
  assert.equal(complete.progress, 100);
});

test('version lineage creates edges, ancestry, and snapshot deltas', () => {
  const versions = [
    { id: 'v1', number: 1, snapshot: { title: 'A' } },
    { id: 'v2', number: 2, parentVersionId: 'v1', snapshot: { title: 'B' } },
    { id: 'v3', number: 3, parentVersionId: 'v2', snapshot: { title: 'C' } },
  ];
  const lineage = buildVersionLineage(versions);
  assert.equal(lineage.nodes.length, 3);
  assert.deepEqual(lineage.edges.map((edge) => edge.source), ['v1', 'v2']);
  assert.deepEqual(getVersionAncestors(versions, 'v3').map((version) => version.id), ['v2', 'v1']);
  assert.ok(compareVersionSnapshots(versions[0].snapshot, versions[1].snapshot).title);
});

test('ComfyUI adapter sends Muse workflow JSON through the protocol boundary', async () => {
  let request;
  const provider = new ComfyUIProvider({
    baseUrl: 'http://127.0.0.1:8188/',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ prompt_id: 'prompt-1' }) };
    },
    WebSocketImpl: class {},
  });
  const queued = await provider.queuePrompt({ '1': { class_type: 'MuseNode' } }, { clientId: 'muse-client' });
  assert.equal(request.url, 'http://127.0.0.1:8188/prompt');
  assert.equal(JSON.parse(request.options.body).client_id, 'muse-client');
  assert.equal(queued.prompt_id, 'prompt-1');
});
