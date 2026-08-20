import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Asset } from "../../domain/asset/index.js";
import type { Moodboard, MoodboardItem, VisualDNA } from "../../domain/moodboard/index.js";
import { asProjectId, isEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { MoodboardRepository } from "../../repositories/MoodboardRepository.js";
import { MoodboardGrid, type MoodboardGridItem } from "./MoodboardGrid.js";
import { MoodboardLightbox } from "./MoodboardLightbox.js";
import { useMoodboardSelection } from "./useMoodboardSelection.js";
import "./moodboard.css";
import { MoodboardAssetCommands } from "../../application/asset/index.js";
import { PhaseOneRuntimeService } from "../../application/runtime/index.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, EmptyState, ErrorState, LoadingState, StatusPill, TagList } from "../../components/ui.jsx";
import { ImagePlus, Sparkles } from "lucide-react";
export interface MoodboardView { readonly moodboard: Moodboard; readonly items: readonly MoodboardGridItem[]; readonly visualDNA?: VisualDNA; }
export async function loadMoodboardViews(projectId: ProjectId, database: MuseDatabase = getDefaultDatabase()): Promise<readonly MoodboardView[]> {
  const repository = new MoodboardRepository(database); const boards = await repository.listMoodboardsByProject(projectId);
  return Promise.all(boards.map(async (moodboard) => {
    const items = await repository.listItemsByMoodboard(moodboard.id);
    const assets = await Promise.all(items.map((item) => database.table<Asset, EntityId>("assets").get(item.assetId)));
    const visualDNA = await database.table<VisualDNA, EntityId>("visualDna").where("moodboardId").equals(moodboard.id).first();
    return { moodboard, items: items.map((item, index): MoodboardGridItem => ({ item, asset: assets[index] })), visualDNA };
  }));
}
export function MoodboardPage({ loader = loadMoodboardViews, runtime }: { readonly loader?: typeof loadMoodboardViews; readonly runtime?: PhaseOneRuntimeService }) {
  const { projectId } = useParams(); const [views, setViews] = useState<readonly MoodboardView[] | undefined>(); const [error, setError] = useState("");
  const workflow = useMemo(() => runtime ?? new PhaseOneRuntimeService(), [runtime]); const [running, setRunning] = useState(false);
  const [selection, toggleSelection] = useMoodboardSelection(); const [lightbox, setLightbox] = useState<{ readonly view: MoodboardView; readonly index: number }>();
  useEffect(() => { if (!isEntityId(projectId)) { setError("项目链接无效"); return; } let active = true; loader(asProjectId(projectId)).then((data) => { if (active) setViews(data); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "情绪板加载失败"); }); return () => { active = false; }; }, [loader, projectId]);
  if (error) return <AppShell><main className="moodboard-page"><ErrorState title="情绪板加载失败" description={error} /></main></AppShell>;
  if (views === undefined) return <AppShell><main className="moodboard-page"><LoadingState title="正在读取情绪板" description="正在恢复素材、分组和 Visual DNA。" /></main></AppShell>;
  const upload = async (moodboardId: EntityId, file: File | undefined) => { if (!file || !isEntityId(projectId)) return; const commands = new MoodboardAssetCommands(); const asset = await commands.upload(asProjectId(projectId), { name: file.name, content: file }); await commands.add(asProjectId(projectId), moodboardId, asset.id); setViews(await loader(asProjectId(projectId))); };
  const generate = () => { if (!isEntityId(projectId)) return; setRunning(true); void workflow.generateMoodboards(asProjectId(projectId)).then(() => loader(asProjectId(projectId))).then(setViews).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "情绪板生成失败")).finally(() => setRunning(false)); };
  return <AppShell><main className="moodboard-page" aria-labelledby="moodboard-title"><header className="moodboard-heading"><div><p>Research → Moodboard → Visual DNA</p><h1 id="moodboard-title">情绪板</h1><span>AI 先建立视觉领地与视觉 DNA，你可以继续选择、补充和调整素材。</span></div><StatusPill status="ai">离线确定性视觉分析</StatusPill></header>{views.length === 0 ? <EmptyState title="从研究生成视觉领地" description="Muse 会基于洞察、机会和创意种子组织第一版情绪板，并保留每个素材的来源关系。" action={<Button icon={Sparkles} loading={running} disabled={!isEntityId(projectId)} onClick={generate}>生成情绪板</Button>} /> : views.map((view) => <section className="moodboard-territory" key={view.moodboard.id}><header><div><span>视觉领地</span><h2>{view.moodboard.title}</h2>{view.visualDNA ? <TagList items={view.visualDNA.keywords} /> : null}</div><label className="moodboard-upload"><ImagePlus aria-hidden="true" size={17} />补充素材<input type="file" accept="image/*" onChange={(event) => void upload(view.moodboard.id, event.target.files?.[0])} /></label></header><div className="moodboard-layout"><div><p className="moodboard-selection-status" role="status">{selection.size ? `已选择 ${selection.size} 个素材；按 Ctrl / Command 可多选，双击查看大图。` : `${view.items.length} 个素材；单击选择，双击查看大图。`}</p><MoodboardGrid items={view.items} selected={selection} onSelect={({ item }, multi) => toggleSelection(item.id, multi)} onOpen={(index) => setLightbox({ view, index })} /></div><aside className="visual-dna" aria-label={`${view.moodboard.title} Visual DNA`}><div><span>Visual DNA</span><h3>视觉基因</h3></div>{view.visualDNA ? <><section><h4>主色调</h4><div className="visual-dna__palette">{view.visualDNA.colorPalette.map((color) => <span key={`${color.hex}-${color.role}`}><i style={{ backgroundColor: color.hex }} /><b>{color.role}</b><small>{color.hex}</small></span>)}</div></section><section><h4>构图</h4><TagList items={view.visualDNA.composition} /></section><section><h4>图像语言</h4><TagList items={view.visualDNA.imagery} /></section><section><h4>字体建议</h4><TagList items={view.visualDNA.typography ?? []} /></section><section><h4>材质与纹理</h4><TagList items={view.visualDNA.materials ?? []} /></section></> : <p className="muted">当前情绪板尚未形成 Visual DNA。</p>}</aside></div></section>)}{lightbox ? <MoodboardLightbox assets={lightbox.view.items.map((item) => item.asset)} activeIndex={lightbox.index} onChange={(index) => setLightbox({ ...lightbox, index })} onClose={() => setLightbox(undefined)} /> : null}</main></AppShell>;
}
