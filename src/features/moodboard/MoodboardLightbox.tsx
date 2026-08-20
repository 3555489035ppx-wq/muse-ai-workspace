import React, { useEffect, useRef } from "react";
import type { Asset } from "../../domain/asset/index.js";
import { resolveMoodboardPreview } from "./MoodboardGrid.js";
export function lightboxIndexForKey(key: string, index: number, length: number): number | "close" {
  if (key === "Escape") return "close"; if (key === "ArrowLeft") return Math.max(0, index - 1); if (key === "ArrowRight") return Math.min(length - 1, index + 1); return index;
}
export function returnMoodboardFocus(target: { focus(): void } | undefined): void { target?.focus(); }
export function MoodboardLightbox({ assets, activeIndex, onChange, onClose }: { readonly assets: readonly (Asset | undefined)[]; readonly activeIndex: number; readonly onChange: (index: number) => void; readonly onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null); const focusReturn = useRef<HTMLElement | undefined>(undefined); const asset = assets[activeIndex];
  useEffect(() => { focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; closeButton.current?.focus(); const handler = (event: KeyboardEvent) => { const result = lightboxIndexForKey(event.key, activeIndex, assets.length); if (result === "close") onClose(); else if (result !== activeIndex) onChange(result); }; document.addEventListener("keydown", handler); return () => { document.removeEventListener("keydown", handler); returnMoodboardFocus(focusReturn.current); }; }, [activeIndex, assets.length, onChange, onClose]);
  const preview = resolveMoodboardPreview(asset, activeIndex);
  return <div className="moodboard-lightbox" role="dialog" aria-modal="true" aria-label="情绪板大图预览"><button ref={closeButton} onClick={onClose} aria-label="关闭预览">关闭</button><button onClick={() => onChange(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>上一张</button><figure>{preview ? <img src={preview} alt={asset?.name ?? "情绪板素材"} /> : <div>素材缺失，无法预览</div>}<figcaption>{asset?.name ?? "缺失素材"} · {activeIndex + 1}/{assets.length}</figcaption></figure><button onClick={() => onChange(Math.min(assets.length - 1, activeIndex + 1))} disabled={activeIndex >= assets.length - 1}>下一张</button></div>;
}
