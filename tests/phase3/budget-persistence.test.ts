import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { BudgetService } from "../../server/application/BudgetService.js";

void test("budget usage survives a BFF restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "muse-budget-"));
  const path = join(directory, "budget.json");
  const now = new Date("2026-07-29T03:00:00.000Z");
  try {
    const first = new BudgetService(1, 2, path);
    await first.ready();
    await first.record({ projectId: "project-1", runId: "run-1", amountCny: 0.8, recordedAt: "2026-07-29T01:00:00.000Z" });
    await first.record({ projectId: "project-1", runId: "run-2", amountCny: 0.7, recordedAt: "2026-07-29T02:00:00.000Z" });

    const afterRestart = new BudgetService(1, 2, path);
    await afterRestart.ready();
    assert.throws(
      () => { afterRestart.estimateOrThrow("project-1", 0.7, now); },
      (error: unknown) => (error as { code?: string }).code === "PROJECT_BUDGET_EXCEEDED",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
