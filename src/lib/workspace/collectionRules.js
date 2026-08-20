const readField = (document, field) => field.split('.').reduce((value, key) => value?.[key], document);

const includesValue = (actual, expected) => {
  if (Array.isArray(actual)) return actual.some((value) => String(value).toLowerCase() === String(expected).toLowerCase());
  return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
};

export function matchesFilter(document, filter) {
  const actual = readField(document, filter.field);
  switch (filter.operator) {
    case 'equals': return actual === filter.value;
    case 'notEquals': return actual !== filter.value;
    case 'contains': return includesValue(actual, filter.value);
    case 'in': return Array.isArray(filter.value) && filter.value.includes(actual);
    case 'exists': return filter.value ? actual != null : actual == null;
    case 'after': return new Date(actual).getTime() > new Date(filter.value).getTime();
    case 'before': return new Date(actual).getTime() < new Date(filter.value).getTime();
    default: return false;
  }
}
export function matchesCollection(document, collection) {
  if (collection.allowList?.includes(document.id)) return true;
  const filters = collection.rules?.filters ?? [];
  if (!filters.length) return true;
  return (collection.rules?.mode ?? 'and') === 'or'
    ? filters.some((filter) => matchesFilter(document, filter))
    : filters.every((filter) => matchesFilter(document, filter));
}

export function normalizeCollection(input) {
  const timestamp = new Date().toISOString();
  return {
    id: input.id,
    workspaceId: input.workspaceId ?? 'local',
    name: input.name?.trim() || '未命名集合',
    kind: input.kind ?? 'mixed',
    rules: { mode: input.rules?.mode ?? 'and', filters: input.rules?.filters ?? [] },
    allowList: [...new Set(input.allowList ?? [])],
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}
