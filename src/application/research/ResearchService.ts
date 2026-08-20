import type { Project, ProjectBrief } from "../../domain/project/index.js";
import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { ProjectWorkflowService } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { ResearchRepository } from "../../repositories/ResearchRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { DeterministicMockResearchProvider } from "../../infrastructure/providers/mock/research/index.js";
import type { TemplateResearchStrategy } from "../template/index.js";
import { ResearchProviderError, validateResearchProviderOutput } from "./contracts.js";
import type { ResearchProvider } from "./ResearchProvider.js";

interface ProjectWorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
interface ResearchOperationRecord extends ProjectScopedEntity { readonly kind: "research"; readonly state: "pending" | "success" | "error"; readonly targetEntityId: EntityId; readonly errorCode?: string; }

export interface RunResearchInput {
  readonly projectId: ProjectId;
  readonly briefId: EntityId;
  readonly templateStrategy?: TemplateResearchStrategy;
  readonly seed: string;
  readonly signal?: AbortSignal;
}

export interface RunResearchResult {
  readonly researchSessionId: EntityId;
  readonly sourceIds: readonly EntityId[];
  readonly evidenceIds: readonly EntityId[];
  readonly observationIds: readonly EntityId[];
  readonly insightIds: readonly EntityId[];
  readonly opportunityIds: readonly EntityId[];
  readonly creativeSeedIds: readonly EntityId[];
  readonly workflowState: "RESEARCH_READY";
}

export interface ResearchServiceOptions {
  readonly provider?: ResearchProvider;
  readonly clock?: RepositoryClock;
  readonly entityIdFactory?: () => EntityId;
  readonly faultInjector?: (stage: "researching" | "persisting" | "completed") => void | Promise<void>;
}

export class ResearchService {
  readonly #database: MuseDatabase;
  readonly #provider: ResearchProvider;
  readonly #research: ResearchRepository;
  readonly #workflows: BaseRepository<ProjectWorkflowRecord>;
  readonly #operations: BaseRepository<ResearchOperationRecord>;
  readonly #workflow = new ProjectWorkflowService();
  readonly #entityIdFactory: () => EntityId;
  readonly #faultInjector: ResearchServiceOptions["faultInjector"];

  constructor(database: MuseDatabase, options: ResearchServiceOptions = {}) {
    this.#database = database;
    this.#provider = options.provider ?? new DeterministicMockResearchProvider();
    this.#research = new ResearchRepository(database, options.clock);
    this.#workflows = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow", options.clock);
    this.#operations = new BaseRepository(database.table("operations"), "ResearchOperation", options.clock);
    this.#entityIdFactory = options.entityIdFactory ?? (() => createEntityId());
    this.#faultInjector = options.faultInjector;
  }

  async run(input: RunResearchInput): Promise<RunResearchResult> {
    const project = await this.#database.table<Project, EntityId>("projects").get(input.projectId);
    const brief = await this.#database.table<ProjectBrief, EntityId>("briefs").get(input.briefId);
    if (project === undefined || brief === undefined || brief.projectId !== input.projectId) throw new ResearchProviderError("PROVIDER_FAILURE", "Project or brief is missing or outside the project scope.");
    const workflowRecord = await this.#database.table<ProjectWorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(input.projectId).first();
    if (workflowRecord === undefined) throw new ResearchProviderError("PROVIDER_FAILURE", "Project workflow is missing.");
    const operationId = this.#entityIdFactory();
    const researching = this.#workflow.transition(workflowRecord.state, "RESEARCHING");
    await runWriteTransaction(this.#database, [this.#database.table("workflowRuns"), this.#database.table("operations")], async () => {
      await this.#workflows.update(workflowRecord.id, { state: researching });
      await this.#operations.create({ id: operationId, projectId: input.projectId, kind: "research", state: "pending", targetEntityId: input.projectId });
    });
    await this.#faultInjector?.("researching");

