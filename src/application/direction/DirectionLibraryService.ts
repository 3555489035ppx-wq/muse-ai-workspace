import type { Direction } from "../../domain/direction/index.js";
import type { VersionSnapshot } from "../../domain/version/index.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { DirectionRepository } from "../../repositories/DirectionRepository.js";
import { VersionRepository } from "../../repositories/VersionRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { toIsoTimestamp } from "../../domain/shared/time.js";

const LIBRARY_LABEL = "direction-library";
export interface DirectionLibraryRecord { readonly id: EntityId; readonly originProjectId: ProjectId; readonly originDirectionId: EntityId; readonly title: string; readonly concept: string; readonly savedAt: string; readonly favorite: boolean; readonly narrative?: string; readonly visualDNA?: Direction["visualDNA"]; readonly advantages?: readonly string[]; readonly risks?: readonly string[]; }
export interface ReuseDirectionInput { readonly targetProjectId: ProjectId; readonly researchSessionId: EntityId; readonly moodboardId: EntityId; readonly visualDNAId: EntityId; readonly creativeSeedIds: readonly EntityId[]; readonly opportunityIds: readonly EntityId[]; }
export class DirectionLibraryError extends Error { constructor(readonly code: "NOT_FOUND" | "PROJECT_SCOPE" | "INVALID_PROVENANCE", message: string) { super(message); this.name = "DirectionLibraryError"; } }

