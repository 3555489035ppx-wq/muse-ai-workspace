import { DomainError } from "./domainError.js";

export class StorageMigrationError extends DomainError {
  constructor(fromVersion: number, toVersion: number, cause?: unknown) {
    super(
      "STORAGE_MIGRATION_FAILED",
      "The local database migration failed.",
      { fromVersion, toVersion },
      cause,
    );
  }
}

export class AssetStorageError extends DomainError {
  constructor(operation: string, assetId: string, cause?: unknown) {
    super(
      "ASSET_STORAGE_FAILED",
      "The asset binary operation failed.",
      { assetId, operation },
      cause,
    );
  }
}
