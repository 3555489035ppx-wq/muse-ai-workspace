import type { Asset, AssetAnalysis, AssetCollection, AssetSource } from "../asset/index.js";
import type { AssetStorage } from "../asset/AssetStorage.js";
import type { DirectionReference } from "../direction/index.js";
import { EntityNotFoundError } from "../errors/index.js";
import type { ExplorationVariant } from "../exploration/index.js";
import type { GeneratedAsset, ImageEdit } from "../generation/index.js";
import type { MoodboardItem } from "../moodboard/index.js";
import type { Project } from "../project/index.js";
import { createProjectId, type EntityId, type ProjectId } from "../shared/id.js";
import type { ProjectScopedEntity } from "../shared/entity.js";
import type { MuseDatabase } from "../../db/database.js";
import { IndexedDbAssetStorage } from "../../db/assetStorage.js";
import { ProjectRepository } from "../../repositories/ProjectRepository.js";
import type { RepositoryClock } from "../../repositories/base/types.js";

const PROJECT_SCOPED_TABLES = [
  "briefs", "researchSessions", "researchSources", "researchEvidence", "researchObservations", "researchInsights", "researchOpportunities", "creativeSeeds",
  "assetSources", "assetAnalyses", "assetCollections", "moodboards", "moodboardItems", "visualDna", "directions", "directionReferences", "directionScores",
  "explorations", "explorationVariants", "promptSpecs", "promptVersions", "generationJobs", "generatedAssets", "imageEdits", "aiReviews", "versionSnapshots",
  "workflowRuns", "operations", "asyncTasks", "canvases", "canvasNodes", "canvasEdges", "canvasViewports",
] as const;

export interface MinimalProjectInput extends Omit<Project, "id" | "createdAt" | "updatedAt"> { readonly id?: ProjectId; }
export interface OrphanIssue { readonly table: string; readonly entityId: EntityId; readonly missingParentId: EntityId; }
export type CascadeFaultInjector = () => void | Promise<void>;

type AssetIdRow = Readonly<{ assetId: EntityId }>;
type AssetIdsRow = Readonly<{ assetIds: readonly EntityId[] }>;
type SourceAssetIdsRow = Readonly<{ sourceAssetIds: readonly EntityId[] }>;

export class ProjectLifecycleService {
  readonly #database: MuseDatabase;
  readonly #storage: AssetStorage;
  readonly #projects: ProjectRepository;
  readonly #idFactory: () => ProjectId;

  constructor(database: MuseDatabase, options: { readonly storage?: AssetStorage; readonly clock?: RepositoryClock; readonly idFactory?: () => ProjectId } = {}) {
    this.#database = database;
    this.#storage = options.storage ?? new IndexedDbAssetStorage(database);
    this.#projects = new ProjectRepository(database, options.clock);
    this.#idFactory = options.idFactory ?? (() => createProjectId());
  }

  createMinimalProject(input: MinimalProjectInput): Promise<Project> {
    const { id = this.#idFactory(), ...project } = input;
    return this.#projects.create({ id, ...project });
  }

  async deleteProject(projectId: ProjectId, injectFailure?: CascadeFaultInjector): Promise<void> {
    if ((await this.#projects.get(projectId)) === undefined) throw new EntityNotFoundError("Project", projectId);
    const scopedTables = PROJECT_SCOPED_TABLES.map((name) => this.#database.table<ProjectScopedEntity, EntityId>(name));
    const assets = this.#database.table<Asset, EntityId>("assets");
    const blobTable = this.#database.table("assetBlobs");
    const projects = this.#database.table<Project, EntityId>("projects");

    await this.#database.transaction("rw", [...scopedTables, assets, blobTable, projects], async () => {
      const candidates = await this.#collectProjectAssetIds(projectId);
      for (const table of scopedTables) await table.where("projectId").equals(projectId).delete();
      await injectFailure?.();
      for (const assetId of candidates) {
        if (!(await this.#isAssetReferenced(assetId))) {
          await assets.delete(assetId);
          await this.#storage.delete(assetId);
        }
      }
      await projects.delete(projectId);
    });
  }

  async #collectProjectAssetIds(projectId: ProjectId): Promise<ReadonlySet<EntityId>> {
    const ids = new Set<EntityId>();
    const singleTables = ["assetSources", "assetAnalyses", "moodboardItems", "directionReferences", "generatedAssets"] as const;
    for (const name of singleTables) {
      const rows = await this.#database.table<ProjectScopedEntity & AssetIdRow, EntityId>(name).where("projectId").equals(projectId).toArray();
      for (const row of rows) ids.add(row.assetId);
    }
    const edits = await this.#database.table<ImageEdit, EntityId>("imageEdits").where("projectId").equals(projectId).toArray();
    for (const edit of edits) ids.add(edit.sourceAssetId);
    const collections = await this.#database.table<AssetCollection, EntityId>("assetCollections").where("projectId").equals(projectId).toArray();
    for (const collection of collections) for (const assetId of collection.assetIds) ids.add(assetId);
    const variants = await this.#database.table<ExplorationVariant, EntityId>("explorationVariants").where("projectId").equals(projectId).toArray();
    for (const variant of variants) for (const assetId of variant.sourceAssetIds) ids.add(assetId);
    return ids;
  }

  async #isAssetReferenced(assetId: EntityId): Promise<boolean> {
    const singleTables = ["assetSources", "assetAnalyses", "moodboardItems", "directionReferences", "generatedAssets"] as const;
    for (const name of singleTables) if ((await this.#database.table<AssetIdRow, EntityId>(name).where("assetId").equals(assetId).count()) > 0) return true;
    if ((await this.#database.table<ImageEdit, EntityId>("imageEdits").where("sourceAssetId").equals(assetId).count()) > 0) return true;
    const collections = await this.#database.table<AssetIdsRow, EntityId>("assetCollections").toArray();
    if (collections.some((row) => row.assetIds.includes(assetId))) return true;
    const variants = await this.#database.table<SourceAssetIdsRow, EntityId>("explorationVariants").toArray();
    return variants.some((row) => row.sourceAssetIds.includes(assetId));
  }

  async scanOrphans(): Promise<readonly OrphanIssue[]> {
    const projectIds = new Set((await this.#database.table<Project, EntityId>("projects").toArray()).map((project) => project.id));
    const assetIds = new Set((await this.#database.table<Asset, EntityId>("assets").toArray()).map((asset) => asset.id));
    const issues: OrphanIssue[] = [];
    for (const tableName of PROJECT_SCOPED_TABLES) {
      const rows = await this.#database.table<ProjectScopedEntity, EntityId>(tableName).toArray();
      for (const row of rows) if (!projectIds.has(row.projectId)) issues.push({ table: tableName, entityId: row.id, missingParentId: row.projectId });
    }
    const assetRows: readonly (ProjectScopedEntity & AssetIdRow)[] = [
      ...await this.#database.table<AssetSource, EntityId>("assetSources").toArray(),
      ...await this.#database.table<AssetAnalysis, EntityId>("assetAnalyses").toArray(),
      ...await this.#database.table<MoodboardItem, EntityId>("moodboardItems").toArray(),
      ...await this.#database.table<DirectionReference, EntityId>("directionReferences").toArray(),
      ...await this.#database.table<GeneratedAsset, EntityId>("generatedAssets").toArray(),
    ];
    for (const row of assetRows) if (!assetIds.has(row.assetId)) issues.push({ table: "asset-reference", entityId: row.id, missingParentId: row.assetId });
    return issues;
  }
}
