import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createMuseAiServer } from "../../server/server.js";
import { loadServerConfig } from "../../server/config.js";
import { ProviderConfigStore } from "../../server/application/ProviderConfigStore.js";

const actor = "muse-local-experiment";

async function startServer(runtimeDirectory: string, fetcher?: typeof fetch) {
  const server = createMuseAiServer({
    NODE_ENV: "test",
    MUSE_RUNTIME_DIRECTORY: runtimeDirectory,
    MUSE_AI_LIVE_ENABLED: "true",
    MUSE_AI_KILL_SWITCH: "false",
  }, fetcher);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, baseUrl: `http://127.0.0.1:${String(address.port)}` };
}

void test("V4.4 health and canonical provider routes always return a JSON envelope", async () => {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "muse-v44-health-"));
  const { server, baseUrl } = await startServer(runtimeDirectory);
  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const health = await healthResponse.json() as { ok?: boolean; data?: { services?: Record<string, string> } };
    assert.equal(healthResponse.status, 200);
    assert.equal(health.ok, true);
    assert.deepEqual(health.data?.services, { bff: "ready", secretStore: "ready", providerRegistry: "ready" });

    const providersResponse = await fetch(`${baseUrl}/api/ai/providers`, { headers: { "x-muse-actor-id": actor } });
    const providers = await providersResponse.json() as { ok?: boolean; data?: { providers?: unknown[] } };
    assert.equal(providersResponse.status, 200);
    assert.equal(providers.ok, true);
    assert.ok(Array.isArray(providers.data?.providers));
  } finally {
    server.close();
    await once(server, "close");
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
});

void test("provider config and secret are persisted separately without plaintext API keys", async () => {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "muse-v44-secret-"));
  const config = loadServerConfig({ NODE_ENV: "test", MUSE_RUNTIME_DIRECTORY: runtimeDirectory });
  try {
    const store = new ProviderConfigStore(config);
    await store.save("text", { provider: "deepseek", baseUrl: "https://api.deepseek.com", modelId: "deepseek-v4-pro", apiKey: "sk-v44-secret-93A" });
    const files = await readdir(runtimeDirectory);
    assert.ok(files.includes("providers.json"));
    assert.ok(files.includes("secrets.json.enc"));
    const providersFile = await readFile(join(runtimeDirectory, "providers.json"), "utf8");
    assert.doesNotMatch(providersFile, /sk-v44-secret-93A/);
    assert.doesNotMatch(providersFile, /apiKey/);
    const secretsFile = await readFile(join(runtimeDirectory, "secrets.json.enc"), "utf8");
    assert.doesNotMatch(secretsFile, /sk-v44-secret-93A/);
    const reloaded = new ProviderConfigStore(config);
    assert.equal(reloaded.view("text").secretConfigured, true);
    assert.match(reloaded.view("text").keyHint ?? "", /93A$/);
  } finally {
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
});

void test("a failed real test keeps the saved config and Demo Visual is a ready provider", async () => {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "muse-v44-failure-"));
  const upstream = (() => Promise.resolve(new Response("{}", { status: 401 }))) as typeof fetch;
  const { server, baseUrl } = await startServer(runtimeDirectory, upstream);
  const headers = { "x-muse-actor-id": actor, "content-type": "application/json" };
  try {
    const saveResponse = await fetch(`${baseUrl}/api/ai/providers/text-provider`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ provider: "deepseek", baseUrl: "https://api.deepseek.com", modelId: "deepseek-v4-pro", apiKey: "sk-saved-only-for-test" }),
    });
    assert.equal(saveResponse.status, 200);
    const failedTest = await fetch(`${baseUrl}/api/ai/providers/text-provider/test`, {
      method: "POST",
      headers,
      body: JSON.stringify({ persist: true, config: { provider: "deepseek", modelId: "deepseek-v4-pro" } }),
    });
    assert.equal(failedTest.status, 401);
    const providers = await (await fetch(`${baseUrl}/api/ai/providers`, { headers })).json() as { data: { providers: { category: string; secretConfigured: boolean; connectionStatus: string }[] } };
    const text = providers.data.providers.find((item) => item.category === "text");
    assert.ok(text);
    assert.equal(text.secretConfigured, true);
    assert.equal(text.connectionStatus, "error");

    const capabilities = await (await fetch(`${baseUrl}/api/ai/capabilities`)).json() as { data: { providers: { image: { provider?: string; ready?: boolean; mode?: string } } } };
    assert.equal(capabilities.data.providers.image.ready, true);
    assert.equal(capabilities.data.providers.image.mode, "demo");
  } finally {
    server.close();
    await once(server, "close");
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
});

void test("structured project generation uses the persisted DeepSeek adapter", async () => {
  const runtimeDirectory = await mkdtemp(join(tmpdir(), "muse-v44-generation-"));
  const upstream = (() => Promise.resolve(new Response(JSON.stringify({ id: "deepseek-run", choices: [{ message: { content: JSON.stringify({ directions: [{ name: "方向 A", statement: "可维护的移动净水设备" }] }) } }], usage: { prompt_tokens: 3, completion_tokens: 8 } }), { status: 200 }))) as typeof fetch;
  const { server, baseUrl } = await startServer(runtimeDirectory, upstream);
  const headers = { "x-muse-actor-id": actor, "content-type": "application/json" };
  const projectId = "e3228021-a528-4aa9-bfcb-4a1875d2124d";
  try {
    const saveResponse = await fetch(`${baseUrl}/api/ai/providers/text-provider`, { method: "PATCH", headers, body: JSON.stringify({ provider: "deepseek", baseUrl: "https://api.deepseek.com", modelId: "deepseek-v4-pro", apiKey: "sk-generation-test" }) });
    assert.equal(saveResponse.status, 200);
    const capabilities = await (await fetch(`${baseUrl}/api/ai/capabilities`)).json() as { data: { providers: { text: { ready: boolean; configured: boolean; mode: string } } } };
    assert.equal(capabilities.data.providers.text.ready, true, JSON.stringify(capabilities));
    const response = await fetch(`${baseUrl}/api/ai/structured`, { method: "POST", headers: { ...headers, "x-muse-project-id": projectId }, body: JSON.stringify({ projectId, purpose: "direction", instruction: "生成方向", idempotencyKey: "v44-generation-test-1" }) });
    const raw = await response.text();
    const payload = JSON.parse(raw) as { ok: boolean; data: { result: { directions: unknown[] }; trace: { providerId: string; parsed: boolean } }; error?: unknown };
    assert.equal(response.status, 200, raw);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.trace.providerId, "deepseek-text");
    assert.equal(payload.data.trace.parsed, true);
    assert.equal(payload.data.result.directions.length, 1);
  } finally {
    server.close();
    await once(server, "close");
    await rm(runtimeDirectory, { recursive: true, force: true });
  }
});
