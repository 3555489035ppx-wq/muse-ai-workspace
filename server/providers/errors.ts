import { SafeApiError } from "../api/envelope.js";

const STATUS_MESSAGES: Readonly<Record<number, { readonly code: string; readonly message: string; readonly retryable: boolean }>> = {
  400: { code: "PROVIDER_INVALID_REQUEST", message: "请求内容不符合服务要求，请检查项目上下文。", retryable: false },
  401: { code: "PROVIDER_AUTH_FAILED", message: "服务端 API Key 无效或已失效。", retryable: false },
  402: { code: "PROVIDER_BALANCE_REQUIRED", message: "服务账户余额不足，请充值后重试。", retryable: false },
  404: { code: "PROVIDER_MODEL_NOT_FOUND", message: "模型或 Base URL 不存在，请检查 Model ID 与 API 地址。", retryable: false },
  422: { code: "PROVIDER_INVALID_PARAMETERS", message: "模型参数无法处理，请检查模型与输出设置。", retryable: false },
  429: { code: "PROVIDER_RATE_LIMITED", message: "请求过于频繁，请稍后重试。", retryable: true },
  500: { code: "PROVIDER_INTERNAL_ERROR", message: "上游服务发生内部错误，请稍后重试。", retryable: true },
  503: { code: "PROVIDER_OVERLOADED", message: "上游服务当前繁忙，请稍后重试。", retryable: true },
};

export function providerHttpError(provider: string, response: Response): SafeApiError {
  const mapped = STATUS_MESSAGES[response.status] ?? {
    code: "PROVIDER_FAILURE",
    message: response.status >= 500 ? "上游服务暂时不可用，请稍后重试。" : "上游服务拒绝了本次请求。",
    retryable: response.status >= 500,
  };
  // Provider bodies may contain user prompts or internal identifiers. Keep only
  // the normalized status in the client-facing error and never log credentials.
  const category = /image|图像|图片/i.test(provider) ? "IMAGE" : "TEXT";
  return new SafeApiError(`${category}_${mapped.code}`, `${provider}：${mapped.message}`, response.status >= 500 ? 502 : response.status, mapped.retryable);
}
