import { DB_VERSION, LEGACY_DB_VERSION } from "../constants.js";

export interface MigrationMapping {
  readonly legacyTable: string;
  readonly targetTable: string;
  readonly action: "reuse" | "retain" | "transform";
  readonly rollback: "dexie-transaction" | "preserve-source";
  readonly note: string;
}

export const V3_TO_V4_MAPPINGS: readonly MigrationMapping[] = [
  { legacyTable: "projects", targetTable: "projects", action: "transform", rollback: "dexie-transaction", note: "Add schemaVersion and normalize stage/status without deleting unknown fields." },
  { legacyTable: "briefs", targetTable: "briefs", action: "transform", rollback: "dexie-transaction", note: "Validate UUID/ISO fields; preserve invalid source records for recovery." },
  { legacyTable: "assets", targetTable: "assets", action: "transform", rollback: "preserve-source", note: "Keep metadata; data URLs are not deleted until AssetStorage migration succeeds." },
  { legacyTable: "moodboardItems", targetTable: "moodboardItems", action: "transform", rollback: "dexie-transaction", note: "Backfill moodboardId only when a deterministic parent can be proven." },
  { legacyTable: "directions", targetTable: "directions", action: "transform", rollback: "preserve-source", note: "Preserve legacy record when complete upstream IDs cannot be proven." },
  { legacyTable: "explorations", targetTable: "explorations", action: "transform", rollback: "preserve-source", note: "Keep direction/project linkage; no generated content is synthesized." },
  { legacyTable: "templates", targetTable: "templates", action: "transform", rollback: "preserve-source", note: "Map metadata only; formal strategy remains empty." },
  { legacyTable: "workflowRuns", targetTable: "workflowRuns", action: "transform", rollback: "preserve-source", note: "Map legacy status to typed workflow state when unambiguous." },
  { legacyTable: "assetCollections", targetTable: "assetCollections", action: "transform", rollback: "preserve-source", note: "Require a project scope before exposing through repositories." },
  { legacyTable: "analyses", targetTable: "analyses", action: "retain", rollback: "preserve-source", note: "Compatibility read only." },
  { legacyTable: "critiques", targetTable: "critiques", action: "retain", rollback: "preserve-source", note: "Compatibility read only; not promoted to AIReview." },
  { legacyTable: "versions", targetTable: "versions", action: "retain", rollback: "preserve-source", note: "Compatibility read only; new snapshots use versionSnapshots." },
  { legacyTable: "canvas", targetTable: "canvas", action: "retain", rollback: "preserve-source", note: "Legacy giant JSON remains readable; no automatic node conversion." },
  { legacyTable: "workspaceDocuments", targetTable: "workspaceDocuments", action: "retain", rollback: "preserve-source", note: "Workspace compatibility boundary." },
  { legacyTable: "workspaceBlobs", targetTable: "workspaceBlobs", action: "retain", rollback: "preserve-source", note: "Blob compatibility boundary; no automatic deletion." },
  { legacyTable: "providerConfigs", targetTable: "providerConfigs", action: "retain", rollback: "preserve-source", note: "Quarantined; never copied into new domain tables or exports." },
] as const;

export const V3_TO_V4_PLAN = Object.freeze({
  fromVersion: LEGACY_DB_VERSION,
  toVersion: DB_VERSION,
  destructive: false,
  automaticReset: false,
  recoveryOnFailure: true,
  mappings: V3_TO_V4_MAPPINGS,
});
