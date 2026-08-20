import { ensureDecisionMap, EntityCanvasAdapter, LineageEdgeService } from "../canvas/index.js";
import { DirectionService } from "../direction/index.js";
import { ExplorationService } from "../exploration/index.js";
import { MoodboardService } from "../moodboard/index.js";
import { PromptAdapterService, PromptCompiler } from "../prompt/index.js";
import { ResearchService } from "../research/index.js";
import { getPhaseOneTemplate } from "../template/index.js";
import type { AssetSource } from "../../domain/asset/index.js";
import type { Direction } from "../../domain/direction/index.js";
import type { Exploration, ExplorationVariant } from "../../domain/exploration/index.js";
import type { Moodboard, VisualDNA } from "../../domain/moodboard/index.js";
import type { Project, ProjectBrief } from "../../domain/project/index.js";
import type { ResearchInsight, ResearchSession } from "../../domain/research/index.js";
import type { PromptVersion } from "../../domain/prompt/index.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import type { VersionSnapshot } from "../../domain/version/index.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { deterministicPromptAdapters } from "../../infrastructure/providers/mock/prompt-adapters/index.js";
import { AssetRepository } from "../../repositories/AssetRepository.js";

const FIXTURE_LABEL = "Muse 运行时参考素材";

function latest<T extends { readonly updatedAt: string }>(items: readonly T[]): T | undefined {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export class PhaseOneRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhaseOneRuntimeError";
  }
}

export class PhaseOneRuntimeService {
  readonly #database: MuseDatabase;
  readonly #assets: AssetRepository;

  constructor(database: MuseDatabase = getDefaultDatabase()) {
    this.#database = database;
    this.#assets = new AssetRepository(database);
  }

