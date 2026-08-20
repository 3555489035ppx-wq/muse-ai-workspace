import type { Asset } from "../domain/asset/index.js";
import type { EntityId } from "../domain/shared/id.js";
import { requireIsoTimestamp } from "../domain/shared/time.js";
import type { MuseDatabase } from "./database.js";

export interface Phase2DemoAsset extends Asset {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly source: string;
  readonly license: string;
  readonly tags: readonly string[];
  readonly colors: readonly string[];
  readonly favorite: boolean;
}

const previews = [
  "heritage-research.webp", "cultural-brand.webp", "museum-digital.webp", "exhibition-identity.webp",
  "editorial-series.webp", "city-event.webp", "campaign-key-visual.webp", "festival-campaign.webp",
  "brand-visual-system.webp", "emerging-consumer.webp", "personal-studio.webp", "creator-ip.webp",
  "tech-brand.webp", "ai-product.webp", "data-workbench.webp", "app-concept.webp",
  "product-launch.webp", "service-platform.webp", "sustainable-brand.webp", "public-welfare.webp",
  "public-art.webp", "social-series.webp", "campus-event.webp", "knowledge-column.webp",
] as const;

const themes = ["文化遗产", "地方材料", "建筑秩序", "编辑叙事", "城市观察", "品牌语气", "数字体验", "公共文化", "展览视觉", "青年表达"] as const;
const palettes = [
  ["#171C1B", "#C7B9A5", "#E8E3D8", "#8A6847"],
  ["#0D1724", "#536D93", "#DCE4EA", "#C58B63"],
  ["#141212", "#A34431", "#E1B76E", "#EEE8DD"],
] as const;

function demoId(index: number): EntityId {
  return `24000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` as EntityId;
}

export const phase2DemoAssets: readonly Phase2DemoAsset[] = Array.from({ length: 50 }, (_, index) => {
  const preview = previews[index % previews.length] ?? "brand-visual-system.webp";
  const theme = themes[index % themes.length] ?? "视觉研究";
  const palette = palettes[index % palettes.length] ?? palettes[0];
  const timestamp = requireIsoTimestamp(`2026-07-${String(1 + (index % 20)).padStart(2, "0")}T08:00:00.000Z`);
  return {
    id: demoId(index),
    name: `${theme}参考 ${String(index + 1).padStart(2, "0")}`,
    type: "image",
    status: "ready",
    mimeType: "image/webp",
    byteSize: 32_000 + index * 731,
    storageKey: `demo/phase-2/${preview}`,
    url: `/assets/templates/${preview}`,
    width: index % 3 === 0 ? 1600 : 1200,
    height: index % 3 === 0 ? 1000 : 1500,
    source: "Muse 自有演示素材库",
    license: "Muse 项目演示许可 · 禁止脱离项目再分发",
    tags: [theme, index % 2 === 0 ? "品牌设计" : "视觉研究", index % 3 === 0 ? "编辑感" : "材料感"],
    colors: palette,
    favorite: index < 4,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
});

export async function seedPhase2DemoAssets(database: MuseDatabase): Promise<number> {
  const table = database.table<Phase2DemoAsset, EntityId>("assets");
  const existing = new Set(await table.bulkGet(phase2DemoAssets.map((asset) => asset.id)).then((rows) => rows.filter((asset): asset is Phase2DemoAsset => asset !== undefined).map((asset) => asset.id)));
  const missing = phase2DemoAssets.filter((asset) => !existing.has(asset.id));
  if (missing.length > 0) await table.bulkPut([...missing]);
  return missing.length;
}
