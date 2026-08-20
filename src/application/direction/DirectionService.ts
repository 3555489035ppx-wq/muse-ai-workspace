import type { Asset } from "../../domain/asset/index.js";
import type { ProjectBrief } from "../../domain/project/index.js";
import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { ProjectWorkflowService } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { DeterministicMockDirectionProvider } from "../../infrastructure/providers/mock/direction/index.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { DirectionRepository } from "../../repositories/DirectionRepository.js";
import { MoodboardRepository } from "../../repositories/MoodboardRepository.js";
import { ResearchRepository } from "../../repositories/ResearchRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { DirectionProviderError, validateDirectionProviderOutput, type DirectionProvider } from "./contracts.js";
import { validateDirectionDifference } from "./difference.js";

interface ProjectWorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
interface DirectionOperationRecord extends ProjectScopedEntity { readonly kind: "direction"; readonly state: "pending" | "success" | "error"; readonly targetEntityId: EntityId; readonly errorCode?: string; }
export interface GenerateDirectionsInput { readonly projectId: ProjectId; readonly briefId: EntityId; readonly researchSessionId: EntityId; readonly moodboardId: EntityId; readonly visualDNAId: EntityId; readonly assetIds: readonly EntityId[]; readonly constraints: readonly string[]; readonly seed: string; readonly signal?: AbortSignal; }
export interface GenerateDirectionsResult { readonly directionIds: readonly EntityId[]; readonly workflowState: "DIRECTIONS_READY"; }
export interface DirectionServiceOptions { readonly provider?: DirectionProvider; readonly clock?: RepositoryClock; readonly entityIdFactory?: () => EntityId; readonly faultInjector?: (stage: "generating" | "persisting") => void | Promise<void>; }

export class DirectionService {
  readonly #database: MuseDatabase; readonly #provider: DirectionProvider; readonly #directions: DirectionRepository; readonly #moodboards: MoodboardRepository; readonly #research: ResearchRepository;
  readonly #workflows: BaseRepository<ProjectWorkflowRecord>; readonly #operations: BaseRepository<DirectionOperationRecord>; readonly #workflow = new ProjectWorkflowService(); readonly #idFactory: () => EntityId; readonly #faultInjector: DirectionServiceOptions["faultInjector"];
  constructor(database: MuseDatabase, options: DirectionServiceOptions = {}) {
    this.#database = database; this.#provider = options.provider ?? new DeterministicMockDirectionProvider(); this.#directions = new DirectionRepository(database, options.clock); this.#moodboards = new MoodboardRepository(database, options.clock); this.#research = new ResearchRepository(database, options.clock); this.#workflows = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow", options.clock); this.#operations = new BaseRepository(database.table("operations"), "DirectionOperation", options.clock); this.#idFactory = options.entityIdFactory ?? (() => createEntityId()); this.#faultInjector = options.faultInjector;
  }
  async generate(input: GenerateDirectionsInput): Promise<GenerateDirectionsResult> {
    const [brief, research, moodboard, visualDNA] = await Promise.all([
      this.#database.table<ProjectBrief, EntityId>("briefs").get(input.briefId), this.#research.getSession(input.researchSessionId), this.#moodboards.getMoodboard(input.moodboardId), this.#moodboards.getVisualDNA(input.visualDNAId),
    ]);
    if (brief?.projectId !== input.projectId || research?.projectId !== input.projectId || research.status !== "completed" || moodboard?.projectId !== input.projectId || moodboard.researchSessionId !== research.id || visualDNA?.projectId !== input.projectId || visualDNA.moodboardId !== moodboard.id) throw new DirectionProviderError("PROVIDER_FAILURE", "Direction input lineage is incomplete or crosses project boundaries.");
    const assets = await Promise.all(input.assetIds.map((id) => this.#database.table<Asset, EntityId>("assets").get(id)));
    if (assets.some((asset) => asset === undefined)) throw new DirectionProviderError("PROVIDER_FAILURE", "Direction source assets are missing.");
    const workflowRecord = await this.#database.table<ProjectWorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(input.projectId).first();
    if (workflowRecord === undefined) throw new DirectionProviderError("PROVIDER_FAILURE", "Project workflow is missing.");
    const generating = this.#workflow.transition(workflowRecord.state, "DIRECTIONS_GENERATING"); const operationId = this.#idFactory();
    await runWriteTransaction(this.#database, [this.#database.table("workflowRuns"), this.#database.table("operations")], async () => { await this.#workflows.update(workflowRecord.id, { state: generating }); await this.#operations.create({ id: operationId, projectId: input.projectId, kind: "direction", state: "pending", targetEntityId: moodboard.id }); });
    await this.#faultInjector?.("generating");
    try {
      const [opportunities, seeds] = await Promise.all([this.#research.listOpportunitiesBySession(research.id), this.#research.listSeedsBySession(research.id)]);
      const providerInput = { brief, research, opportunities, seeds, moodboard, visualDNA, assets: assets as Asset[], constraints: input.constraints, seed: input.seed, signal: input.signal };
      const candidates = validateDirectionProviderOutput(await this.#provider.generate(providerInput), providerInput).directions; validateDirectionDifference(candidates);
      const directionIds: EntityId[] = [];
      const tables = ["moodboards", "visualDna", "creativeSeeds", "researchOpportunities", "assets", "directions", "directionReferences", "workflowRuns", "operations"].map((name) => this.#database.table(name));
      await runWriteTransaction(this.#database, tables, async () => {
        for (const candidate of candidates) {
          const directionId = this.#idFactory(); directionIds.push(directionId);
          await this.#directions.createDirection({ id: directionId, projectId: input.projectId, researchSessionId: candidate.researchSessionId, moodboardId: candidate.moodboardId, visualDNAId: candidate.visualDNAId, creativeSeedIds: candidate.creativeSeedIds, opportunityIds: candidate.opportunityIds, title: candidate.title, concept: candidate.concept, narrative: candidate.narrative, visualDNA: { keywords: candidate.keywords, principles: Object.entries(candidate.axisValues).map(([axis, value]) => `${axis}:${value}`) }, advantages: candidate.advantages, risks: candidate.risks, status: "candidate" });
          for (const reference of candidate.references) await this.#directions.createReference({ id: this.#idFactory(), projectId: input.projectId, directionId, assetId: reference.assetId, role: reference.role });
        }
        await this.#faultInjector?.("persisting");
        await this.#workflows.update(workflowRecord.id, { state: this.#workflow.transition(generating, "DIRECTIONS_READY") }); await this.#operations.update(operationId, { state: "success", targetEntityId: directionIds[0]! });
      });
      return { directionIds, workflowState: "DIRECTIONS_READY" };
    } catch (error: unknown) {
      await runWriteTransaction(this.#database, [this.#database.table("workflowRuns"), this.#database.table("operations")], async () => { await this.#workflows.update(workflowRecord.id, { state: "MOODBOARD_READY" }); await this.#operations.update(operationId, { state: "error", errorCode: error instanceof DirectionProviderError ? error.code : "DIRECTION_FAILED" }); });
      throw error;
    }
  }
}

export function createDirectionService(database: MuseDatabase = getDefaultDatabase()): DirectionService { return new DirectionService(database); }
