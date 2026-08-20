import { useState } from "react";
import type { MigrationResult, MigrationService } from "../../domain/services/MigrationService.js";

export interface Phase0RecoveryProps {
  readonly service: MigrationService;
  readonly result: MigrationResult;
  readonly onResolved: (result: MigrationResult) => void | Promise<void>;
}

export function Phase0Recovery({ service, result, onResolved }: Phase0RecoveryProps) {
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [latest, setLatest] = useState(result);

  const retry = async () => {
    setBusy(true);
    const next = await service.inspectAndMigrate();
    setLatest(next);
    setBusy(false);
    if (next.state !== "recovery_required") await onResolved(next);
  };

  const reset = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setBusy(true);
    const next = await service.explicitReset();
    setLatest(next);
    setBusy(false);
    await onResolved(next);
  };

  return (
    <main aria-labelledby="phase0-recovery-title">
      <h1 id="phase0-recovery-title">Muse 本地数据需要恢复</h1>
      <p>系统没有自动删除任何数据。你可以重试安全迁移，或明确确认后清除当前浏览器中的 Muse 本地数据。</p>
      <dl>
        <dt>错误代码</dt><dd>{latest.diagnostic?.code ?? "未知"}</dd>
        <dt>错误说明</dt><dd>{latest.diagnostic?.message ?? "暂无诊断"}</dd>
      </dl>
      <button type="button" disabled={busy} onClick={() => { void retry(); }}>重试安全迁移</button>
      <button type="button" disabled={busy} onClick={() => { void reset(); }}>{confirmReset ? "再次点击，确认清除本地数据" : "清除本地数据并重置"}</button>
    </main>
  );
}
