export interface TableSchemaDefinition {
  readonly primaryKey: string;
  readonly indexes: readonly string[];
  readonly dexie: string;
  readonly parentIndexes: readonly string[];
  readonly legacy: boolean;
}

function table(
  primaryKey: string,
  indexes: readonly string[],
  parentIndexes: readonly string[] = [],
  legacy = false,
): TableSchemaDefinition {
  return {
    primaryKey,
    indexes,
    dexie: [primaryKey, ...indexes].join(", "),
    parentIndexes,
    legacy,
  };
}

export const TARGET_SCHEMA = {
  projects: table("id", ["status", "stage", "updatedAt", "schemaVersion"]),
  briefs: table("id", ["projectId", "updatedAt"], ["projectId"]),
  researchSessions: table("id", ["projectId", "briefId", "status", "updatedAt"], ["projectId", "briefId"]),
  researchSources: table("id", ["projectId", "researchSessionId", "type"], ["projectId", "researchSessionId"]),
  researchEvidence: table("id", ["projectId", "researchSessionId", "sourceId"], ["projectId", "researchSessionId", "sourceId"]),
  researchObservations: table("id", ["projectId", "researchSessionId"], ["projectId", "researchSessionId"]),
  researchInsights: table("id", ["projectId", "researchSessionId"], ["projectId", "researchSessionId"]),
  researchOpportunities: table("id", ["projectId", "researchSessionId"], ["projectId", "researchSessionId"]),
  creativeSeeds: table("id", ["projectId", "researchSessionId"], ["projectId", "researchSessionId"]),
  assets: table("id", ["status", "type", "updatedAt"]),
  assetSources: table("id", ["projectId", "assetId", "type"], ["projectId", "assetId"]),
  assetAnalyses: table("id", ["projectId", "assetId", "kind"], ["projectId", "assetId"]),
  assetCollections: table("id", ["projectId", "updatedAt"], ["projectId"]),
  assetBlobs: table("id", ["updatedAt"]),
  moodboards: table("id", ["projectId", "researchSessionId", "status"], ["projectId", "researchSessionId"]),
  moodboardItems: table("id", ["projectId", "moodboardId", "assetId", "position"], ["projectId", "moodboardId", "assetId"]),
  visualDna: table("id", ["projectId", "moodboardId"], ["projectId", "moodboardId"]),
  directions: table("id", ["projectId", "moodboardId", "visualDNAId", "status", "updatedAt"], ["projectId", "moodboardId", "visualDNAId"]),
  directionReferences: table("id", ["projectId", "directionId", "assetId"], ["projectId", "directionId", "assetId"]),
  directionScores: table("id", ["projectId", "directionId", "dimension"], ["projectId", "directionId"]),
  explorations: table("id", ["projectId", "directionId", "visualDNAId", "status"], ["projectId", "directionId", "visualDNAId"]),
  explorationVariants: table("id", ["projectId", "explorationId", "directionId", "status"], ["projectId", "explorationId", "directionId"]),
  promptSpecs: table("id", ["projectId", "explorationId", "directionId", "visualDNAId"], ["projectId", "explorationId", "directionId", "visualDNAId"]),
  promptVersions: table("id", ["projectId", "promptSpecId", "explorationId", "version"], ["projectId", "promptSpecId", "explorationId"]),
  generationJobs: table("id", ["projectId", "promptVersionId", "status"], ["projectId", "promptVersionId"]),
  generatedAssets: table("id", ["projectId", "generationJobId", "promptVersionId", "assetId"], ["projectId", "generationJobId", "promptVersionId", "assetId"]),
  imageEdits: table("id", ["projectId", "generatedAssetId", "sourceAssetId", "promptVersionId", "type"], ["projectId", "generatedAssetId", "sourceAssetId", "promptVersionId"]),
  aiReviews: table("id", ["projectId", "generatedAssetId", "promptVersionId", "directionId"], ["projectId", "generatedAssetId", "promptVersionId", "directionId"]),
  templates: table("id", ["status", "updatedAt", "schemaVersion"]),
  versionSnapshots: table("id", ["projectId", "entityType", "entityId", "parentVersionId", "updatedAt"], ["projectId", "entityId", "parentVersionId"]),
  workflowRuns: table("id", ["projectId", "entityType", "entityId", "state", "updatedAt"], ["projectId", "entityId"]),
  operations: table("id", ["projectId", "kind", "state", "targetEntityId"], ["projectId", "targetEntityId"]),
  asyncTasks: table("id", ["projectId", "operationId", "status"], ["projectId", "operationId"]),
  canvases: table("id", ["projectId", "updatedAt"], ["projectId"]),
  canvasNodes: table("id", ["projectId", "canvasId", "entityType", "entityId"], ["projectId", "canvasId", "entityId"]),
  canvasEdges: table("id", ["projectId", "canvasId", "sourceNodeId", "targetNodeId"], ["projectId", "canvasId", "sourceNodeId", "targetNodeId"]),
  canvasViewports: table("id", ["projectId", "canvasId"], ["projectId", "canvasId"]),

  // Retained compatibility stores. No new domain write path targets these stores.
  analyses: table("id", ["projectId", "createdAt"], ["projectId"], true),
  critiques: table("id", ["projectId", "explorationId"], ["projectId", "explorationId"], true),
  versions: table("id", ["projectId", "number", "parentVersionId"], ["projectId", "parentVersionId"], true),
  canvas: table("projectId", [], ["projectId"], true),
  collections: table("id", ["workspaceId", "kind", "updatedAt"], ["workspaceId"], true),
  workspaceDocuments: table("id", ["workspaceId", "type", "updatedAt"], ["workspaceId"], true),
  workspaceBlobs: table("id", ["workspaceId", "updatedAt"], ["workspaceId"], true),
  workflows: table("id", ["workspaceId", "type", "updatedAt"], ["workspaceId"], true),
  versionEdges: table("id", ["projectId", "parentVersionId", "childVersionId"], ["projectId", "parentVersionId", "childVersionId"], true),
  templateFavorites: table("id", ["templateId", "updatedAt"], ["templateId"], true),
  researchItems: table("id", ["projectId", "evidenceStatus", "updatedAt"], ["projectId"], true),
  directionLibrary: table("id", ["sourceProjectId", "favorite", "archived", "updatedAt"], ["sourceProjectId"], true),
  preferences: table("id", ["updatedAt"], [], true),
  trash: table("id", ["entityType", "entityId", "deletedAt"], ["entityId"], true),
  providerConfigs: table("id", ["kind", "updatedAt"], [], true),
  critiqueRubrics: table("id", ["updatedAt"], [], true),
  critiqueRuns: table("id", ["projectId", "explorationId", "createdAt"], ["projectId", "explorationId"], true),
} as const satisfies Record<string, TableSchemaDefinition>;

export type MuseTableName = keyof typeof TARGET_SCHEMA;
export const TARGET_TABLE_NAMES = Object.freeze(Object.keys(TARGET_SCHEMA) as MuseTableName[]);
export const DEXIE_STORES = Object.freeze(
  Object.fromEntries(
    Object.entries(TARGET_SCHEMA).map(([name, definition]) => [name, definition.dexie]),
  ) as Readonly<Record<MuseTableName, string>>,
);
