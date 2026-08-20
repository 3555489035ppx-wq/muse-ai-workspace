import type { Asset } from "../../domain/asset/index.js";
import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { ProjectWorkflowService } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { DeterministicMockMoodboardProvider } from "../../infrastructure/providers/mock/moodboard/index.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { MoodboardRepository } from "../../repositories/MoodboardRepository.js";
import { ResearchRepository } from "../../repositories/ResearchRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import type { TemplateMoodboardStrategy } from "../template/index.js";
import { MoodboardProviderError, validateMoodboardProviderOutput, type MoodboardProvider } from "./contracts.js";

interface ProjectWorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
interface MoodboardOperationRecord extends ProjectScopedEntity { readonly kind: "moodboard"; readonly state: "pending" | "success" | "error"; readonly targetEntityId: EntityId; readonly errorCode?: string; }
export interface GenerateMoodboardsInput { readonly projectId: ProjectId; readonly researchSessionId: EntityId; readonly availableAssetIds: readonly EntityId[]; readonly templateStrategy?: TemplateMoodboardStrategy; readonly seed: string; readonly signal?: AbortSignal; }
export interface GenerateMoodboardsResult { readonly moodboardIds: readonly EntityId[]; readonly visualDNAIds: readonly EntityId[]; readonly workflowState: "MOODBOARD_READY"; }
export interface MoodboardServiceOptions { readonly provider?: MoodboardProvider; readonly clock?: RepositoryClock; readonly entityIdFactory?: () => EntityId; readonly faultInjector?: (stage: "generating" | "persisting") => void | Promise<void>; }

export class MoodboardService {
  readonly #database: MuseDatabase; readonly #provider: MoodboardProvider; readonly #moodboards: MoodboardRepository; readonly #research: ResearchRepository;
  readonly #workflows: BaseRepository<ProjectWorkflowRecord>; readonly #operations: BaseRepository<MoodboardOperationRecord>; readonly #workflow = new ProjectWorkflowService();
  readonly #idFactory: () => EntityId; readonly #faultInjector: MoodboardServiceOptions["faultInjector"];
  constructor(database: MuseDatabase, options: MoodboardServiceOptions = {}) {
    this.#database = database; this.#provider = options.provider ?? new DeterministicMockMoodboardProvider(); this.#moodboards = new MoodboardRepository(database, options.clock); this.#research = new ResearchRepository(database, options.clock);
    this.#workflows = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow", options.clock); this.#operations = new BaseRepository(database.table("operations"), "MoodboardOperation", options.clock);
    this.#idFactory = options.entityIdFactory ?? (() => createEntityId()); this.#faultInjector = options.faultInjector;
  }
  async generate(input: GenerateMoodboardsInput): Promise<GenerateMoodboardsResult> {
    const research = await this.#research.getSession(input.researchSessionId);
    if (research === undefined || research.projectId !== input.projectId || research.status !== "completed") throw new MoodboardProviderError("PROVIDER_FAILURE", "已完成的研究会话不存在或不属于当前项目");
    const assets = await Promise.all(input.availableAssetIds.map((id) => this.#database.table<Asset, EntityId>("assets").get(id)));
    if (assets.some((asset) => asset === undefined)) throw new MoodboardProviderError("PROVIDER_FAILURE", "情绪板引用的素材不存在");
    const workflowRecord = await this.#database.table<ProjectWorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(input.projectId).first();
    if (workflowRecord === undefined) throw new MoodboardProviderError("PROVIDER_FAILURE", "项目工作流不存在");
    const generating = this.#workflow.transition(workflowRecord.state, "MOODBOARD_GENERATING");
    const operationId = this.#idFactory();
    await runWriteTransaction(this.#database, [this.#database.table("workflowRuns"), this.#database.table("operations")], async () => {
      await this.#workflows.update(workflowRecord.id, { state: generating });
      await this.#operations.create({ id: operationId, projectId: input.projectId, kind: "moodboard", state: "pending", targetEntityId: input.researchSessionId });
    });
    await this.#faultInjector?.("generating");
    try {
      const [insights, opportunities, seeds] = await Promise.all([this.#research.listInsightsBySession(research.id), this.#research.listOpportunitiesBySession(research.id), this.#research.listSeedsBySession(research.id)]);
      const output = validateMoodboardProviderOutput(await this.#provider.generate({ research, insights, opportunities, seeds, templateStrategy: input.templateStrategy, availableAssetIds: input.availableAssetIds, seed: input.seed, signal: input.signal }), input.availableAssetIds);
      const moodboardIds: EntityId[] = []; const visualDNAIds: EntityId[] = [];
      const tables = ["researchSessions", "assets", "moodboards", "moodboardItems", "visualDna", "workflowRuns", "operations"].map((name) => this.#database.table(name));
      await runWriteTransaction(this.#database, tables, async () => {
        for (const territory of output.territories) {
          const moodboardId = this.#idFactory(); const visualDNAId = this.#idFactory(); moodboardIds.push(moodboardId); visualDNAIds.push(visualDNAId);
          await this.#moodboards.createMoodboard({ id: moodboardId, projectId: input.projectId, researchSessionId: research.id, title: territory.name, status: "curated" });
          for (const [position, assetId] of territory.assetRefs.entries()) await this.#moodboards.createItem({ id: this.#idFactory(), projectId: input.projectId, moodboardId, assetId, role: position === 0 ? "hero" : "reference", position, note: territory.rationale });
          await this.#moodboards.createVisualDNA({ id: visualDNAId, projectId: input.projectId, moodboardId, ...territory.visualDNA });
        }
        await this.#faultInjector?.("persisting");
        await this.#workflows.update(workflowRecord.id, { state: this.#workflow.transition(generating, "MOODBOARD_READY") });
        await this.#operations.update(operationId, { state: "success", targetEntityId: moodboardIds[0] ?? input.researchSessionId });
      });
      return { moodboardIds, visualDNAIds, workflowState: "MOODBOARD_READY" };
    } catch (error: unknown) {
      await runWriteTransaction(this.#database, [this.#database.table("workflowRuns"), this.#database.table("operations")], async () => {
        await this.#workflows.update(workflowRecord.id, { state: "RESEARCH_READY" });
        await this.#operations.update(operationId, { state: "error", errorCode: error instanceof MoodboardProviderError ? error.code : "MOODBOARD_FAILED" });
      });
      throw error;
    }
  }
}
export function createMoodboardService(database: MuseDatabase = getDefaultDatabase()): MoodboardService { return new MoodboardService(database); }
