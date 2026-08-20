import type { Table } from "dexie";

import { ParentEntityMismatchError } from "../domain/errors/index.js";
import type { ProjectBrief } from "../domain/project/index.js";
import type {
  CreativeSeed,
  ResearchEvidence,
  ResearchInsight,
  ResearchObservation,
  ResearchOpportunity,
  ResearchSession,
  ResearchSource,
} from "../domain/research/index.js";
import type { ProjectScopedEntity } from "../domain/shared/entity.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";
import type { MuseDatabase } from "../db/database.js";
import { BaseRepository } from "./base/BaseRepository.js";
import type {
  CreateEntityInput,
  RepositoryClock,
  UpdateEntityInput,
} from "./base/types.js";
import { requireParent } from "./base/validators.js";
import { runWriteTransaction } from "./transaction.js";

type ResearchEntity =
  | ResearchSession
  | ResearchSource
  | ResearchEvidence
  | ResearchObservation
  | ResearchInsight
  | ResearchOpportunity
  | CreativeSeed;

export class ResearchRepository {
  readonly #database: MuseDatabase;
  readonly #briefs: Table<ProjectBrief, EntityId>;
  readonly #sessionsTable: Table<ResearchSession, EntityId>;
  readonly #sourcesTable: Table<ResearchSource, EntityId>;
  readonly #evidenceTable: Table<ResearchEvidence, EntityId>;
  readonly #observationsTable: Table<ResearchObservation, EntityId>;
  readonly #insightsTable: Table<ResearchInsight, EntityId>;
  readonly #opportunitiesTable: Table<ResearchOpportunity, EntityId>;
  readonly #seedsTable: Table<CreativeSeed, EntityId>;
  readonly #sessions: BaseRepository<ResearchSession>;
  readonly #sources: BaseRepository<ResearchSource>;
  readonly #evidence: BaseRepository<ResearchEvidence>;
  readonly #observations: BaseRepository<ResearchObservation>;
  readonly #insights: BaseRepository<ResearchInsight>;
  readonly #opportunities: BaseRepository<ResearchOpportunity>;
  readonly #seeds: BaseRepository<CreativeSeed>;

  constructor(database: MuseDatabase, clock?: RepositoryClock) {
    this.#database = database;
    this.#briefs = database.table("briefs");
    this.#sessionsTable = database.table("researchSessions");
    this.#sourcesTable = database.table("researchSources");
    this.#evidenceTable = database.table("researchEvidence");
    this.#observationsTable = database.table("researchObservations");
    this.#insightsTable = database.table("researchInsights");
    this.#opportunitiesTable = database.table("researchOpportunities");
    this.#seedsTable = database.table("creativeSeeds");
    this.#sessions = new BaseRepository(this.#sessionsTable, "ResearchSession", clock);
    this.#sources = new BaseRepository(this.#sourcesTable, "ResearchSource", clock);
    this.#evidence = new BaseRepository(this.#evidenceTable, "ResearchEvidence", clock);
    this.#observations = new BaseRepository(this.#observationsTable, "ResearchObservation", clock);
    this.#insights = new BaseRepository(this.#insightsTable, "ResearchInsight", clock);
    this.#opportunities = new BaseRepository(this.#opportunitiesTable, "ResearchOpportunity", clock);
    this.#seeds = new BaseRepository(this.#seedsTable, "CreativeSeed", clock);
  }

