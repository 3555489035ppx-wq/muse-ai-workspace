import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type AiRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export interface AiRunRecord {
  readonly id: string;
  readonly actorId: string;
  readonly projectId: string;
  readonly operation: string;
  readonly stage?: string;
  readonly idempotencyKey: string;
  readonly inputHash: string;
  readonly status: AiRunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly providerId?: string;
  readonly model?: string;
  readonly providerRequestId?: string;
  readonly costCny?: number;
  readonly latencyMs?: number;
  readonly safeResult?: unknown;
  readonly safeErrorCode?: string;
}

export type AiRunPublicRecord = Omit<AiRunRecord, "inputHash" | "safeResult">;

function toPublicRecord(record: AiRunRecord): AiRunPublicRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "inputHash" && key !== "safeResult"),
  ) as AiRunPublicRecord;
}

export class AiRunRepository {
  readonly #path: string;
  readonly #memory = new Map<string, AiRunRecord>();
  #loaded = false;
  constructor(path = ".muse-runtime/ai-runs.json") { this.#path = path; }
  async #load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    try {
      const records = JSON.parse(await readFile(this.#path, "utf8")) as AiRunRecord[];
      for (const record of records) this.#memory.set(record.id, record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  async #flush(): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    const temporary = `${this.#path}.tmp`;
    await writeFile(temporary, JSON.stringify([...this.#memory.values()], null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.#path);
  }
  async findByIdempotency(actorId: string, projectId: string, key: string): Promise<AiRunRecord | undefined> {
    await this.#load();
    return [...this.#memory.values()].find((record) => record.actorId === actorId && record.projectId === projectId && record.idempotencyKey === key);
  }
  async create(record: AiRunRecord): Promise<void> { await this.#load(); this.#memory.set(record.id, record); await this.#flush(); }
  async update(id: string, patch: Partial<AiRunRecord>): Promise<AiRunRecord> {
    await this.#load(); const current = this.#memory.get(id); if (!current) throw new Error("AI run is missing.");
    const next = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() }; this.#memory.set(id, next); await this.#flush(); return next;
  }
  async get(id: string): Promise<AiRunRecord | undefined> { await this.#load(); return this.#memory.get(id); }
  async recent(limit = 50): Promise<readonly AiRunPublicRecord[]> {
    await this.#load();
    return [...this.#memory.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(200, limit)))
      .map(toPublicRecord);
  }
}
