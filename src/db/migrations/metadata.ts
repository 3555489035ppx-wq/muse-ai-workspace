import { DB_VERSION } from "../constants.js";

export const MUSE_SCHEMA_VERSION_KEY = "museSchemaVersion";

export interface MuseSchemaVersionRecord {
  readonly id: typeof MUSE_SCHEMA_VERSION_KEY;
  readonly museSchemaVersion: number;
  readonly updatedAt: string;
}

export function isMuseSchemaVersionRecord(value: unknown): value is MuseSchemaVersionRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return record.id === MUSE_SCHEMA_VERSION_KEY && typeof record.museSchemaVersion === "number" && Number.isInteger(record.museSchemaVersion) && record.museSchemaVersion >= 1 && typeof record.updatedAt === "string";
}

export const CURRENT_MUSE_SCHEMA_VERSION = DB_VERSION;
