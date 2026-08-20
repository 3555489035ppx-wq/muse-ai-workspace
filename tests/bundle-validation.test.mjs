import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSE_BUNDLE_FORMAT, validateMuseBundle } from '../src/lib/transfer/museBundle.js';

test('Muse import accepts the current schema and rejects unknown tables', () => {
  const base = { format: MUSE_BUNDLE_FORMAT, version: 1, exportedAt: new Date().toISOString(), scope: { type: 'project', projectId: 'p1' }, data: { projects: [{ id: 'p1', name: '测试项目' }], briefs: [] } };
  assert.equal(validateMuseBundle(base).ok, true);
  assert.equal(validateMuseBundle({ ...base, data: { ...base.data, unknown: [] } }).ok, false);
  assert.equal(validateMuseBundle({ ...base, version: 2 }).ok, false);
});
