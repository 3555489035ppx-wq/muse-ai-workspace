import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AiRunRepository } from "../../server/application/AiRunRepository.js";
import { BudgetService } from "../../server/application/BudgetService.js";
import { loadServerConfig } from "../../server/config.js";
import { DashScopeImageProvider } from "../../server/providers/dashscope/DashScopeImageProvider.js";
import { DashScopeStructuredProvider } from "../../server/providers/dashscope/DashScopeStructuredProvider.js";
import { ProviderRegistry } from "../../server/providers/registry.js";
import { authorizeProject, redact, validateExternalHttpsUrl } from "../../server/security/policy.js";
import type { GenerationEvent } from "../../src/application/generation/contracts.js";
import type { PromptVersion } from "../../src/domain/prompt/index.js";
import { asEntityId, asProjectId } from "../../src/domain/shared/id.js";
import { requireIsoTimestamp } from "../../src/domain/shared/time.js";
import { MuseBffGenerationProvider } from "../../src/infrastructure/providers/remote/generation/index.js";
import { MuseAiClient } from "../../src/lib/api/museAiClient.js";

const baseEnvironment = { NODE_ENV: "test", MUSE_AI_LIVE_ENABLED: "true", MUSE_AI_KILL_SWITCH: "false", MUSE_AI_ACTOR_ID: "actor-test", MUSE_AI_REQUEST_BUDGET_CNY: "1", MUSE_AI_PROJECT_DAILY_BUDGET_CNY: "2", DASHSCOPE_API_KEY: "test-provider-token", DASHSCOPE_WORKSPACE_ID: "llm-test", MUSE_AI_LLM_MODEL: "qwen-plus", MUSE_AI_IMAGE_MODEL: "wan2.7-image-pro" } satisfies NodeJS.ProcessEnv;

void test("server config keeps provider secret on the server and defaults to fail-closed", () => {
  const defaults = loadServerConfig({ NODE_ENV: "test" });
  assert.equal(defaults.liveEnabled, false); assert.equal(defaults.killSwitchActive, true); assert.equal(defaults.dashscopeApiKey, undefined);
  const configured = loadServerConfig(baseEnvironment); assert.equal(configured.dashscopeApiKey, "test-provider-token"); assert.equal(configured.dashscopeWorkspaceId, "llm-test");
});

void test("security policy redacts secrets, rejects private URLs, and enforces project scope", () => {
  assert.equal(redact("Authorization: Bearer sk-supersecret123"), "Authorization: [REDACTED]");
  assert.throws(() => { validateExternalHttpsUrl("http://127.0.0.1/secret"); }); assert.equal(validateExternalHttpsUrl("https://example.com/a#b").toString(), "https://example.com/a");
  const headers = new Headers({ "x-muse-actor-id": "actor-test", "x-muse-project-id": "p1" });
  assert.doesNotThrow(() => { authorizeProject(headers, "p1", loadServerConfig(baseEnvironment)); }); assert.throws(() => { authorizeProject(headers, "p2", loadServerConfig(baseEnvironment)); });
});

void test("budget service blocks per-request and daily overspend", async () => {
  const budget = new BudgetService(1, 2); budget.estimateOrThrow("p1", 0.8); await budget.record({ projectId: "p1", runId: "r1", amountCny: 0.8, recordedAt: "2026-07-29T01:00:00.000Z" }); await budget.record({ projectId: "p1", runId: "r2", amountCny: 0.7, recordedAt: "2026-07-29T02:00:00.000Z" });
  assert.throws(() => { budget.estimateOrThrow("p1", 0.6, new Date("2026-07-29T03:00:00.000Z")); }); assert.throws(() => { budget.estimateOrThrow("p1", 1.1); }); assert.equal(budget.total("p1"), 1.5);
});

