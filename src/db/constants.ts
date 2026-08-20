export const MUSE_DB_NAME = "muse-creative-workspace";
export const LEGACY_DB_VERSION = 3;
export const DB_VERSION = 4;

export const LEGACY_V3_TABLES = [
  "projects", "briefs", "assets", "moodboardItems", "analyses",
  "directions", "explorations", "critiques", "versions", "canvas",
  "collections", "workspaceDocuments", "workspaceBlobs", "workflows",
  "workflowRuns", "versionEdges", "templates", "templateFavorites",
  "researchItems", "assetCollections", "directionLibrary", "preferences",
  "trash", "providerConfigs", "critiqueRubrics", "critiqueRuns",
] as const;
