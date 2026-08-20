const MAX_JSON_BYTES = 2 * 1024 * 1024;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const COOKIE_NAMES = { text: "muse_provider_text", image: "muse_provider_image" };
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const DEFAULTS = {
  text: {
    provider: "deepseek",
    displayName: "DeepSeek Text AI",
    baseUrl: "https://api.deepseek.com",
    modelId: "deepseek-v4-pro",
    enabled: false,
    connectionStatus: "unconfigured",
    capabilities: ["textGeneration", "structuredOutput", "reasoning"],
  },
  image: {
    provider: "demo-visual",
    displayName: "Demo Visual",
    baseUrl: "",
    modelId: "demo-visual",
    enabled: false,
    connectionStatus: "unconfigured",
    capabilities: ["demoImageSelection", "demoVariationLookup"],
    quality: "standard",
    aspectRatio: "square",
  },
};

class WorkerApiError extends Error {
  constructor(code, message, status = 400, retryable = false) {
    super(message);
    this.name = "WorkerApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `muse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function textEncoder() {
  return new TextEncoder();
}

async function encryptionKey(env) {
  const secret = String(env.MUSE_SITE_SECRET ?? "").trim();
  if (!secret) throw new WorkerApiError("SITE_SECRET_NOT_CONFIGURED", "线上服务尚未配置会话加密密钥，请联系站点管理员。", 503);
  const digest = await crypto.subtle.digest("SHA-256", textEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptJson(env, value) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return `${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}`;
}

async function decryptJson(env, value) {
  if (!value) return undefined;
  try {
    const [ivValue, ciphertextValue] = value.split(".");
    if (!ivValue || !ciphertextValue) return undefined;
    const key = await encryptionKey(env);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(ivValue) }, key, base64UrlDecode(ciphertextValue));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return undefined;
  }
}

function readCookies(request) {
  const cookies = new Map();
  for (const item of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    cookies.set(item.slice(0, separator).trim(), item.slice(separator + 1).trim());
  }
  return cookies;
}