void test("AI run repository persists only hashed input and replays idempotency", async () => {
  const directory = await mkdtemp(join(tmpdir(), "muse-p3-")); const path = join(directory, "runs.json");
  try {
    const repository = new AiRunRepository(path); const now = new Date().toISOString();
    await repository.create({ id: "run-1", actorId: "actor", projectId: "project", operation: "structured", idempotencyKey: "request-123", inputHash: "hash-only", status: "running", createdAt: now, updatedAt: now });
    await repository.update("run-1", { status: "succeeded", safeResult: { result: "ok" } });
    const replay = await new AiRunRepository(path).findByIdempotency("actor", "project", "request-123"); assert.equal(replay?.status, "succeeded");
    const persisted = await readFile(path, "utf8"); assert.match(persisted, /hash-only/); assert.doesNotMatch(persisted, /secret prompt/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

void test("provider registry rejects duplicates and selects a configured capability", () => {
  const config = loadServerConfig(baseEnvironment); const provider = new DashScopeStructuredProvider(config, () => Promise.reject(new Error("not called"))); const registry = new ProviderRegistry(); registry.register(provider); assert.equal(registry.require("structured").descriptor.id, "dashscope-structured"); assert.throws(() => { registry.register(provider); }); assert.throws(() => { registry.require("image_generate"); });
});

void test("structured adapter maps JSON output and never emits the API key", async () => {
  let requestBody = ""; let authorization = "";
  const fakeFetch = ((_input: URL | RequestInfo, init?: RequestInit) => { requestBody = typeof init?.body === "string" ? init.body : ""; authorization = new Headers(init?.headers).get("authorization") ?? ""; return Promise.resolve(new Response(JSON.stringify({ id: "provider-request", choices: [{ message: { content: "{\"directions\":[\"A\",\"B\",\"C\"]}" } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }), { status: 200, headers: { "content-type": "application/json" } })); }) as typeof fetch;
  const provider = new DashScopeStructuredProvider(loadServerConfig(baseEnvironment), fakeFetch); const result = await provider.complete({ instruction: "生成三个不同方向", purpose: "direction", enableSearch: false });
  assert.deepEqual(result.value, { directions: ["A", "B", "C"] }); assert.equal(result.trace.providerRequestId, "provider-request"); assert.equal(authorization, "Bearer test-provider-token"); assert.doesNotMatch(requestBody, /test-provider-token/);
});

void test("image adapter validates provider URL, MIME and returns bytes instead of signed URL", async () => {
  let calls = 0;
  const fakeFetch = (() => { calls += 1; if (calls === 1) return Promise.resolve(new Response(JSON.stringify({ request_id: "image-request", output: { choices: [{ message: { content: [{ type: "image", image: "https://cdn.example.com/result.png?signature=secret" }] } }] }, usage: { image_count: 1 } }), { status: 200, headers: { "content-type": "application/json" } })); return Promise.resolve(new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png", "content-length": "4" } })); }) as typeof fetch;
  const result = await new DashScopeImageProvider(loadServerConfig(baseEnvironment), fakeFetch).generate({ prompt: "海报", size: "1K" });
  assert.equal(result.mimeType, "image/png"); assert.deepEqual([...result.bytes], [137, 80, 78, 71]); assert.equal(result.trace.providerRequestId, "image-request");
});

void test("remote generation adapter returns provider-neutral traceable metadata", async () => {
  const runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; const projectId = asProjectId("11111111-1111-4111-8111-111111111111"); const entityId = asEntityId("22222222-2222-4222-8222-222222222222"); const now = requireIsoTimestamp("2026-07-29T00:00:00.000Z");
  const promptVersion = { id: entityId, projectId, promptSpecId: entityId, explorationId: entityId, directionId: entityId, visualDNAId: entityId, researchSessionId: entityId, adapterTarget: "generic_image", version: 1, promptText: "中国文化海报", createdAt: now, updatedAt: now } satisfies PromptVersion;
  const fakeFetch = (() => Promise.resolve(new Response(JSON.stringify({ ok: true, requestId: "request", data: { runId, assetUrl: `/api/ai/assets/${runId}.png`, mimeType: "image/png", promptVersionId: entityId, trace: { providerId: "dashscope-image", model: "wan2.7-image-pro", modelVersion: "wan2.7-image-pro", usage: { estimatedCostCny: 0.2 } } } }), { status: 200, headers: { "content-type": "application/json" } }))) as typeof fetch;
  const provider = new MuseBffGenerationProvider(new MuseAiClient(fakeFetch)); const events: GenerationEvent[] = [];
  for await (const event of provider.generate({ projectId, promptVersion, operation: "generate", seed: "stable" })) events.push(event);
  const result = events.find((event): event is Extract<GenerationEvent, { readonly type: "result" }> => event.type === "result")?.result;
  assert.ok(result); assert.equal(result.providerId, "dashscope-image"); assert.equal(result.assetUrl, `/api/ai/assets/${runId}.png`); assert.equal(result.model, "wan2.7-image-pro");
});
