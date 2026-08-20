import Dexie, { type Table } from "dexie";

import type { Entity } from "../domain/shared/entity.js";
import { DB_VERSION, MUSE_DB_NAME } from "./constants.js";
import { type V4MigrationRunner, runV4Migration } from "./migrations/v4.js";
import { DEXIE_STORES, type MuseTableName } from "./schema.js";

export const LEGACY_V1_STORES = {
  projects: "id, stage, updatedAt, isDraft",
  briefs: "id, projectId, updatedAt",
  assets: "id, projectId, createdAt",
  moodboardItems: "id, projectId, assetId",
  analyses: "id, projectId, createdAt",
  directions: "id, projectId, lockedAt",
  explorations: "id, projectId, directionId, status, createdAt",
  critiques: "id, projectId, explorationId",
  versions: "id, projectId, number, parentVersionId",
  canvas: "projectId",
} as const;

export const LEGACY_V2_STORES = {
  ...LEGACY_V1_STORES,
  collections: "id, workspaceId, kind, updatedAt",
  workspaceDocuments: "id, workspaceId, type, updatedAt",
  workspaceBlobs: "id, workspaceId, updatedAt",
  workflows: "id, workspaceId, type, updatedAt",
  workflowRuns: "id, workflowId, projectId, status, createdAt",
  versionEdges: "id, projectId, parentVersionId, childVersionId",
} as const;

export const LEGACY_V3_STORES = {
  ...LEGACY_V2_STORES,
  projects: "id, stage, updatedAt, isDraft, status",
  assets: "id, projectId, createdAt, favorite, kind",
  moodboardItems: "id, projectId, assetId, groupId",
  directions: "id, projectId, lockedAt, updatedAt",
  versions: "id, projectId, number, parentVersionId, branchId",
  templates: "id, category, updatedAt, ownerType",
  templateFavorites: "id, templateId, updatedAt",
  researchItems: "id, projectId, evidenceStatus, updatedAt",
  assetCollections: "id, kind, updatedAt",
  directionLibrary: "id, sourceProjectId, favorite, archived, updatedAt",
  preferences: "id, updatedAt",
  trash: "id, entityType, entityId, deletedAt",
  providerConfigs: "id, kind, updatedAt",
  critiqueRubrics: "id, updatedAt",
  critiqueRuns: "id, projectId, explorationId, createdAt",
} as const;

export interface MuseDatabaseDependencies {
  readonly indexedDB: IDBFactory;
  readonly IDBKeyRange: typeof globalThis.IDBKeyRange;
}

export interface MuseDatabaseOptions {
  readonly dependencies?: MuseDatabaseDependencies;
  readonly migrationRunner?: V4MigrationRunner;
}

export class MuseDatabase extends Dexie {
  constructor(name: string, options: MuseDatabaseOptions = {}) {
    super(name, options.dependencies);
    this.version(1).stores(LEGACY_V1_STORES);
    this.version(2).stores(LEGACY_V2_STORES);
    this.version(3).stores(LEGACY_V3_STORES);
    this.version(DB_VERSION)
      .stores(DEXIE_STORES)
      .upgrade((transaction) =>
        runV4Migration(transaction, options.migrationRunner),
      );
  }

  tableOf<T extends Entity>(name: MuseTableName): Table<T, string> {
    return this.table<T, string>(name);
  }
}

export function createMuseDatabase(
  name = MUSE_DB_NAME,
  options: MuseDatabaseOptions = {},
): MuseDatabase {
  return new MuseDatabase(name, options);
}

let defaultDatabase: MuseDatabase | undefined;

export function getDefaultDatabase(): MuseDatabase {
  defaultDatabase ??= createMuseDatabase();
  return defaultDatabase;
}

export const db = getDefaultDatabase();
