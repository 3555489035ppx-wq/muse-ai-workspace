import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createMuseAiServer } from "../../server/server.js";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SafeApiError } from "../../server/api/envelope.js";
import { ProviderConfigStore } from "../../server/application/ProviderConfigStore.js";
import { loadServerConfig } from "../../server/config.js";
import { DeepSeekTextProvider } from "../../server/providers/deepseek/DeepSeekTextProvider.js";
import { OpenAIImageProvider } from "../../server/providers/openai/OpenAIImageProvider.js";
import { TavilySearchProvider } from "../../server/providers/search/TavilySearchProvider.js";
import { MuseAiClient, MuseAiClientError } from "../../src/lib/api/museAiClient.js";

const env = {
  NODE_ENV: "test",
  MUSE_AI_LIVE_ENABLED: "true",
  MUSE_AI_KILL_SWITCH: "false",
  DEEPSEEK_API_KEY: "deepseek-test-secret",
  DEEPSEEK_TEXT_MODEL: "deepseek-v4-pro",
  OPENAI_API_KEY: "openai-test-secret",
  OPENAI_IMAGE_MODEL: "gpt-image-2",
} satisfies NodeJS.ProcessEnv;

void test("BFF malformed and empty responses become typed safe client errors", async () => {
  const malformed = new MuseAiClient(() => Promise.resolve(new Response("<html>gateway error</html>", {
    status: 502,
    headers: { "content-type": "text/html" },
  })));
  await assert.rejects(() => malformed.capabilities(), (error: unknown) => error instanceof MuseAiClientError && error.code === "INVALID_RESPONSE_FORMAT");

  const empty = new MuseAiClient(() => Promise.resolve(new Response("", {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
  await assert.rejects(() => empty.capabilities(), (error: unknown) => error instanceof MuseAiClientError && error.code === "EMPTY_SERVER_RESPONSE");
});

void test("Provider config keeps the full key in the encrypted server secret store only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "muse-provider-config-"));
  const config = loadServerConfig({ NODE_ENV: "test", MUSE_RUNTIME_DIRECTORY: directory });
  try {
    const store = new ProviderConfigStore(config);
    const view = await store.save("text", { provider: "deepseek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-pro", apiKey: "sk-provider-secret-93A" });
    assert.equal("apiKey" in view, false);
    assert.match(view.keyHint ?? "", /93A$/);
    assert.doesNotMatch(JSON.stringify(view), /sk-provider-secret-93A/);
    const persisted = await readFile(join(directory, "providers.json"), "utf8");
    assert.doesNotMatch(persisted, /sk-provider-secret-93A/);
    assert.doesNotMatch(persisted, /apiKey/);
    const encrypted = await readFile(join(directory, "secrets.json.enc"), "utf8");
    assert.doesNotMatch(encrypted, /sk-provider-secret-93A/);
    const reloaded = new ProviderConfigStore(config);
    assert.match(reloaded.view("text").keyHint ?? "", /93A$/);
    await reloaded.remove("text");
    assert.equal(reloaded.view("text").keyHint, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

void test("V4 config separates text and image secrets and uses the current image model default", () => {
  const defaults = loadServerConfig({ NODE_ENV: "test" });
  assert.equal(defaults.openaiImageModel, "gpt-image-2");
  assert.equal(defaults.deepseekApiKey, undefined);
  assert.equal(defaults.openaiApiKey, undefined);
  const configured = loadServerConfig(env);
  assert.equal(configured.deepseekTextModel, "deepseek-v4-pro");
  assert.equal(configured.openaiImageModel, "gpt-image-2");
});

void test("Tavily search adapter returns provenance without exposing its key", async () => {
  let requestBody = "";
  let authorization = "";
  const fakeFetch = ((_url: URL | RequestInfo, init?: RequestInit) => {
    requestBody = typeof init?.body === "string" ? init.body : "";
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Promise.resolve(new Response(JSON.stringify({ request_id: "tv-1", usage: { credits: 1 }, results: [{ title: "报告", url: "https://example.com/report", content: "公开摘要", raw_content: "公开正文", published_date: "2026-08-01", score: 0.8 }] }), { status: 200 }));
  }) as typeof fetch;
  const provider = new TavilySearchProvider("tavily-test-secret", "https://api.tavily.com", fakeFetch);
  const result = await provider.search({ query: "真实用户研究", maxResults: 5 });
  assert.equal(result.results.length, 1);
  const first = result.results[0];
  assert.ok(first);
  assert.equal(first.contentStatus, "full");
  assert.equal(first.publisher, "example.com");
  assert.equal(authorization, "Bearer tavily-test-secret");
  assert.doesNotMatch(requestBody, /tavily-test-secret/);
});

void test("local BFF exposes the scoped research search route", async () => {
  const directory = await mkdtemp(join(tmpdir(), "muse-search-runtime-"));
  const projectId = "e5a912f1-81e1-4595-8196-4069e39d3b4f";
  const fakeFetch = ((_url: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer local-search-secret");
    return Promise.resolve(new Response(JSON.stringify({ request_id: "local-search-1", usage: { credits: 1 }, results: [{ title: "公开材料", url: "https://example.com/source", content: "摘要", raw_content: "原文片段" }] }), { status: 200 }));
  }) as typeof fetch;
  const server = createMuseAiServer({ NODE_ENV: "test", MUSE_RUNTIME_DIRECTORY: directory, MUSE_AI_LIVE_ENABLED: "true", MUSE_AI_KILL_SWITCH: "false", MUSE_SITE_SEARCH_API_KEY: "local-search-secret" }, fakeFetch);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const response = await fetch(`http://127.0.0.1:${String(address.port)}/api/research/search`, { method: "POST", headers: { "content-type": "application/json", "x-muse-actor-id": "muse-local-experiment", "x-muse-project-id": projectId }, body: JSON.stringify({ projectId, idempotencyKey: "search-route-test-1", query: "真实用户研究", maxResults: 5 }) });
    const payload = await response.json() as { readonly ok?: boolean; readonly data?: { readonly results?: readonly unknown[] } };
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data?.results?.length, 1);
  } finally {
    server.close();
    await once(server, "close");
    await rm(directory, { recursive: true, force: true });
  }
});

void test("DeepSeek adapter requests JSON and does not serialize the API key", async () => {
  let body = "";
  let authorization = "";
  const fakeFetch = ((_url: URL | RequestInfo, init?: RequestInit) => {
    body = typeof init?.body === "string" ? init.body : "";
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Promise.resolve(new Response(JSON.stringify({ id: "ds-1", choices: [{ message: { content: "{\"status\":\"ok\"}" } }], usage: { prompt_tokens: 4, completion_tokens: 3 } }), { status: 200 }));
  }) as typeof fetch;
  const result = await new DeepSeekTextProvider(loadServerConfig(env), fakeFetch).complete({ instruction: "返回状态", purpose: "project_brain", enableSearch: false });
  assert.deepEqual(result.value, { status: "ok" });
  assert.equal(authorization, "Bearer deepseek-test-secret");
  assert.doesNotMatch(body, /deepseek-test-secret/);
  assert.match(body, /json_object/);
});

void test("DeepSeek maps balance errors into an actionable safe error", async () => {
  const fakeFetch = (() => Promise.resolve(new Response("{}", { status: 402 }))) as typeof fetch;
  await assert.rejects(() => new DeepSeekTextProvider(loadServerConfig(env), fakeFetch).complete({ instruction: "返回状态", purpose: "project_brain", enableSearch: false }), (error: unknown) => {
    if (!(error instanceof Error) || !("code" in error)) return false;
    return error.code === "TEXT_PROVIDER_BALANCE_REQUIRED" && error.message.includes("余额");
  });
});

void test("DeepSeek preserves actionable upstream status categories", async () => {
  const cases = [
    [401, "TEXT_PROVIDER_AUTH_FAILED", "Key 无效"],
    [402, "TEXT_PROVIDER_BALANCE_REQUIRED", "余额不足"],
    [404, "TEXT_PROVIDER_MODEL_NOT_FOUND", "模型或 Base URL"],
    [422, "TEXT_PROVIDER_INVALID_PARAMETERS", "模型参数"],
    [429, "TEXT_PROVIDER_RATE_LIMITED", "请求过于频繁"],
    [500, "TEXT_PROVIDER_INTERNAL_ERROR", "内部错误"],
  ] as const;
  for (const [status, code, message] of cases) {
    const fakeFetch = (() => Promise.resolve(new Response("{}", { status }))) as typeof fetch;
    await assert.rejects(
      () => new DeepSeekTextProvider(loadServerConfig(env), fakeFetch).complete({ instruction: "返回状态", purpose: "provider_connection_test", enableSearch: false }),
      (error: unknown) => error instanceof SafeApiError && error.code === code && error.message.includes(message),
    );
  }
});

void test("DeepSeek connection test binds the real adapter before the enabled flag is activated", async () => {
  const directory = await mkdtemp(join(tmpdir(), "muse-deepseek-runtime-"));
  let requestUrl = "";
  let requestBody = "";
  let authorization = "";
  const fakeFetch = ((_url: URL | RequestInfo, init?: RequestInit) => {
    requestUrl = typeof _url === "string" ? _url : _url instanceof URL ? _url.href : _url.url;
    requestBody = typeof init?.body === "string" ? init.body : "";
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Promise.resolve(new Response(JSON.stringify({ id: "ds-test", choices: [{ message: { content: "{\"status\":\"ok\"}" } }], usage: { prompt_tokens: 2, completion_tokens: 2 } }), { status: 200 }));
  }) as typeof fetch;
  const server = createMuseAiServer({
    NODE_ENV: "test",
    MUSE_RUNTIME_DIRECTORY: directory,
    MUSE_AI_LIVE_ENABLED: "true",
    MUSE_AI_KILL_SWITCH: "false",
  }, fakeFetch);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const response = await fetch(`http://127.0.0.1:${String(address.port)}/api/providers/text/test`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-muse-actor-id": "muse-local-experiment" },
      body: JSON.stringify({
        persist: true,
        config: {
          provider: "deepseek",
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-v4-pro",
          apiKey: "sk-test-provider-key",
          enabled: false,
          reasoningMode: "max",
        },
      }),
    });
    const payload = await response.json() as { readonly ok?: boolean; readonly data?: { readonly provider?: string; readonly status?: string } };
    assert.ok(payload.data);
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.provider, "DeepSeek Text AI");
    assert.equal(payload.data.status, "connected");
    assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
    assert.equal(authorization, "Bearer sk-test-provider-key");
    assert.match(requestBody, /"thinking":\{"type":"enabled"\}/);
    assert.match(requestBody, /"reasoning_effort":"max"/);
    assert.doesNotMatch(requestBody, /sk-test-provider-key/);
  } finally {
    server.close();
    await once(server, "close");
    await rm(directory, { recursive: true, force: true });
  }
});

void test("OpenAI image adapter decodes provider bytes with traceable metadata", async () => {
  const bytes = Buffer.from([1, 2, 3, 4]);
  const fakeFetch = (() => Promise.resolve(new Response(JSON.stringify({ id: "img-1", data: [{ b64_json: bytes.toString("base64") }] }), { status: 200 }))) as typeof fetch;
  const result = await new OpenAIImageProvider(loadServerConfig(env), fakeFetch).generate({ prompt: "industrial design object", size: "1K" });
  assert.deepEqual([...result.bytes], [1, 2, 3, 4]);
  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.trace.providerId, "openai-image");
  assert.equal(result.trace.model, "gpt-image-2");
});
