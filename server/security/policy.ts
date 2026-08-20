import { isIP } from "node:net";
import { SafeApiError } from "../api/envelope.js";
import type { MuseServerConfig } from "../config.js";

const SECRET_PATTERN = /(sk-[a-z0-9_-]{8,}|bearer\s+[a-z0-9._-]{8,}|api[_-]?key\s*[:=]\s*[^\s]+)/gi;

export function redact(value: string): string { return value.replace(SECRET_PATTERN, "[REDACTED]"); }

export function validateInstruction(value: string): string {
  const clean = value.trim();
  if (!clean || clean.length > 12_000 || Array.from(clean).some((character) => { const code = character.codePointAt(0) ?? 0; return code < 32 && code !== 9 && code !== 10 && code !== 13; })) throw new SafeApiError("INVALID_INPUT", "输入内容不符合安全要求。", 400);
  return clean;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a = 0, b = 0] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function validateExternalHttpsUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new SafeApiError("UNSAFE_URL", "引用资源地址无效。", 400); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".local") || isPrivateIpv4(host) || isIP(host) === 6) {
    throw new SafeApiError("UNSAFE_URL", "仅允许公开 HTTPS 资源。", 400);
  }
  url.username = ""; url.password = ""; url.hash = "";
  return url;
}

export function authorizeProject(headers: Headers, projectId: string, config: MuseServerConfig): void {
  if (headers.get("x-muse-actor-id") !== config.actorId) throw new SafeApiError("UNAUTHORIZED", "当前实验身份无权执行此操作。", 401);
  const headerProject = headers.get("x-muse-project-id");
  if (headerProject !== projectId) throw new SafeApiError("PROJECT_SCOPE_MISMATCH", "项目上下文不一致。", 403);
  if (config.allowedProjectIds.size > 0 && !config.allowedProjectIds.has(projectId)) throw new SafeApiError("PROJECT_NOT_ALLOWED", "该项目未加入真实 AI 实验范围。", 403);
}

export function assertLiveDispatchAllowed(config: MuseServerConfig): void {
  if (!config.liveEnabled || config.killSwitchActive) throw new SafeApiError("LIVE_AI_DISABLED", "真实 AI 当前未启用；已有项目数据会保留，但不会伪造新的 AI 结果。", 503);
}