function cookieHeader(request, name, value, maxAge = COOKIE_MAX_AGE) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/api; Max-Age=${String(maxAge)}; HttpOnly; SameSite=Lax${secure}`;
}

function maskedKey(value) {
  if (!value) return undefined;
  return `${value.startsWith("sk-") ? "sk-" : ""}••••••••${value.slice(-4)}`;
}

function defaultConfig(category) {
  return { ...DEFAULTS[category] };
}

function supportedProvider(category, provider) {
  if (category === "text") return ["deepseek", "openai", "custom", "custom-openai-compatible"].includes(provider);
  return ["openai", "custom", "custom-openai-compatible", "demo-visual"].includes(provider);
}

function canonicalProvider(provider) {
  return provider === "custom" ? "custom-openai-compatible" : provider;
}

function defaultFor(category, provider) {
  const canonical = canonicalProvider(provider);
  if (category === "text") {
    if (canonical === "deepseek") return { ...DEFAULTS.text };
    if (canonical === "openai") return { ...DEFAULTS.text, provider: "openai", displayName: "OpenAI Text AI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-5.2" };
    if (canonical === "custom-openai-compatible") return { ...DEFAULTS.text, provider: "custom-openai-compatible", displayName: "自定义 OpenAI Compatible", baseUrl: "", modelId: "" };
  }
  if (category === "image") {
    if (canonical === "openai") return { ...DEFAULTS.image, provider: "openai", displayName: "OpenAI Image AI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-image-2", capabilities: ["imageGeneration", "imageEditing"] };
    if (canonical === "custom-openai-compatible") return { ...DEFAULTS.image, provider: "custom-openai-compatible", displayName: "自定义 OpenAI Compatible", baseUrl: "", modelId: "", capabilities: ["imageGeneration", "imageEditing"] };
    if (canonical === "demo-visual") return { ...DEFAULTS.image };
  }
  throw new WorkerApiError("INVALID_PROVIDER", "当前 Provider 不支持此类 AI 服务。", 400);
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim().replace(/\/$/, "");
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new WorkerApiError("INVALID_PROVIDER_BASE_URL", "Base URL 格式无效。", 400);
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new WorkerApiError("UNSAFE_PROVIDER_BASE_URL", "线上 Provider Base URL 只允许 HTTPS 公网地址。", 400);
  }
  if (parsed.username || parsed.password) throw new WorkerApiError("UNSAFE_PROVIDER_BASE_URL", "Base URL 不能包含账号或密码。", 400);
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function mergeConfig(category, current, input = {}) {
  const provider = canonicalProvider(String(input.provider ?? current.provider));
  if (!supportedProvider(category, provider)) throw new WorkerApiError("PROVIDER_NOT_IMPLEMENTED", "当前 Provider 尚未提供线上适配器。", 422);
  const defaults = defaultFor(category, provider);
  const next = {
    ...defaults,
    ...current,
    ...input,
    provider,
    displayName: String(input.displayName ?? current.displayName ?? defaults.displayName).trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl ?? current.baseUrl ?? defaults.baseUrl),
    modelId: String(input.customModelId?.trim() || input.modelId?.trim() || input.model?.trim() || current.customModelId?.trim() || current.modelId || defaults.modelId).trim(),
    customModelId: String(input.customModelId ?? current.customModelId ?? "").trim(),
    enabled: input.enabled === undefined ? Boolean(current.enabled) : Boolean(input.enabled),
    apiKey: String(input.apiKey ?? current.apiKey ?? "").trim(),
    connectionStatus: "saved",
    lastError: undefined,
  };
  if (category === "image" && provider === "demo-visual") {
    next.enabled = false;
    next.connectionStatus = "unconfigured";
    next.apiKey = "";
    return next;
  }
  if (!next.apiKey) throw new WorkerApiError("PROVIDER_KEY_REQUIRED", "请先输入 API Key，再保存 Provider。", 400);
  if (!next.baseUrl) throw new WorkerApiError("PROVIDER_BASE_URL_REQUIRED", "请填写 Provider Base URL。", 400);
  if (!next.modelId) throw new WorkerApiError("PROVIDER_MODEL_REQUIRED", "请填写 Provider Model ID。", 400);
  next.enabled = input.enabled === undefined ? true : Boolean(input.enabled);
  return next;
}

function providerView(category, config) {
  const { apiKey, ...safe } = config;
  return {
    id: `${category}-provider`,
    category,
    ...safe,
    model: config.modelId,
    secretConfigured: Boolean(apiKey),
    keyHint: maskedKey(apiKey),
  };
}

async function readConfig(env, request, category) {
  const token = readCookies(request).get(COOKIE_NAMES[category]);
  const stored = await decryptJson(env, token);
  if (!stored || typeof stored !== "object") return defaultConfig(category);
  try {
    return mergeConfig(category, stored, { apiKey: stored.apiKey });
  } catch {
    return { ...defaultConfig(category), ...stored };
  }
}

async function persistConfig(env, request, category, config) {
  const token = await encryptJson(env, config);
  return cookieHeader(request, COOKIE_NAMES[category], token);
}

function clearConfigCookie(request, category) {
  return cookieHeader(request, COOKIE_NAMES[category], "", 0);
}

function liveEnabled(env) {
  return String(env.MUSE_SITE_AI_ENABLED ?? "true").toLowerCase() !== "false" && String(env.MUSE_SITE_KILL_SWITCH ?? "false").toLowerCase() !== "true";
}

function providerCapabilities(env, configs) {
  const serviceEnabled = liveEnabled(env);
  const view = (category, config) => {
    const demo = category === "image" && config.provider === "demo-visual";
    const configured = !demo && Boolean(config.apiKey);
    const ready = configured && Boolean(config.enabled) && serviceEnabled && config.connectionStatus !== "error";
    return {
      id: `${category}-provider`,
      label: config.displayName,
      model: config.modelId,
      configured,
      enabled: Boolean(config.enabled) && serviceEnabled,
      ready,
      mode: demo ? "demo" : "real",
      capabilities: config.capabilities,
      configurationHint: configured ? undefined : category === "text" ? "在设置中输入 Text AI API Key" : "配置 Image AI API Key 后才能真实生成图片",
    };
  };
  const text = view("text", configs.text);
  const image = view("image", configs.image);
  const readyCount = Number(text.ready) + Number(image.ready);
  return {
    liveEnabled: serviceEnabled,
    providerConfigured: text.configured || image.configured,
    killSwitchActive: !serviceEnabled,
    providerLabel: readyCount === 2 ? `${configs.text.displayName} + ${configs.image.displayName}` : readyCount === 1 ? "部分真实 AI" : "真实 AI 未配置",
    models: { llm: configs.text.modelId, image: configs.image.modelId },
    capabilities: [...(text.ready ? ["structured", "review"] : []), ...(image.ready ? ["image_generate", "image_edit"] : [])],
    limits: { requestCny: Number(env.MUSE_SITE_REQUEST_BUDGET_CNY ?? 1), projectDailyCny: Number(env.MUSE_SITE_PROJECT_DAILY_BUDGET_CNY ?? 10) },
    providers: { text, image },
    mode: readyCount === 2 ? "real" : readyCount === 1 ? "partial" : "unavailable",
  };
}

async function parseJson(request) {
  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) throw new WorkerApiError("PAYLOAD_TOO_LARGE", "请求内容超过限制。", 413);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new WorkerApiError("INVALID_JSON", "请求格式无效。", 400);
  }
}

function jsonResponse(body, status = 200, cookies = []) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function success(data, id = requestId()) {
  return { ok: true, requestId: id, data };
}

function failure(error, id = requestId()) {
  const safe = error instanceof WorkerApiError ? error : new WorkerApiError("INTERNAL_ERROR", "AI 服务暂时不可用，请稍后重试。", 500, true);
  return { body: { ok: false, requestId: id, error: { code: safe.code, message: safe.message, retryable: safe.retryable } }, status: safe.status };
}

async function upstreamFetch(env, input, init) {
  const fetcher = typeof env.MUSE_UPSTREAM_FETCH === "function" ? env.MUSE_UPSTREAM_FETCH : fetch;
  try {
    return await fetcher(input, init);
  } catch {
    throw new WorkerApiError("PROVIDER_UNREACHABLE", "AI Provider 无法访问，请检查网络或 Base URL。", 502, true);
  }
}

async function providerFailure(label, response) {
  const status = response.status;
  if (status === 401 || status === 403) throw new WorkerApiError("PROVIDER_AUTH_FAILED", `${label} API Key 无效或没有访问权限。`, 502, false);
  if (status === 429) throw new WorkerApiError("PROVIDER_RATE_LIMITED", `${label} 当前触发限流或余额限制，请稍后重试。`, 429, true);
  if (status >= 500) throw new WorkerApiError("PROVIDER_FAILURE", `${label} 暂时不可用，请稍后重试。`, 502, true);
  throw new WorkerApiError("PROVIDER_REQUEST_INVALID", `${label} 拒绝了请求，请检查模型 ID、Base URL 和请求参数。`, 422, false);
}

async function responseJson(response, label) {
  const raw = await response.text().catch(() => "");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new WorkerApiError("INVALID_PROVIDER_OUTPUT", `${label} 返回了无法识别的结果。`, 502, true);
  }
}

function parseJsonContent(content, label) {
  const trimmed = String(content ?? "").trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const value = JSON.parse(fenced);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not-object");
    return value;
  } catch {
    throw new WorkerApiError("TEXT_INVALID_PROVIDER_OUTPUT", `${label} 返回的 JSON 无法解析。`, 502, true);
  }
}

async function callText(env, config, input) {
  if (!config.apiKey || !config.enabled) throw new WorkerApiError("TEXT_PROVIDER_NOT_CONFIGURED", "Text AI 尚未配置或未启用。", 503);
  if (input.enableSearch) throw new WorkerApiError("TEXT_SEARCH_UNAVAILABLE", "当前线上 Text Provider 未启用联网检索，请先提供可追溯的研究来源。", 422);
  const label = config.displayName;
  const response = await upstreamFetch(env, `${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: config.modelId,
      messages: [
        { role: "system", content: `你是 Muse 的${input.purpose}结构化设计推理引擎。只输出合法 JSON，不要输出 Markdown。不得捏造研究来源。${input.schemaHint ? `输出必须符合：${JSON.stringify(input.schemaHint)}` : ""}` },
        { role: "user", content: input.instruction },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!response.ok) await providerFailure(label, response);
  const payload = await responseJson(response, label);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new WorkerApiError("TEXT_INVALID_PROVIDER_OUTPUT", `${label} 未返回可用的结构化结果。`, 502, true);
  const value = parseJsonContent(content, label);
  const inputTokens = Number(payload.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(payload.usage?.completion_tokens ?? 0);
  return {
    value,
    providerRequestId: payload.id,
    httpStatus: response.status,
    rawContentLength: String(content).length,
    usage: { inputTokens, outputTokens, estimatedCostCny: (inputTokens * 2 + outputTokens * 8) / 1_000_000 },
  };
}

function assertImageConfig(config) {
  if (config.provider === "demo-visual") throw new WorkerApiError("DEMO_VISUAL_NOT_LIVE", "Demo Visual 只使用演示资产，不会调用真实生图服务。", 422);
  if (!config.apiKey || !config.enabled) throw new WorkerApiError("IMAGE_PROVIDER_NOT_CONFIGURED", "Image AI 尚未配置或未启用。", 503);
}

function sizeForProvider(size) {
  return size === "2K" ? "1536x1024" : "1024x1024";
}

function bytesToDataUrl(bytes, mimeType) {
  const base64 = base64UrlEncode(bytes).replace(/-/g, "+").replace(/_/g, "/");
  return `data:${mimeType};base64,${base64}`;
}

function base64Bytes(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function decodeImagePayload(env, config, response) {
  if (!response.ok) await providerFailure(config.displayName, response);
  const payload = await responseJson(response, config.displayName);
  const first = payload.data?.[0];
  if (!first?.b64_json && !first?.url) throw new WorkerApiError("IMAGE_INVALID_PROVIDER_OUTPUT", `${config.displayName} 未返回图像数据。`, 502, true);
  let bytes;
  let mimeType = "image/png";
  if (first.b64_json) {
    bytes = base64Bytes(first.b64_json);
  } else {
    let remote;
    try { remote = new URL(first.url); } catch { throw new WorkerApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "图像服务返回了无效地址。", 502, true); }
    if (remote.protocol !== "https:") throw new WorkerApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "图像服务返回了不安全地址。", 502, true);
    const imageResponse = await upstreamFetch(env, remote.toString(), { redirect: "error" });
    if (!imageResponse.ok) throw new WorkerApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "图像服务返回地址无法访问。", 502, true);
    mimeType = imageResponse.headers.get("content-type")?.split(";")[0] ?? "";
    if (!IMAGE_MIME_TYPES.has(mimeType)) throw new WorkerApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "图像服务返回的格式不受支持。", 502, true);
    bytes = new Uint8Array(await imageResponse.arrayBuffer());
  }
  if (!bytes?.byteLength || bytes.byteLength > 25 * 1024 * 1024) throw new WorkerApiError("IMAGE_INVALID_PROVIDER_OUTPUT", "图像服务返回的文件大小不符合要求。", 502, true);
  return { bytes, mimeType, providerRequestId: payload.id };
}

