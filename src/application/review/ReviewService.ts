import type { ReviewDimensionKey } from "../../domain/review/index.js";
import type { ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { ProjectWorkflowService } from "../../domain/services/ProjectWorkflowService.js";
import type { ProjectScopedEntity } from "../../domain/shared/entity.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { DeterministicMockReviewProvider } from "../../infrastructure/providers/mock/review/index.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import { ReviewRepository } from "../../repositories/ReviewRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { VersionRepository } from "../../repositories/VersionRepository.js";
import { type ReviewProvider, ReviewProviderError, validateReviewOutput } from "./ReviewProvider.js";

interface WorkflowRecord extends ProjectScopedEntity { readonly entityId: EntityId; readonly entityType: "Project"; readonly state: ProjectWorkflowState; }
const DOMAIN_KEY = { brief_match: "goal_alignment", direction: "visual_coherence", audience: "audience_fit", identity: "distinctiveness", composition: "craft", originality: "distinctiveness", cross_media: "feasibility" } satisfies Record<string, ReviewDimensionKey>;
export class ReviewService {
  readonly #database: MuseDatabase; readonly #repository: ReviewRepository; readonly #versions: VersionRepository; readonly #workflows: BaseRepository<WorkflowRecord>; readonly #workflow = new ProjectWorkflowService(); readonly #provider: ReviewProvider; readonly #ids: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly provider?: ReviewProvider; readonly entityIdFactory?: () => EntityId } = {}) { this.#database = database; this.#repository = new ReviewRepository(database); this.#versions = new VersionRepository(database); this.#workflows = new BaseRepository(database.table("workflowRuns"), "ProjectWorkflow"); this.#provider = options.provider ?? new DeterministicMockReviewProvider(); this.#ids = options.entityIdFactory ?? createEntityId; }
  async review(projectId: ProjectId, generatedAssetId: EntityId) {
    const generatedAsset = await this.#database.table("generatedAssets").get(generatedAssetId); if (!generatedAsset || generatedAsset.projectId !== projectId) throw new ReviewProviderError("INVALID_INPUT", "GeneratedAsset is missing or outside the project.");
    const promptVersion = await this.#database.table("promptVersions").get(generatedAsset.promptVersionId); const direction = promptVersion ? await this.#database.table("directions").get(promptVersion.directionId) : undefined; const brief = await this.#database.table("briefs").where("projectId").equals(projectId).first();
    if (!promptVersion || !direction || !brief || promptVersion.projectId !== projectId || direction.projectId !== projectId) throw new ReviewProviderError("INVALID_INPUT", "Review lineage is incomplete.");
    const output = validateReviewOutput(await this.#provider.review({ brief, direction, generatedAsset, promptVersion })); const reviewId = this.#ids(); const versionId = this.#ids(); const workflowRecord = await this.#database.table<WorkflowRecord, EntityId>("workflowRuns").where("projectId").equals(projectId).first();
    await runWriteTransaction(this.#database, [this.#database.table("projects"), this.#database.table("generatedAssets"), this.#database.table("promptVersions"), this.#database.table("directions"), this.#database.table("explorations"), this.#database.table("aiReviews"), this.#database.table("versionSnapshots"), this.#database.table("workflowRuns")], async () => {
      await this.#repository.create({ id: reviewId, projectId, generatedAssetId, promptVersionId: promptVersion.id, directionId: direction.id, dimensions: output.dimensions.map(item => ({ ...item, dimension: DOMAIN_KEY[item.key], evidence: `[${item.key}] ${item.evidence}` })), summary: output.summary });
      await this.#versions.create({ id: versionId, projectId, entityType: "generated_asset", entityId: generatedAssetId, schemaVersion: 1, label: "ai-review:deterministic-mock", snapshot: { reviewId, rubric: output.dimensions.map(item => item.key), scores: output.dimensions.map(item => item.score), provider: this.#provider.id, mock: this.#provider.mock } });
      if (workflowRecord) { const reviewing = this.#workflow.transition(workflowRecord.state, "REVIEWING"); await this.#workflows.update(workflowRecord.id, { state: this.#workflow.transition(reviewing, "REVIEWED") }); }
    });
    const saved = await this.#repository.get(reviewId); if (!saved) throw new ReviewProviderError("INVALID_OUTPUT", "Review persistence failed."); return { review: saved, rubric: output.dimensions };
  }
}