  async #template(projectId: ProjectId) {
    const snapshots = await this.#database.table<VersionSnapshot, EntityId>("versionSnapshots").where("projectId").equals(projectId).toArray();
    const provenance = snapshots.find((item) => item.entityType === "project" && typeof item.snapshot.templateId === "string");
    return typeof provenance?.snapshot.templateId === "string" ? getPhaseOneTemplate(provenance.snapshot.templateId) : undefined;
  }

  async #fixtureAssets(projectId: ProjectId): Promise<readonly EntityId[]> {
    const sources = await this.#database.table<AssetSource, EntityId>("assetSources").where("projectId").equals(projectId).toArray();
    const existing = sources.filter((item) => item.label === FIXTURE_LABEL).map((item) => item.assetId);
    if (existing.length >= 4) return existing.slice(0, 4);
    const ids = [...existing];
    for (let index = existing.length; index < 4; index += 1) {
      const assetId = createEntityId();
      const content = new Blob([`muse-runtime:${projectId}:${String(index + 1)}`], { type: "image/webp" });
      await this.#assets.createWithBlob({
        id: assetId,
        name: `参考素材 ${String(index + 1)}`,
        type: "image",
        status: "ready",
        mimeType: content.type,
        byteSize: content.size,
        storageKey: `runtime/${projectId}/${String(index + 1)}`,
      }, content);
      await this.#assets.createSource({ id: createEntityId(), projectId, assetId, type: "reference", label: FIXTURE_LABEL });
      ids.push(assetId);
    }
    return ids;
  }

  async runResearch(projectId: ProjectId): Promise<EntityId> {
    const current = latest(await this.#database.table<ResearchSession, EntityId>("researchSessions").where("projectId").equals(projectId).toArray());
    if (current) return current.id;
    const brief = await this.#database.table<ProjectBrief, EntityId>("briefs").where("projectId").equals(projectId).first();
    if (!brief) throw new PhaseOneRuntimeError("项目简报不存在，无法开始研究。");
    const template = await this.#template(projectId);
    return (await new ResearchService(this.#database).run({ projectId, briefId: brief.id, templateStrategy: template?.researchStrategy, seed: `runtime-research:${projectId}` })).researchSessionId;
  }

  async generateMoodboards(projectId: ProjectId): Promise<readonly EntityId[]> {
    const existing = await this.#database.table<Moodboard, EntityId>("moodboards").where("projectId").equals(projectId).toArray();
    if (existing.length > 0) return existing.map((item) => item.id);
    const researchSessionId = await this.runResearch(projectId);
    const template = await this.#template(projectId);
    const assets = await this.#fixtureAssets(projectId);
    return (await new MoodboardService(this.#database).generate({ projectId, researchSessionId, availableAssetIds: assets, templateStrategy: template?.moodboardStrategy, seed: `runtime-moodboard:${projectId}` })).moodboardIds;
  }

  async generateDirections(projectId: ProjectId): Promise<readonly EntityId[]> {
    const existing = await this.#database.table<Direction, EntityId>("directions").where("projectId").equals(projectId).toArray();
    if (existing.length > 0) return existing.map((item) => item.id);
    await this.generateMoodboards(projectId);
    const brief = await this.#database.table<ProjectBrief, EntityId>("briefs").where("projectId").equals(projectId).first();
    const research = latest(await this.#database.table<ResearchSession, EntityId>("researchSessions").where("projectId").equals(projectId).toArray());
    const moodboard = (await this.#database.table<Moodboard, EntityId>("moodboards").where("projectId").equals(projectId).toArray())[0];
    const visualDNA = moodboard ? await this.#database.table<VisualDNA, EntityId>("visualDna").where("moodboardId").equals(moodboard.id).first() : undefined;
    const assets = await this.#fixtureAssets(projectId);
    if (!brief || !research || !moodboard || !visualDNA) throw new PhaseOneRuntimeError("研究或情绪板链路不完整，无法生成方向。");
    return (await new DirectionService(this.#database).generate({ projectId, briefId: brief.id, researchSessionId: research.id, moodboardId: moodboard.id, visualDNAId: visualDNA.id, assetIds: assets, constraints: brief.constraints, seed: `runtime-direction:${projectId}` })).directionIds;
  }

  async generateExploration(projectId: ProjectId): Promise<EntityId> {
    const existing = latest(await this.#database.table<Exploration, EntityId>("explorations").where("projectId").equals(projectId).toArray());
    if (existing) return existing.id;
    const direction = (await this.#database.table<Direction, EntityId>("directions").where("projectId").equals(projectId).toArray()).find((item) => item.status === "locked");
    if (!direction) throw new PhaseOneRuntimeError("请先锁定一个创意方向。");
    const references = await this.#database.table<{ readonly assetId: EntityId }, EntityId>("directionReferences").where("directionId").equals(direction.id).toArray();
    return (await new ExplorationService(this.#database).generate({ projectId, visualDNAId: direction.visualDNAId, sourceAssetIds: references.map((item) => item.assetId), axes: ["composition", "color", "typography", "lighting"], seed: `runtime-exploration:${projectId}` })).explorationId;
  }

  async compilePrompt(projectId: ProjectId, explorationId: EntityId): Promise<PromptVersion> {
    const existing = latest(await this.#database.table<PromptVersion, EntityId>("promptVersions").where("projectId").equals(projectId).toArray());
    if (existing) return existing;
    const [project, brief, research, moodboard, direction, exploration, insights, variants] = await Promise.all([
      this.#database.table<Project, EntityId>("projects").get(projectId),
      this.#database.table<ProjectBrief, EntityId>("briefs").where("projectId").equals(projectId).first(),
      this.#database.table<ResearchSession, EntityId>("researchSessions").where("projectId").equals(projectId).first(),
      this.#database.table<Moodboard, EntityId>("moodboards").where("projectId").equals(projectId).first(),
      this.#database.table<Direction, EntityId>("directions").where("projectId").equals(projectId).filter((item) => item.status === "locked").first(),
      this.#database.table<Exploration, EntityId>("explorations").get(explorationId),
      this.#database.table<ResearchInsight, EntityId>("researchInsights").where("projectId").equals(projectId).toArray(),
      this.#database.table<ExplorationVariant, EntityId>("explorationVariants").where("explorationId").equals(explorationId).toArray(),
    ]);
    const variant = variants.find((item) => item.status === "kept");
    const visualDNA = moodboard ? await this.#database.table<VisualDNA, EntityId>("visualDna").where("moodboardId").equals(moodboard.id).first() : undefined;
    if (!project || !brief || !research || !moodboard || !visualDNA || !direction || !exploration || !variant) throw new PhaseOneRuntimeError("请选择一个视觉探索方案后再编译提示词。");
    const spec = new PromptCompiler().compile({ project, brief, research, insights, moodboard, visualDNA, direction, exploration, variant, constraints: brief.constraints });
    return (await new PromptAdapterService(deterministicPromptAdapters, this.#database).compile(spec, "generic")).promptVersion;
  }

  async populateDecisionMap(projectId: ProjectId): Promise<void> {
    const map = await ensureDecisionMap(projectId, this.#database);
    const existing = new Set(map.nodes.map((item) => item.entityId));
    const first = async <T extends { readonly id: EntityId }>(table: string) => this.#database.table<T, EntityId>(table).where("projectId").equals(projectId).first();
    const [brief, research, insight, opportunity, moodboard, direction, exploration, prompt, generated, review] = await Promise.all([
      first<{ readonly id: EntityId }>("briefs"), first<{ readonly id: EntityId }>("researchSessions"), first<{ readonly id: EntityId }>("researchInsights"), first<{ readonly id: EntityId }>("researchOpportunities"), first<{ readonly id: EntityId }>("moodboards"),
      this.#database.table<Direction, EntityId>("directions").where("projectId").equals(projectId).filter((item) => item.status === "locked").first(), first<{ readonly id: EntityId }>("explorations"), first<{ readonly id: EntityId }>("promptVersions"), first<{ readonly id: EntityId; readonly assetId: EntityId }>("generatedAssets"), first<{ readonly id: EntityId }>("aiReviews"),
    ]);
    const refs = [["brief", brief?.id], ["research", research?.id], ["insight", insight?.id], ["opportunity", opportunity?.id], ["moodboard", moodboard?.id], ["direction", direction?.id], ["exploration", exploration?.id], ["prompt", prompt?.id], ["generated_asset", generated?.id], ["asset", generated?.assetId], ["review", review?.id]] as const;
    const adapter = new EntityCanvasAdapter(this.#database);
    let position = existing.size;
    for (const [entityType, entityId] of refs) {
      if (!entityId || existing.has(entityId)) continue;
      await adapter.add(projectId, map.canvas.id, entityType, entityId, { x: (position % 4) * 260, y: Math.floor(position / 4) * 190 });
      position += 1;
    }
    await new LineageEdgeService(this.#database).rebuild(projectId, map.canvas.id);
  }
}
