import React, { useEffect, useState } from "react";
import { Cloud, ShieldCheck } from "lucide-react";
import type { AiCapabilityView } from "../../../server/contracts/ai.js";
import { MuseAiClient } from "../../lib/api/museAiClient.js";
import { StatusPill } from "../ui.jsx";

export function AiProviderStatus({ client, onChange }: { readonly client: MuseAiClient; readonly onChange?: (value?: AiCapabilityView) => void }) {
  const [capabilities, setCapabilities] = useState<AiCapabilityView>();
  useEffect(() => {
    const controller = new AbortController();
    void client.capabilities(controller.signal).then((value) => {
      setCapabilities(value);
      onChange?.(value);
    }).catch((error) => {
      if (error?.name === "AbortError") return;
      onChange?.(undefined);
    });
    return () => controller.abort();
  }, [client, onChange]);
  const textReady = Boolean(capabilities?.providers?.text.ready);
  const imageReady = Boolean(capabilities?.providers?.image.ready);
  const ready = textReady && imageReady;
  const partial = textReady !== imageReady;
  return <div className="ai-provider-status" data-ready={ready} role="status" aria-live="polite">
    <span className="ai-provider-status__icon">{ready || partial ? <Cloud aria-hidden="true" size={17} /> : <ShieldCheck aria-hidden="true" size={17} />}</span>
    <div><strong>{ready ? "真实 AI 已就绪" : partial ? "部分真实 AI 已就绪" : "真实 AI 未启用"}</strong><span>{ready ? `${capabilities?.providers.text.model} · ${capabilities?.providers.image.model}` : partial ? `文本 ${textReady ? "REAL" : "未就绪"} · 图片 ${imageReady ? "REAL" : "未就绪"}` : "服务端密钥未启用；不会生成占位图片或伪造成功结果"}</span></div>
    <StatusPill status={ready ? "success" : "warn"}>{ready ? "REAL" : partial ? "PARTIAL" : "OFFLINE"}</StatusPill>
  </div>;
}
