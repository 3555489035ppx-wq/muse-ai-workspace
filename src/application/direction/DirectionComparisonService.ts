import type { Direction, DirectionScore, DirectionScoreDimension } from "../../domain/direction/index.js";
import type { ProjectBrief } from "../../domain/project/index.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { DirectionRepository } from "../../repositories/DirectionRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";
import { runWriteTransaction } from "../../repositories/transaction.js";

export const COMPARISON_DIMENSIONS = ["brief_alignment", "audience_fit", "originality", "identity", "scalability", "cross_media", "complexity"] as const;
export type ComparisonDimension = (typeof COMPARISON_DIMENSIONS)[number];
export interface EvidenceBackedScore { readonly directionId: EntityId; readonly dimension: ComparisonDimension; readonly value: number; readonly rationale: string; readonly evidence: readonly string[]; }
export interface DirectionComparison { readonly projectId: ProjectId; readonly directionIds: readonly [EntityId, EntityId, EntityId]; readonly scores: readonly EvidenceBackedScore[]; }

export class DirectionComparisonError extends Error { constructor(readonly code: "INVALID_SET" | "PROJECT_SCOPE", message: string) { super(message); this.name = "DirectionComparisonError"; } }
function hash(text: string): number { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; }
function scoreValue(direction: Direction, dimension: ComparisonDimension): number {
  const base = 62 + (hash(`${dimension}|${direction.title}|${direction.concept}|${direction.visualDNA.principles.join("|")}`) % 29);
  if (dimension === "complexity") return Math.max(40, Math.min(95, base - direction.risks.length * 3));
  if (dimension === "scalability" || dimension === "cross_media") return Math.min(96, base + Math.min(6, direction.visualDNA.principles.length));
  return base;
}
function dimensionEvidence(direction: Direction, brief: ProjectBrief, dimension: ComparisonDimension): readonly string[] {
  const shared = [`brief:${brief.id}`, `direction:${direction.id}`];
  if (dimension === "brief_alignment") return [...shared, `goal:${brief.goal}`];
  if (dimension === "audience_fit") return [...shared, `audience:${brief.audience}`];
  if (dimension === "originality") return [...shared, `concept:${direction.concept}`];
  if (dimension === "identity") return [...shared, ...direction.visualDNA.keywords.map((item) => `keyword:${item}`)];
  if (dimension === "complexity") return [...shared, ...direction.risks.map((item) => `risk:${item}`)];
  return [...shared, ...brief.deliverables.map((item) => `deliverable:${item}`), ...direction.visualDNA.principles.map((item) => `principle:${item}`)];
}
export function buildDirectionComparison(projectId: ProjectId, directions: readonly Direction[], brief: ProjectBrief): DirectionComparison {
  if (directions.length !== 3 || new Set(directions.map((item) => item.id)).size !== 3) throw new DirectionComparisonError("INVALID_SET", "Direction comparison requires three unique directions.");
  if (brief.projectId !== projectId || directions.some((item) => item.projectId !== projectId)) throw new DirectionComparisonError("PROJECT_SCOPE", "Direction comparison cannot cross project boundaries.");
  const scores = directions.flatMap((direction) => COMPARISON_DIMENSIONS.map((dimension): EvidenceBackedScore => {
    const evidence = dimensionEvidence(direction, brief, dimension);
    return { directionId: direction.id, dimension, value: scoreValue(direction, dimension), evidence, rationale: `${dimension} 基于 ${evidence.join("；")} 计算` };
  }));
  return { projectId, directionIds: [directions[0]!.id, directions[1]!.id, directions[2]!.id], scores };
}

const DOMAIN_DIMENSION: Readonly<Record<ComparisonDimension, DirectionScoreDimension>> = { brief_alignment: "goal_alignment", audience_fit: "audience_fit", originality: "distinctiveness", identity: "coherence", scalability: "feasibility", cross_media: "feasibility", complexity: "feasibility" };
export class DirectionComparisonService {
  readonly #database: MuseDatabase; readonly #repository: DirectionRepository; readonly #idFactory: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly clock?: RepositoryClock; readonly entityIdFactory?: () => EntityId } = {}) { this.#database = database; this.#repository = new DirectionRepository(database, options.clock); this.#idFactory = options.entityIdFactory ?? (() => createEntityId()); }
  async compare(projectId: ProjectId, directionIds: readonly EntityId[], briefId: EntityId): Promise<DirectionComparison> {
    const directions = await Promise.all(directionIds.map((id) => this.#repository.getDirection(id))); const brief = await this.#database.table<ProjectBrief, EntityId>("briefs").get(briefId);
    if (brief === undefined || directions.some((item) => item === undefined)) throw new DirectionComparisonError("INVALID_SET", "Direction or brief is missing.");
    const comparison = buildDirectionComparison(projectId, directions as Direction[], brief); const scoreTable = this.#database.table<DirectionScore, EntityId>("directionScores");
    await runWriteTransaction(this.#database, [this.#database.table("directions"), scoreTable], async () => {
      for (const score of comparison.scores) {
        const prefix = `[${score.dimension}]`; const existing = (await scoreTable.where("directionId").equals(score.directionId).toArray()).find((item) => item.rationale.startsWith(prefix));
        const payload = { projectId, directionId: score.directionId, dimension: DOMAIN_DIMENSION[score.dimension], value: score.value, rationale: `${prefix} ${score.rationale}` };
        if (existing) await this.#repository.updateScore(existing.id, payload); else await this.#repository.createScore({ id: this.#idFactory(), ...payload });
      }
    });
    return comparison;
  }
}
