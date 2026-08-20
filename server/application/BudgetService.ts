import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SafeApiError } from "../api/envelope.js";

export interface UsageEntry { readonly projectId: string; readonly runId: string; readonly amountCny: number; readonly recordedAt: string; }

export class BudgetService {
  readonly #entries: UsageEntry[] = [];
  readonly #path: string | undefined;
  #loaded = false;
  #loadPromise: Promise<void> | undefined;
  #flushPromise: Promise<void> = Promise.resolve();

  constructor(readonly requestLimitCny: number, readonly projectDailyLimitCny: number, path?: string) {
    this.#path = path;
  }

  async ready(): Promise<void> {
    if (this.#loaded) return;
    this.#loadPromise ??= (async () => {
      if (this.#path) {
        try {
          const records = JSON.parse(await readFile(this.#path, "utf8")) as unknown;
          if (!Array.isArray(records) || records.some((entry) => !entry || typeof entry !== "object")) {
            throw new Error("Budget records are invalid.");
          }
          this.#entries.push(...(records as UsageEntry[]));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      this.#loaded = true;
    })();
    await this.#loadPromise;
  }

  estimateOrThrow(projectId: string, estimatedCny: number, now = new Date()): void {
    if (!Number.isFinite(estimatedCny) || estimatedCny < 0 || estimatedCny > this.requestLimitCny) throw new SafeApiError("REQUEST_BUDGET_EXCEEDED", "本次 AI 操作超过单次预算上限。", 402);
    const day = now.toISOString().slice(0, 10);
    const used = this.#entries.filter((entry) => entry.projectId === projectId && entry.recordedAt.startsWith(day)).reduce((sum, entry) => sum + entry.amountCny, 0);
    if (used + estimatedCny > this.projectDailyLimitCny) throw new SafeApiError("PROJECT_BUDGET_EXCEEDED", "该项目今日真实 AI 预算已用尽。", 402);
  }
  record(entry: UsageEntry): Promise<void> {
    if (!Number.isFinite(entry.amountCny) || entry.amountCny < 0) throw new SafeApiError("INVALID_USAGE", "服务商用量数据无效。", 502);
    this.#entries.push(entry);
    const path = this.#path;
    if (path === undefined) return Promise.resolve();
    this.#flushPromise = this.#flushPromise.then(async () => {
      await this.ready();
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.tmp`;
      await writeFile(temporary, JSON.stringify(this.#entries, null, 2), { encoding: "utf8", mode: 0o600 });
      await rename(temporary, path);
    });
    return this.#flushPromise;
  }
  total(projectId: string): number { return this.#entries.filter((entry) => entry.projectId === projectId).reduce((sum, entry) => sum + entry.amountCny, 0); }
}