async function callImageGenerate(env, config, prompt, size) {
  assertImageConfig(config);
  const response = await upstreamFetch(env, `${config.baseUrl}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: config.modelId, prompt, n: 1, size: sizeForProvider(size), quality: size === "2K" ? "high" : "medium", output_format: "png" }),
  });
  return decodeImagePayload(env, config, response);
}

function dataUrlBytes(value) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(String(value));
  if (!match) return undefined;
  return { mimeType: match[1].toLowerCase(), bytes: base64Bytes(match[2]) };
}

async function readSourceAsset(env, value) {
  const data = dataUrlBytes(value);
  if (data) return data;
  const path = String(value ?? "");
  if (path.startsWith("/api/ai/assets/") && env.BUCKET?.get) {
    const key = decodeURIComponent(path.slice("/api/ai/assets/".length));
    const object = await env.BUCKET.get(key);
    if (!object) throw new WorkerApiError("IMAGE_SOURCE_NOT_FOUND", "源图像不存在或已过期。", 404);
    return { mimeType: object.httpMetadata?.contentType ?? "image/png", bytes: new Uint8Array(await object.arrayBuffer()) };
  }
  throw new WorkerApiError("IMAGE_SOURCE_NOT_MANAGED", "图像编辑只接受 Muse 已保存的图像。", 422);
}

async function callImageEdit(env, config, prompt, sourceAssetUrls, size) {
  assertImageConfig(config);
  if (!Array.isArray(sourceAssetUrls) || !sourceAssetUrls.length) throw new WorkerApiError("IMAGE_SOURCE_REQUIRED", "图像编辑至少需要一张源图。", 422);
  const form = new FormData();
  form.set("model", config.modelId);
  form.set("prompt", prompt);
  form.set("size", sizeForProvider(size));
  form.set("quality", size === "2K" ? "high" : "medium");
  form.set("output_format", "png");
  for (const [index, sourceUrl] of sourceAssetUrls.slice(0, 4).entries()) {
    const source = await readSourceAsset(env, sourceUrl);
    form.append("image[]", new Blob([source.bytes], { type: source.mimeType }), `source-${String(index + 1)}.png`);
  }
  const response = await upstreamFetch(env, `${config.baseUrl}/images/edits`, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}` }, body: form });
  return decodeImagePayload(env, config, response);
}

