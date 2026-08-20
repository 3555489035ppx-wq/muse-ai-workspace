const CODE_MESSAGES = {
  EMPTY_RESPONSE: "真实 AI 没有返回内容，请重试。",
  INVALID_RESPONSE_FORMAT: "真实 AI 返回格式无法识别，请重试。",
  BFF_UNREACHABLE: "Muse 服务暂时无法连接，请确认本地服务正在运行后重试。",
  PROVIDER_AUTH_FAILED: "真实 AI 连接失败：API Key 无效或已失效。",
  TEXT_PROVIDER_AUTH_FAILED: "真实 AI 连接失败：API Key 无效或已失效。",
  PROVIDER_BALANCE_REQUIRED: "真实 AI 连接失败：服务账户余额不足。",
  TEXT_PROVIDER_BALANCE_REQUIRED: "真实 AI 连接失败：服务账户余额不足。",
  PROVIDER_MODEL_NOT_FOUND: "真实 AI 连接失败：模型或 Base URL 配置错误。",
  TEXT_PROVIDER_MODEL_NOT_FOUND: "真实 AI 连接失败：模型或 Base URL 配置错误。",
  PROVIDER_INVALID_PARAMETERS: "真实 AI 连接失败：模型参数或输出设置错误。",
  TEXT_PROVIDER_INVALID_PARAMETERS: "真实 AI 连接失败：模型参数或输出设置错误。",
  PROVIDER_RATE_LIMITED: "真实 AI 请求过于频繁，请稍后重试。",
  TEXT_PROVIDER_RATE_LIMITED: "真实 AI 请求过于频繁，请稍后重试。",
  PROVIDER_INTERNAL_ERROR: "真实 AI 服务异常，请稍后重试。",
  TEXT_PROVIDER_INTERNAL_ERROR: "真实 AI 服务异常，请稍后重试。",
  PROVIDER_OVERLOADED: "真实 AI 服务当前繁忙，请稍后重试。",
  TEXT_PROVIDER_OVERLOADED: "真实 AI 服务当前繁忙，请稍后重试。",
};

function responseCode(response) {
  return String(response?.errorCode ?? response?.error?.code ?? "").trim();
}

export function aiFailureCode(response) {
  const code = responseCode(response);
  if (code) return code;
  if (String(response?.validation?.error ?? "").trim()) return "SCHEMA_VALIDATION_FAILED";
  return response?.source === "unavailable" ? "BFF_UNREACHABLE" : "AI_REQUEST_FAILED";
}

export function localizeAiFailure(response, fallback = "真实 AI 请求失败，已有内容未被覆盖。") {
  const code = aiFailureCode(response);
  if (code === "AI_SCHEMA_INVALID" || code === "SCHEMA_VALIDATION_FAILED" || code.startsWith("AI_SCHEMA_INVALID:")) {
    const detail = String(response?.validation?.error
      ?? (code.startsWith("AI_SCHEMA_INVALID:") ? code.slice("AI_SCHEMA_INVALID:".length) : "")).trim();
    return detail ? `真实 AI 返回内容未通过字段校验：${detail}` : "真实 AI 返回内容缺少必要字段，请重试。";
  }
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  const message = String(response?.error?.message ?? "").trim();
  return message || fallback;
}

export function localizeThrownAiFailure(error, fallback = "真实 AI 请求失败，已有内容未被覆盖。") {
  return localizeAiFailure({ error, errorCode: error?.code }, fallback);
}