function toRecord(snapshot: VersionSnapshot): DirectionLibraryRecord | undefined {
  const originProjectId = snapshot.snapshot.originProjectId; const originDirectionId = snapshot.snapshot.originDirectionId; const title = snapshot.snapshot.title; const concept = snapshot.snapshot.concept;
  if (typeof originProjectId !== "string" || typeof originDirectionId !== "string" || typeof title !== "string" || typeof concept !== "string") return undefined;
  const direction=typeof snapshot.snapshot.direction==="object"&&snapshot.snapshot.direction!==null?snapshot.snapshot.direction as Partial<Direction>:undefined;
  return { id: snapshot.id, originProjectId: originProjectId as ProjectId, originDirectionId: originDirectionId as EntityId, title, concept, savedAt: snapshot.createdAt, favorite: snapshot.snapshot.favorite === true, narrative:direction?.narrative,visualDNA:direction?.visualDNA,advantages:direction?.advantages,risks:direction?.risks };
}
export class DirectionLibraryService {
  readonly #database: MuseDatabase; readonly #directions: DirectionRepository; readonly #versions: VersionRepository; readonly #idFactory: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly clock?: RepositoryClock; readonly entityIdFactory?: () => EntityId } = {}) { this.#database = database; this.#directions = new DirectionRepository(database, options.clock); this.#versions = new VersionRepository(database, options.clock); this.#idFactory = options.entityIdFactory ?? (() => createEntityId()); }
  async save(originProjectId: ProjectId, originDirectionId: EntityId): Promise<DirectionLibraryRecord> {
    const direction = await this.#directions.getDirection(originDirectionId); if (!direction) throw new DirectionLibraryError("NOT_FOUND", "Direction does not exist."); if (direction.projectId !== originProjectId) throw new DirectionLibraryError("PROJECT_SCOPE", "Direction belongs to another project.");
    const existing = (await this.#versions.listByEntity(originProjectId, originDirectionId)).find((item) => item.label === LIBRARY_LABEL); if (existing) return toRecord(existing)!;
    const snapshot = await this.#versions.create({ id: this.#idFactory(), projectId: originProjectId, entityType: "direction", entityId: originDirectionId, schemaVersion: 1, label: LIBRARY_LABEL, snapshot: { originProjectId, originDirectionId, title: direction.title, concept: direction.concept, direction: { title: direction.title, concept: direction.concept, narrative: direction.narrative, visualDNA: direction.visualDNA, advantages: direction.advantages, risks: direction.risks } } }); return toRecord(snapshot)!;
  }
  async list(): Promise<readonly DirectionLibraryRecord[]> { const snapshots = await this.#database.table<VersionSnapshot, EntityId>("versionSnapshots").where("entityType").equals("direction").toArray(); return snapshots.filter((item) => item.label === LIBRARY_LABEL).map(toRecord).filter((item): item is DirectionLibraryRecord => item !== undefined); }
  async toggleFavorite(libraryId: EntityId): Promise<boolean> {
    const snapshot = await this.#versions.get(libraryId);
    if (!snapshot || snapshot.label !== LIBRARY_LABEL) throw new DirectionLibraryError("NOT_FOUND", "Direction library record does not exist.");
    const favorite = snapshot.snapshot.favorite !== true;
    await this.#database.table<VersionSnapshot, EntityId>("versionSnapshots").update(libraryId, { snapshot: { ...snapshot.snapshot, favorite }, updatedAt: toIsoTimestamp(new Date()) });
    return favorite;
  }
  async reuseToProject(libraryId: EntityId, targetProjectId: ProjectId): Promise<Direction> {
    const research = await this.#database.table<{ readonly id: EntityId }, EntityId>("researchSessions").where("projectId").equals(targetProjectId).first();
    const moodboard = await this.#database.table<{ readonly id: EntityId }, EntityId>("moodboards").where("projectId").equals(targetProjectId).first();
    const visualDNA = moodboard ? await this.#database.table<{ readonly id: EntityId }, EntityId>("visualDna").where("moodboardId").equals(moodboard.id).first() : undefined;
    const creativeSeeds = await this.#database.table<{ readonly id: EntityId }, EntityId>("creativeSeeds").where("projectId").equals(targetProjectId).toArray();
    const opportunities = await this.#database.table<{ readonly id: EntityId }, EntityId>("researchOpportunities").where("projectId").equals(targetProjectId).toArray();
    if (!research || !moodboard || !visualDNA || creativeSeeds.length === 0 || opportunities.length === 0) throw new DirectionLibraryError("INVALID_PROVENANCE", "目标项目需要先完成研究与情绪板。 ");
    return this.reuse(libraryId, { targetProjectId, researchSessionId: research.id, moodboardId: moodboard.id, visualDNAId: visualDNA.id, creativeSeedIds: creativeSeeds.map((item) => item.id), opportunityIds: opportunities.map((item) => item.id) });
  }
  async reuse(libraryId: EntityId, input: ReuseDirectionInput): Promise<Direction> {
    const source = await this.#versions.get(libraryId); if (!source || source.label !== LIBRARY_LABEL) throw new DirectionLibraryError("NOT_FOUND", "Direction library record does not exist."); const data = source.snapshot.direction;
    if (typeof data !== "object" || data === null) throw new DirectionLibraryError("INVALID_PROVENANCE", "Direction library snapshot is incomplete."); const shape = data as Pick<Direction, "title" | "concept" | "narrative" | "visualDNA" | "advantages" | "risks">; const directionId = this.#idFactory();
    const tables = ["projects", "moodboards", "visualDna", "creativeSeeds", "researchOpportunities", "directions", "versionSnapshots"].map((name) => this.#database.table(name));
    return runWriteTransaction(this.#database, tables, async () => { const reused = await this.#directions.createDirection({ id: directionId, projectId: input.targetProjectId, researchSessionId: input.researchSessionId, moodboardId: input.moodboardId, visualDNAId: input.visualDNAId, creativeSeedIds: input.creativeSeedIds, opportunityIds: input.opportunityIds, title: shape.title, concept: shape.concept, narrative: shape.narrative, visualDNA: shape.visualDNA, advantages: shape.advantages, risks: shape.risks, status: "candidate" }); await this.#versions.create({ id: this.#idFactory(), projectId: input.targetProjectId, entityType: "direction", entityId: reused.id, schemaVersion: 1, label: "direction-library:reuse", snapshot: { originProjectId: source.snapshot.originProjectId, originDirectionId: source.snapshot.originDirectionId, libraryId, reusedDirectionId: reused.id } }); return reused; });
  }
}
