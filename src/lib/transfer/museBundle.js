import { z } from 'zod';
import { db } from '../database.js';

export const MUSE_BUNDLE_FORMAT = 'muse-creative-workspace';

const recordSchema = z.record(z.string(), z.unknown());
const bundleSchema = z.object({
  format: z.literal(MUSE_BUNDLE_FORMAT),
  version: z.number().int().min(1).max(1),
  exportedAt: z.string(),
  scope: z.object({ type: z.enum(['workspace', 'project']), projectId: z.string().nullable() }),
  data: z.record(z.string(), z.array(recordSchema)),
});

const transferTables = [
  'projects', 'briefs', 'assets', 'moodboardItems', 'analyses', 'directions', 'explorations',
  'critiques', 'versions', 'canvas', 'researchItems', 'workflowRuns', 'versionEdges',
  'templates', 'templateFavorites', 'directionLibrary', 'preferences',
];

export async function createMuseBundle(projectId = null) {
  const data = {};
  for (const tableName of transferTables) {
    const table = db.table(tableName);
    const records = await table.toArray();
    data[tableName] = projectId
      ? records.filter((record) => record.projectId === projectId || (tableName === 'projects' && record.id === projectId))
      : records;
  }
  return { format: MUSE_BUNDLE_FORMAT, version: 1, exportedAt: new Date().toISOString(), scope: { type: projectId ? 'project' : 'workspace', projectId }, data };
}

export function validateMuseBundle(input) {
  const result = bundleSchema.safeParse(input);
  if (!result.success) return { ok: false, issues: result.error.issues.map((issue) => issue.message) };
  // Legacy bundles may contain the old browser-side providerConfigs table. It is
  // intentionally ignored during import so a historical export can never move
  // a secret back into the browser or another project file.
  const ignoredLegacy = new Set(['providerConfigs']);
  const unexpected = Object.keys(result.data.data).filter((name) => !transferTables.includes(name) && !ignoredLegacy.has(name));
  if (unexpected.length) return { ok: false, issues: [`包含不支持的数据表：${unexpected.join('、')}`] };
  return { ok: true, bundle: result.data };
}

export async function importMuseBundle(bundle, strategy = 'skip') {
  const parsed = validateMuseBundle(bundle);
  if (!parsed.ok) throw new Error(parsed.issues.join('；'));
  const entries = Object.entries(parsed.bundle.data).filter(([name]) => transferTables.includes(name));
  let imported = 0; let skipped = 0;
  await db.transaction('rw', entries.map(([name]) => db.table(name)), async () => {
    for (const [name, records] of entries) {
      const table = db.table(name);
      if (strategy === 'overwrite') {
        await table.bulkPut(records); imported += records.length; continue;
      }
      const keyPath = table.schema.primKey.keyPath;
      for (const record of records) {
        const key = typeof keyPath === 'string' ? record[keyPath] : null;
        if (key != null && await table.get(key)) { skipped += 1; continue; }
        await table.add(record); imported += 1;
      }
    }
  });
  return { imported, skipped };
}

export function downloadJson(bundle, filename) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
