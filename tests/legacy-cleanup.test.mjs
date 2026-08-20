import test from 'node:test';
import assert from 'node:assert/strict';
import { isConfirmedLegacySeed } from '../src/lib/migrations/legacySeedCleanup.js';

test('legacy seed cleanup requires project, brief, and asset evidence together', () => {
  const project = { id: 'p1', name: '春见｜青年茶饮春季快闪视觉' };
  const brief = { projectId: 'p1', requirement: '为春见茶饮创建春季视觉' };
  const assets = [{ projectId: 'p1', source: 'Muse 原创演示素材' }];
  assert.equal(isConfirmedLegacySeed(project, brief, assets), true);
  assert.equal(isConfirmedLegacySeed({ ...project, name: '用户自己的春见项目' }, brief, assets), false);
  assert.equal(isConfirmedLegacySeed(project, { ...brief, requirement: '用户自建项目' }, assets), false);
  assert.equal(isConfirmedLegacySeed(project, brief, [{ projectId: 'p1', source: '用户上传' }]), false);
});
