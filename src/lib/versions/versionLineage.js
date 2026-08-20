import { create } from 'jsondiffpatch';

const differ = create({ objectHash: (object) => object?.id ?? JSON.stringify(object) });

export function compareVersionSnapshots(before, after) {
  return differ.diff(before ?? {}, after ?? {}) ?? {};
}
export function buildVersionLineage(versions) {
  const nodes = versions.map((version) => ({
    id: version.id,
    type: 'version',
    position: version.position ?? { x: Math.max(0, (version.number - 1) * 230), y: version.branchOffset ?? 0 },
    data: { label: `V${version.number}`, summary: version.changeSummary, createdAt: version.createdAt },
  }));
  const edges = versions.filter((version) => version.parentVersionId).map((version) => ({
    id: `${version.parentVersionId}->${version.id}`,
    source: version.parentVersionId,
    target: version.id,
    animated: version.status === 'generating',
  }));
  return { nodes, edges };
}

export function getVersionAncestors(versions, versionId) {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const ancestors = [];
  let current = byId.get(versionId);
  while (current?.parentVersionId) {
    current = byId.get(current.parentVersionId);
    if (!current) break;
    ancestors.push(current);
  }
  return ancestors;
}
