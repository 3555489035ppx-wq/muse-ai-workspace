import Fuse from 'fuse.js';

export function searchRecords(records, query, keys, options = {}) {
  const normalized = query.trim();
  if (!normalized) return records;
  const fuse = new Fuse(records, {
    keys,
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true,
    ...options,
  });
  return fuse.search(normalized).map((result) => result.item);
}
