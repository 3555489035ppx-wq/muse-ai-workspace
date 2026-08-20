const LEGACY_PROJECT_NAME = '春见｜青年茶饮春季快闪视觉';
const LEGACY_ASSET_SOURCE = 'Muse 原创演示素材';
export const LEGACY_CLEANUP_MARKER = 'migration.legacy-seed-cleanup.v1';

export function isConfirmedLegacySeed(project, brief, assets = []) {
  const nameMatches = project?.name === LEGACY_PROJECT_NAME;
  const briefMatches = brief?.projectId === project?.id
    && String(brief?.requirement ?? '').includes('春见')
    && String(brief?.requirement ?? '').includes('茶饮');
  const assetMatches = assets.some((asset) => asset.projectId === project?.id && asset.source === LEGACY_ASSET_SOURCE);
  return Boolean(nameMatches && briefMatches && assetMatches);
}

const projectTables = [
  'briefs', 'assets', 'moodboardItems', 'analyses', 'directions', 'explorations',
  'critiques', 'versions', 'researchItems', 'workflowRuns', 'versionEdges',
];

export async function cleanupLegacySeedOnce(db) {
  const marker = await db.preferences.get(LEGACY_CLEANUP_MARKER);
  if (marker?.completedAt) return { removedProjectIds: [], skipped: true };

  const [projects, briefs, assets] = await Promise.all([
    db.projects.toArray(), db.briefs.toArray(), db.assets.toArray(),
  ]);
  const removedProjectIds = projects
    .filter((project) => isConfirmedLegacySeed(project, briefs.find((brief) => brief.projectId === project.id), assets))
    .map((project) => project.id);

  const tables = ['projects', 'canvas', ...projectTables, 'preferences'];
  await db.transaction('rw', tables.map((name) => db.table(name)), async () => {
    for (const projectId of removedProjectIds) {
      await db.projects.delete(projectId);
      await db.canvas.delete(projectId);
      for (const tableName of projectTables) {
        const table = db.table(tableName);
        if (table.schema.indexes.some((index) => index.keyPath === 'projectId')) {
          await table.where('projectId').equals(projectId).delete();
        }
      }
    }
    await db.preferences.put({ id: LEGACY_CLEANUP_MARKER, completedAt: new Date().toISOString(), removedProjectIds, updatedAt: new Date().toISOString() });
  });

  return { removedProjectIds, skipped: false };
}
