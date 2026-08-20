import type { Table } from "dexie";

import type { MuseDatabase } from "../db/database.js";

export async function runWriteTransaction<T>(
  database: MuseDatabase,
  tables: readonly Table[],
  work: () => Promise<T>,
): Promise<T> {
  return database.transaction("rw", [...tables], work);
}
