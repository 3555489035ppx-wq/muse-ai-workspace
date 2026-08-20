import React from "react";
import type { Asset } from "../../domain/asset/index.js";
import type { MoodboardItem } from "../../domain/moodboard/index.js";

export interface MoodboardGridItem { readonly item: MoodboardItem; readonly asset?: Asset; }
const previewAssets = ["heritage-research", "cultural-brand", "museum-digital", "exhibition-identity", "public-art", "editorial-series", "brand-visual-system", "emerging-consumer", "sustainable-brand", "personal-studio", "campaign-key-visual", "city-event", "festival-campaign", "campus-event", "product-launch", "knowledge-column", "creator-ip", "social-series", "tech-brand", "ai-product", "app-concept", "data-workbench", "public-welfare", "service-platform"] as const;
export function resolveMoodboardPreview(asset: Asset | undefined, index: number): string | undefined {
  if (asset === undefined) return undefined;
  const hash = [...asset.name].reduce((total, character) => total + (character.codePointAt(0) ?? 0), index);
  return `/assets/templates/${previewAssets[hash % previewAssets.length]}.webp`;
}
export interface MoodboardLayout { readonly columns: number; readonly cardWidth: number; readonly rows: number; readonly contentHeight: number; readonly overflowsHorizontally: false; }
export function calculateMoodboardLayout(itemCount: number, containerWidth: number, minimumCardWidth = 240, gap = 16): MoodboardLayout {
  const safeWidth = Math.max(minimumCardWidth, containerWidth);
  const columns = Math.max(1, Math.floor((safeWidth + gap) / (minimumCardWidth + gap)));
  const cardWidth = Math.floor((safeWidth - gap * (columns - 1)) / columns);
  const rows = Math.ceil(Math.max(0, itemCount) / columns);
  return { columns, cardWidth, rows, contentHeight: rows === 0 ? 0 : rows * 280 + (rows - 1) * gap, overflowsHorizontally: false };
}
export function MoodboardGrid({ items, selected = new Set(), onSelect, onOpen }: { readonly items: readonly MoodboardGridItem[]; readonly selected?: ReadonlySet<string>; readonly onSelect?: (item: MoodboardGridItem, multi: boolean) => void; readonly onOpen?: (index: number) => void }) {
  return <div className="moodboard-grid" data-count={items.length}>{items.map(({ item, asset }, index) => { const preview = resolveMoodboardPreview(asset, index); return <article className="moodboard-grid__card" key={item.id} data-selected={selected.has(item.id)}><button className="moodboard-grid__image" aria-label={asset ? `选择${asset.name}` : "素材缺失"} onClick={(event) => onSelect?.({ item, asset }, event.metaKey || event.ctrlKey)} onDoubleClick={() => onOpen?.(index)}>{preview ? <img src={preview} alt={asset?.name ?? "情绪板素材"} /> : <span>素材缺失</span>}<span>{asset?.name ?? "素材缺失"}</span></button><div><strong>{item.role === "hero" ? "核心图像" : item.role === "texture" ? "材质参考" : item.role === "typography" ? "字体参考" : item.role === "color" ? "色彩参考" : "参考素材"}</strong>{item.note ? <p>{item.note}</p> : null}</div></article>; })}</div>;
}