async function storeImage(env, id, bytes, mimeType) {
  if (env.BUCKET?.put) {
    await env.BUCKET.put(id, bytes, { httpMetadata: { contentType: mimeType, cacheControl: "private, max-age=3600" } });
    return `/api/ai/assets/${id}`;
  }
  return bytesToDataUrl(bytes, mimeType);
}

async function providerConfigs(env, request) {
  const text = await readConfig(env, request, "text");
  const image = await readConfig(env, request, "image");
  return { configs: { text, image }, views: { text: providerView("text", text), image: providerView("image", image) } };
}

function categoryFromProviderId(value) {
  if (value === "text" || value === "text-provider") return "text";
  if (value === "image" || value === "image-provider") return "image";
  return undefined;
}

async function handleProviderRoutes(request, env, url, id) {
  const parts = url.pathname.split("/").filter(Boolean);
  const providerId = parts[3];
  if (request.method === "GET" && !providerId) {
    const state = await providerConfigs(env, request);
    return jsonResponse(success({ providers: [state.views.text, state.views.image], storage: "encrypted-session-cookie" }, id));
  }
  const category = categoryFromProviderId(providerId);
  if (!category) throw new WorkerApiError("INVALID_PROVIDER_ID", "Provider 配置标识无效。", 400);
  const current = await readConfig(env, request, category);
  if (parts[4] === "test") {
    if (request.method !== "POST") throw new WorkerApiError("METHOD_NOT_ALLOWED", "请求方法不受支持。", 405);
    const payload = await parseJson(request);
    const candidate = mergeConfig(category, current, payload.config ?? {});
    if (category === "text") {
      const startedAt = Date.now();
      const result = await callText(env, candidate, { instruction: "返回 {\"status\":\"ok\"}，不要添加其他字段。", purpose: "provider_connection_test", enableSearch: false, schemaHint: { status: "ok" } });
      if (result.value.status !== "ok") throw new WorkerApiError("TEXT_INVALID_PROVIDER_OUTPUT", "Provider 返回了无法验证的连接结果。", 502, true);
      const saved = { ...candidate, connectionStatus: "connected", lastError: undefined };
      const cookies = payload.persist === false ? [] : [await persistConfig(env, request, category, saved)];
      return jsonResponse(success({ category, provider: candidate.displayName, model: candidate.modelId, latencyMs: Date.now() - startedAt, status: "connected" }, id), 200, cookies);
    }
    const startedAt = Date.now();
    const result = await callImageGenerate(env, candidate, "Minimal industrial design calibration object on a neutral studio background, one object, no text, no logo.", "1K");
    const cookies = payload.persist === false ? [] : [await persistConfig(env, request, category, { ...candidate, connectionStatus: "connected", lastError: undefined })];
    return jsonResponse(success({ category, provider: candidate.displayName, model: candidate.modelId, latencyMs: Date.now() - startedAt, status: result.bytes.byteLength ? "connected" : "invalid-output" }, id), 200, cookies);
  }
  if (request.method === "PATCH") {
    const input = await parseJson(request);
    const saved = mergeConfig(category, current, input);
    return jsonResponse(success({ provider: providerView(category, saved) }, id), 200, [await persistConfig(env, request, category, saved)]);
  }
  if (request.method === "DELETE") {
    return jsonResponse(success({ provider: providerView(category, defaultConfig(category)) }, id), 200, [clearConfigCookie(request, category)]);
  }
  throw new WorkerApiError("METHOD_NOT_ALLOWED", "请求方法不受支持。", 405);
}

