import type { Transaction } from "dexie";

import { StorageMigrationError } from "../../domain/errors/storageErrors.js";
import { DB_VERSION, LEGACY_DB_VERSION } from "../constants.js";

export type V4MigrationRunner = (transaction: Transaction) => Promise<void>;

export const migrateV3ToV4: V4MigrationRunner = async (transaction) => {
  try {
    const projects = transaction.table<Record<string, unknown>, string>("projects");
    await projects.toCollection().modify((project) => {
      if (project.schemaVersion === undefined) {
        project.schemaVersion = DB_VERSION;
      }
    });
  } catch (error) {
    if (error instanceof StorageMigrationError) {
      throw error;
    }
    throw new StorageMigrationError(LEGACY_DB_VERSION, DB_VERSION, error);
  }
};

export async function runV4Migration(
  transaction: Transaction,
  runner: V4MigrationRunner = migrateV3ToV4,
): Promise<void> {
  try {
    await runner(transaction);
  } catch (error) {
    if (error instanceof StorageMigrationError) {
      throw error;
    }
    throw new StorageMigrationError(LEGACY_DB_VERSION, DB_VERSION, error);
  }
}
