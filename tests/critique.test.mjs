import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExploration } from '../src/lib/critique/museCritique.js';

test('critique evaluates six evidence-backed dimensions', () => {
  const result = evaluateExploration({
    brief: { target: '建立清晰的活动识别', audience: '高校学生', deliverables: ['主视觉', '海报'], keywords: ['开放', '年轻'] },
    direction: { concept: '用开放网格组织参与关系', keywords: ['网格', '参与'], risk: '需要避免信息拥挤', strategyIndex: 2 },
    exploration: { prompt: '开放网格、清晰层级、适配校园导视与社交传播' },
    analysis: { assetCount: 8, keywords: ['留白', '绿色'] },
  });
  assert.equal(result.dimensions.length, 6);
  assert.ok(result.total >= 0 && result.total <= 100);
  assert.ok(result.dimensions.every((item) => item.evidence && item.suggestion));
});