async function handleApi(request, env) {
  const id = requestId();
  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return jsonResponse(success({ status: "ready", services: { bff: "ready", secretStore: "ready", providerRegistry: "ready" }, liveProviderRequired: false }, id));
    }
    if (url.pathname === "/api/ai/providers" || url.pathname.startsWith("/api/ai/providers/")) return await handleProviderRoutes(request, env, url, id);
    if (request.method === "GET" && url.pathname === "/api/ai/capabilities") {
      const state = await providerConfigs(env, request);
      return jsonResponse(success(providerCapabilities(env, state.configs), id));
    }
    if (request.method === "POST" && url.pathname === "/api/ai/structured") {
      if (!liveEnabled(env)) throw new WorkerApiError("AI_DISABLED", "线上真实 AI 当前已关闭。", 503);
      const input = await parseJson(request);
      const config = await readConfig(env, request, "text");
      const result = await callText(env, config, input);
      const runId = requestId();
      return jsonResponse(success({ runId, result: result.value, trace: { providerId: `${config.provider}-text`, model: config.modelId, modelVersion: config.modelId, httpStatus: result.httpStatus, rawContentLength: result.rawContentLength, parsed: true, usage: result.usage } }, id));
    }
    if (request.method === "POST" && (url.pathname === "/api/ai/images/generate" || url.pathname === "/api/ai/images/edit")) {
      if (!liveEnabled(env)) throw new WorkerApiError("AI_DISABLED", "线上真实 AI 当前已关闭。", 503);
      const input = await parseJson(request);
      const config = await readConfig(env, request, "image");
      const prompt = [input.prompt, input.negativePrompt ? `避免：${input.negativePrompt}` : ""].filter(Boolean).join("\n");
      const result = url.pathname.endsWith("/edit")
        ? await callImageEdit(env, config, prompt, input.sourceAssetUrls, input.size)
        : await callImageGenerate(env, config, prompt, input.size);
      const runId = requestId();
      return jsonResponse(success({ runId, assetUrl: await storeImage(env, runId, result.bytes, result.mimeType), mimeType: result.mimeType, promptVersionId: input.promptVersionId, trace: { providerId: `${config.provider}-image`, model: config.modelId, modelVersion: config.modelId, providerRequestId: result.providerRequestId, usage: { imageCount: 1, estimatedCostCny: 0.3 } } }, id));
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/ai/assets/") && env.BUCKET?.get) {
      const key = decodeURIComponent(url.pathname.slice("/api/ai/assets/".length));
      if (!/^[a-z0-9-]+$/i.test(key)) throw new WorkerApiError("ASSET_NOT_FOUND", "生成资产不存在。", 404);
      const object = await env.BUCKET.get(key);
      if (!object) throw new WorkerApiError("ASSET_NOT_FOUND", "生成资产不存在。", 404);
      return new Response(object.body, { status: 200, headers: { "content-type": object.httpMetadata?.contentType ?? "image/png", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
    }
    throw new WorkerApiError("NOT_FOUND", "接口不存在。", 404);
  } catch (error) {
    const result = failure(error, id);
    return jsonResponse(result.body, result.status);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) return response;
    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