    try {
      const output = validateResearchProviderOutput(await this.#provider.research({
        brief,
        templateStrategy: input.templateStrategy,
        context: { projectName: project.name, projectType: project.type, locale: project.settings.locale },
        seed: input.seed,
        signal: input.signal,
      }));
      const researchSessionId = this.#entityIdFactory();
      const keyIds = new Map<string, EntityId>();
      for (const item of [...output.sources, ...output.evidence, ...output.observations, ...output.insights, ...output.opportunities, ...output.seeds]) keyIds.set(item.key, this.#entityIdFactory());
      const requireKey = (key: string): EntityId => {
        const id = keyIds.get(key);
        if (id === undefined) throw new ResearchProviderError("INVALID_OUTPUT", `Missing research candidate key: ${key}`);
        return id;
      };
      const tables = ["briefs", "researchSessions", "researchSources", "researchEvidence", "researchObservations", "researchInsights", "researchOpportunities", "creativeSeeds", "workflowRuns", "operations"].map((name) => this.#database.table(name));
      const result = await runWriteTransaction(this.#database, tables, async () => {
        await this.#research.createSession({ id: researchSessionId, projectId: input.projectId, briefId: input.briefId, query: output.understanding, status: "active" });
        for (const item of output.sources) await this.#research.createSource({ id: requireKey(item.key), projectId: input.projectId, researchSessionId, type: item.type, title: `${item.title}｜${item.provenance}` });
        for (const item of output.evidence) await this.#research.createEvidence({ id: requireKey(item.key), projectId: input.projectId, researchSessionId, sourceId: requireKey(item.sourceKey), excerpt: item.excerpt, locator: item.evidenceStatus });
        for (const item of output.observations) await this.#research.createObservation({ id: requireKey(item.key), projectId: input.projectId, researchSessionId, evidenceIds: item.evidenceKeys.map(requireKey), statement: `${item.category}｜${item.statement}` });
        for (const item of output.insights) await this.#research.createInsight({ id: requireKey(item.key), projectId: input.projectId, researchSessionId, observationIds: item.observationKeys.map(requireKey), statement: item.statement });
        for (const item of output.opportunities) await this.#research.createOpportunity({ id: requireKey(item.key), projectId: input.projectId, researchSessionId, insightIds: item.insightKeys.map(requireKey), statement: item.statement });
        for (const item of output.seeds) await this.#research.createCreativeSeed({ id: requireKey(item.key), projectId: input.projectId, researchSessionId, opportunityIds: item.opportunityKeys.map(requireKey), title: item.title, premise: item.premise });
        await this.#faultInjector?.("persisting");
        await this.#research.updateSession(researchSessionId, { status: "completed" });
        const ready = this.#workflow.transition(researching, "RESEARCH_READY");
        await this.#workflows.update(workflowRecord.id, { state: ready });
        await this.#operations.update(operationId, { state: "success", targetEntityId: researchSessionId });
        await this.#faultInjector?.("completed");
        return {
          researchSessionId,
          sourceIds: output.sources.map((item) => requireKey(item.key)),
          evidenceIds: output.evidence.map((item) => requireKey(item.key)),
          observationIds: output.observations.map((item) => requireKey(item.key)),
          insightIds: output.insights.map((item) => requireKey(item.key)),
          opportunityIds: output.opportunities.map((item) => requireKey(item.key)),
          creativeSeedIds: output.seeds.map((item) => requireKey(item.key)),
          workflowState: "RESEARCH_READY" as const,
        };
      });
      return result;
    } catch (error: unknown) {
      await runWriteTransaction(this.#database, [this.#database.table("workflowRuns"), this.#database.table("operations")], async () => {
        await this.#workflows.update(workflowRecord.id, { state: "DRAFT" });
        await this.#operations.update(operationId, { state: "error", errorCode: error instanceof ResearchProviderError ? error.code : "RESEARCH_FAILED" });
      });
      throw error;
    }
  }
}

export function createResearchService(database: MuseDatabase = getDefaultDatabase()): ResearchService { return new ResearchService(database); }
