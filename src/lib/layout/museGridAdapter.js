export function templateLayouts(templates, columns = 12) {
  const width = Math.max(3, Math.floor(columns / 4));
  return templates.map((template, index) => ({
    i: template.id,
    x: (index * width) % columns,
    y: Math.floor((index * width) / columns) * 7,
    w: width,
    h: 7,
    minW: 3,
    minH: 7,
  }));
}

export function reorderByIds(items, orderedIds) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => byId.get(id)).filter(Boolean);
}
