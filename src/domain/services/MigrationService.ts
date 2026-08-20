import type { Table } from "dexie";
import { DomainError, StorageMigrationError } from "../errors/index.js";
import { toIsoTimestamp } from "../shared/time.js";
import type { MuseDatabase } from "../../db/database.js";
import { CURRENT_MUSE_SCHEMA_VERSION, isMuseSchemaVersionRecord, MUSE_SCHEMA_VERSION_KEY, type MuseSchemaVersionRecord } from "../../db/migrations/metadata.js";

export type MigrationState = "ready" | "migrated" | "recovery_required" | "reset";

export interface MigrationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export interface MigrationResult {
  readonly state: MigrationState;
  readonly fromVersion?: number;
  readonly toVersion: number;
  readonly diagnostic?: MigrationDiagnostic;
}

export interface MigrationServiceOptions {
  readonly clock?: () => Date;
  readonly beforeCommit?: () => void | Promise<void>;
}

function diagnostic(error: unknown): MigrationDiagnostic {
  if (error instanceof DomainError) return { code: error.code, message: error.message, context: error.context };
  return { code: "MIGRATION_UNKNOWN_FAILURE", message: error instanceof Error ? error.message : "Unknown migration failure.", context: {} };
}

export class MigrationService {
  readonly #database: MuseDatabase;
  readonly #versions: Table<MuseSchemaVersionRecord, string>;
  readonly #clock: () => Date;
  readonly #beforeCommit?: () => void | Promise<void>;

  constructor(database: MuseDatabase, options: MigrationServiceOptions = {}) {
    this.#database = database;
    this.#versions = database.table("preferences");
    this.#clock = options.clock ?? (() => new Date());
    this.#beforeCommit = options.beforeCommit;
  }

  async inspectAndMigrate(): Promise<MigrationResult> {
    try {
      await this.#database.open();
      return await this.#database.transaction("rw", this.#versions, async () => {
        const raw: unknown = await this.#versions.get(MUSE_SCHEMA_VERSION_KEY);
        if (raw === undefined) {
          await this.#beforeCommit?.();
          await this.#writeCurrentVersion();
          return { state: "migrated", toVersion: CURRENT_MUSE_SCHEMA_VERSION };
        }
        if (!isMuseSchemaVersionRecord(raw)) throw new DomainError("MIGRATION_METADATA_CORRUPT", "The schema version marker is corrupt.", { key: MUSE_SCHEMA_VERSION_KEY });
        if (raw.museSchemaVersion === CURRENT_MUSE_SCHEMA_VERSION) return { state: "ready", fromVersion: raw.museSchemaVersion, toVersion: CURRENT_MUSE_SCHEMA_VERSION };
        if (raw.museSchemaVersion < 1 || raw.museSchemaVersion > CURRENT_MUSE_SCHEMA_VERSION) throw new DomainError("MIGRATION_VERSION_UNSUPPORTED", "The schema version is not supported.", { foundVersion: raw.museSchemaVersion, supportedVersions: [1, 2, 3, CURRENT_MUSE_SCHEMA_VERSION] });
        await this.#beforeCommit?.();
        await this.#writeCurrentVersion();
        return { state: "migrated", fromVersion: raw.museSchemaVersion, toVersion: CURRENT_MUSE_SCHEMA_VERSION };
      });
    } catch (error) {
      const wrapped = error instanceof DomainError ? error : new StorageMigrationError(0, CURRENT_MUSE_SCHEMA_VERSION, error);
      return { state: "recovery_required", toVersion: CURRENT_MUSE_SCHEMA_VERSION, diagnostic: diagnostic(wrapped) };
    }
  }

  async explicitReset(): Promise<MigrationResult> {
    await this.#database.open();
    await this.#database.transaction("rw", this.#database.tables, async () => {
      for (const table of this.#database.tables) await table.clear();
      await this.#writeCurrentVersion();
    });
    return { state: "reset", toVersion: CURRENT_MUSE_SCHEMA_VERSION };
  }

  async #writeCurrentVersion(): Promise<void> {
    await this.#versions.put({ id: MUSE_SCHEMA_VERSION_KEY, museSchemaVersion: CURRENT_MUSE_SCHEMA_VERSION, updatedAt: toIsoTimestamp(this.#clock()) });
  }
}