  async #create<T extends ResearchEntity>(
    repository: BaseRepository<T>,
    input: CreateEntityInput<T>,
    validate: (entity: CreateEntityInput<T>) => Promise<void>,
  ): Promise<T> {
    await validate(input);
    return repository.create(input);
  }

  async #update<T extends ResearchEntity>(
    repository: BaseRepository<T>,
    id: EntityId,
    patch: UpdateEntityInput<T>,
    validate: (entity: T) => Promise<void>,
  ): Promise<T> {
    const current = await repository.require(id);
    const candidate = { ...current, ...patch };
    await validate(candidate);
    return repository.update(id, patch);
  }

  async #requireAll<T extends ProjectScopedEntity>(
    table: Table<T, EntityId>,
    ids: readonly EntityId[],
    projectId: ProjectId,
    entityType: string,
  ): Promise<readonly T[]> {
    return Promise.all(
      ids.map((id) => requireParent(table, id, projectId, entityType)),
    );
  }

  async #validateSession(entity: Pick<ResearchSession, "briefId" | "projectId">): Promise<void> {
    await requireParent(this.#briefs, entity.briefId, entity.projectId, "ProjectBrief");
  }

  async #validateSource(entity: Pick<ResearchSource, "researchSessionId" | "projectId">): Promise<void> {
    await requireParent(this.#sessionsTable, entity.researchSessionId, entity.projectId, "ResearchSession");
  }

  async #validateEvidence(entity: Pick<ResearchEvidence, "researchSessionId" | "sourceId" | "projectId">): Promise<void> {
    await this.#validateSource(entity);
    const source = await requireParent(this.#sourcesTable, entity.sourceId, entity.projectId, "ResearchSource");
    if (source.researchSessionId !== entity.researchSessionId) {
      throw new ParentEntityMismatchError("ResearchSource", entity.sourceId, entity.projectId);
    }
  }

  async #validateObservation(entity: Pick<ResearchObservation, "researchSessionId" | "evidenceIds" | "projectId">): Promise<void> {
    await this.#validateSource(entity);
    const evidence = await this.#requireAll(this.#evidenceTable, entity.evidenceIds, entity.projectId, "ResearchEvidence");
    if (evidence.some((item) => item.researchSessionId !== entity.researchSessionId)) {
      throw new ParentEntityMismatchError("ResearchEvidence", entity.evidenceIds[0] ?? entity.researchSessionId, entity.projectId);
    }
  }

  async #validateInsight(entity: Pick<ResearchInsight, "researchSessionId" | "observationIds" | "projectId">): Promise<void> {
    await this.#validateSource(entity);
    const observations = await this.#requireAll(this.#observationsTable, entity.observationIds, entity.projectId, "ResearchObservation");
    if (observations.some((item) => item.researchSessionId !== entity.researchSessionId)) {
      throw new ParentEntityMismatchError("ResearchObservation", entity.observationIds[0] ?? entity.researchSessionId, entity.projectId);
    }
  }

  async #validateOpportunity(entity: Pick<ResearchOpportunity, "researchSessionId" | "insightIds" | "projectId">): Promise<void> {
    await this.#validateSource(entity);
    const insights = await this.#requireAll(this.#insightsTable, entity.insightIds, entity.projectId, "ResearchInsight");
    if (insights.some((item) => item.researchSessionId !== entity.researchSessionId)) {
      throw new ParentEntityMismatchError("ResearchInsight", entity.insightIds[0] ?? entity.researchSessionId, entity.projectId);
    }
  }

  async #validateSeed(entity: Pick<CreativeSeed, "researchSessionId" | "opportunityIds" | "projectId">): Promise<void> {
    await this.#validateSource(entity);
    const opportunities = await this.#requireAll(this.#opportunitiesTable, entity.opportunityIds, entity.projectId, "ResearchOpportunity");
    if (opportunities.some((item) => item.researchSessionId !== entity.researchSessionId)) {
      throw new ParentEntityMismatchError("ResearchOpportunity", entity.opportunityIds[0] ?? entity.researchSessionId, entity.projectId);
    }
  }

  createSession(input: CreateEntityInput<ResearchSession>) { return this.#create(this.#sessions, input, (item) => this.#validateSession(item)); }
  createSource(input: CreateEntityInput<ResearchSource>) { return this.#create(this.#sources, input, (item) => this.#validateSource(item)); }
  createEvidence(input: CreateEntityInput<ResearchEvidence>) { return this.#create(this.#evidence, input, (item) => this.#validateEvidence(item)); }
  createObservation(input: CreateEntityInput<ResearchObservation>) { return this.#create(this.#observations, input, (item) => this.#validateObservation(item)); }
  createInsight(input: CreateEntityInput<ResearchInsight>) { return this.#create(this.#insights, input, (item) => this.#validateInsight(item)); }
  createOpportunity(input: CreateEntityInput<ResearchOpportunity>) { return this.#create(this.#opportunities, input, (item) => this.#validateOpportunity(item)); }
  createCreativeSeed(input: CreateEntityInput<CreativeSeed>) { return this.#create(this.#seeds, input, (item) => this.#validateSeed(item)); }

  updateSession(id: EntityId, patch: UpdateEntityInput<ResearchSession>) { return this.#update(this.#sessions, id, patch, (item) => this.#validateSession(item)); }
  updateSource(id: EntityId, patch: UpdateEntityInput<ResearchSource>) { return this.#update(this.#sources, id, patch, (item) => this.#validateSource(item)); }
  updateEvidence(id: EntityId, patch: UpdateEntityInput<ResearchEvidence>) { return this.#update(this.#evidence, id, patch, (item) => this.#validateEvidence(item)); }
  updateObservation(id: EntityId, patch: UpdateEntityInput<ResearchObservation>) { return this.#update(this.#observations, id, patch, (item) => this.#validateObservation(item)); }
  updateInsight(id: EntityId, patch: UpdateEntityInput<ResearchInsight>) { return this.#update(this.#insights, id, patch, (item) => this.#validateInsight(item)); }
  updateOpportunity(id: EntityId, patch: UpdateEntityInput<ResearchOpportunity>) { return this.#update(this.#opportunities, id, patch, (item) => this.#validateOpportunity(item)); }
  updateCreativeSeed(id: EntityId, patch: UpdateEntityInput<CreativeSeed>) { return this.#update(this.#seeds, id, patch, (item) => this.#validateSeed(item)); }

  getSession(id: EntityId) { return this.#sessions.get(id); }
  getSource(id: EntityId) { return this.#sources.get(id); }
  getEvidence(id: EntityId) { return this.#evidence.get(id); }
  getObservation(id: EntityId) { return this.#observations.get(id); }
  getInsight(id: EntityId) { return this.#insights.get(id); }
  getOpportunity(id: EntityId) { return this.#opportunities.get(id); }
  getCreativeSeed(id: EntityId) { return this.#seeds.get(id); }

  deleteSession(id: EntityId) { return this.#sessions.delete(id); }
  deleteSource(id: EntityId) { return this.#sources.delete(id); }
  deleteEvidence(id: EntityId) { return this.#evidence.delete(id); }
  deleteObservation(id: EntityId) { return this.#observations.delete(id); }
  deleteInsight(id: EntityId) { return this.#insights.delete(id); }
  deleteOpportunity(id: EntityId) { return this.#opportunities.delete(id); }
  deleteCreativeSeed(id: EntityId) { return this.#seeds.delete(id); }

  listSessionsByProject(projectId: ProjectId) { return this.#sessions.query((item) => item.projectId === projectId); }
  listSourcesBySession(sessionId: EntityId) { return this.#sources.query((item) => item.researchSessionId === sessionId); }
  listEvidenceBySession(sessionId: EntityId) { return this.#evidence.query((item) => item.researchSessionId === sessionId); }
  listObservationsBySession(sessionId: EntityId) { return this.#observations.query((item) => item.researchSessionId === sessionId); }
  listInsightsBySession(sessionId: EntityId) { return this.#insights.query((item) => item.researchSessionId === sessionId); }
  listOpportunitiesBySession(sessionId: EntityId) { return this.#opportunities.query((item) => item.researchSessionId === sessionId); }
  listSeedsBySession(sessionId: EntityId) { return this.#seeds.query((item) => item.researchSessionId === sessionId); }

  async createEvidenceBatch(inputs: readonly CreateEntityInput<ResearchEvidence>[]): Promise<readonly ResearchEvidence[]> {
    return runWriteTransaction(
      this.#database,
      [this.#evidenceTable, this.#sessionsTable, this.#sourcesTable],
      async () => {
      const created: ResearchEvidence[] = [];
      for (const input of inputs) created.push(await this.createEvidence(input));
      return created;
      },
    );
  }
}
