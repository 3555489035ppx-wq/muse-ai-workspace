import { randomUUID } from "node:crypto";
import type { ApiEnvelope } from "../contracts/ai.js";

export class SafeApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "SafeApiError";
  }
}

export function requestId(): string { return randomUUID(); }
export function success<T>(id: string, data: T): ApiEnvelope<T> { return { ok: true, requestId: id, data }; }
export function failure(id: string, error: unknown): { readonly status: number; readonly body: ApiEnvelope<never> } {
  if (error instanceof SafeApiError) return { status: error.status, body: { ok: false, requestId: id, error: { code: error.code, message: error.message, retryable: error.retryable } } };
  return { status: 500, body: { ok: false, requestId: id, error: { code: "INTERNAL_ERROR", message: "AI 服务暂时不可用，请稍后重试。", retryable: true } } };
}
