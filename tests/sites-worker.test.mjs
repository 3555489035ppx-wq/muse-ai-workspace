import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const [request, expectedAssetCalls] of [
    [new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }), 0],
    [new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }), 1],
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, expectedAssetCalls);
  }
});

test("stores an online user's provider key in an encrypted session cookie", async () => {
  const env = {
    MUSE_SITE_SECRET: "test-site-secret",
    ASSETS: {
      fetch: async () => new Response("missing", { status: 404 }),
    },
  };
  const initial = await worker.fetch(new Request("https://example.test/api/ai/providers"), env);
  assert.equal(initial.status, 200);
  const initialPayload = await initial.json();
  assert.equal(initialPayload.ok, true);
  assert.equal(initialPayload.data.providers.find((item) => item.category === "text").secretConfigured, false);

  const save = await worker.fetch(new Request("https://example.test/api/ai/providers/text-provider", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      modelId: "deepseek-v4-pro",
      apiKey: "sk-online-session-secret",
    }),
  }), env);
  assert.equal(save.status, 200);
  const savePayload = await save.json();
  assert.equal(savePayload.ok, true);
  assert.doesNotMatch(JSON.stringify(savePayload), /sk-online-session-secret/);
  const sessionCookie = save.headers.get("set-cookie");
  assert.match(sessionCookie ?? "", /muse_provider_text=/);

  const configured = await worker.fetch(new Request("https://example.test/api/ai/providers", {
    headers: { cookie: sessionCookie.split(";")[0] },
  }), env);
  const configuredPayload = await configured.json();
  const textProvider = configuredPayload.data.providers.find((item) => item.category === "text");
  assert.equal(configured.status, 200);
  assert.equal(textProvider.secretConfigured, true);
  assert.match(textProvider.keyHint, /••••••••/);
  assert.doesNotMatch(JSON.stringify(configuredPayload), /sk-online-session-secret/);
});

test("forwards a saved user's key only to the upstream text provider", async () => {
  const upstreamCalls = [];
  const env = {
    MUSE_SITE_SECRET: "test-site-secret",
    MUSE_UPSTREAM_FETCH: async (input, init) => {
      upstreamCalls.push({ input: String(input), authorization: init.headers.authorization, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({
        id: "text-request-1",
        choices: [{ message: { content: '{"status":"ok"}' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  };
  const save = await worker.fetch(new Request("https://example.test/api/ai/providers/text-provider", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "deepseek", baseUrl: "https://api.deepseek.com", modelId: "deepseek-v4-pro", apiKey: "sk-proxy-secret" }),
  }), env);
  const cookie = save.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const response = await worker.fetch(new Request("https://example.test/api/ai/structured", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ purpose: "design_brief", instruction: "返回状态", schemaHint: { status: "ok" } }),
  }), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.result.status, "ok");
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].authorization, "Bearer sk-proxy-secret");
  assert.equal(upstreamCalls[0].body.model, "deepseek-v4-pro");
  assert.doesNotMatch(JSON.stringify(payload), /sk-proxy-secret/);
});

test("uses a site-managed text provider without a visitor API key", async () => {
  const upstreamCalls = [];
  const env = {
    MUSE_SITE_AI_ENABLED: "true",
    MUSE_SITE_KILL_SWITCH: "false",
    MUSE_SITE_TEXT_PROVIDER: "deepseek",
    MUSE_SITE_TEXT_DISPLAY_NAME: "Muse Text AI",
    MUSE_SITE_TEXT_API_KEY: "site-owned-secret",
    MUSE_SITE_TEXT_BASE_URL: "",
    MUSE_SITE_TEXT_MODEL: "",
    MUSE_UPSTREAM_FETCH: async (input, init) => {
      upstreamCalls.push({ input: String(input), authorization: init.headers.authorization, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({
        id: "site-text-request-1",
        choices: [{ message: { content: '{"projectSummary":"真实模型建议"}' } }],
        usage: { prompt_tokens: 9, completion_tokens: 4 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  };

  const capabilities = await worker.fetch(new Request("https://example.test/api/ai/capabilities"), env);
  const capabilityPayload = await capabilities.json();
  assert.equal(capabilities.status, 200);
  assert.equal(capabilityPayload.data.providers.text.ready, true);
  assert.equal(capabilityPayload.data.providers.text.managedBySite, true);
  assert.doesNotMatch(JSON.stringify(capabilityPayload), /site-owned-secret/);

  const response = await worker.fetch(new Request("https://example.test/api/ai/structured", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose: "overview", instruction: "为模糊产品想法生成项目理解", schemaHint: { projectSummary: "string" } }),
  }), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.result.projectSummary, "真实模型建议");
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].authorization, "Bearer site-owned-secret");
  assert.equal(upstreamCalls[0].input, "https://api.deepseek.com/chat/completions");
  assert.equal(upstreamCalls[0].body.model, "deepseek-v4-pro");
  assert.doesNotMatch(JSON.stringify(payload), /site-owned-secret/);

  const blockedEdit = await worker.fetch(new Request("https://example.test/api/ai/providers/text-provider", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "visitor-secret" }),
  }), env);
  const blockedPayload = await blockedEdit.json();
  assert.equal(blockedEdit.status, 403);
  assert.equal(blockedPayload.error.code, "SITE_PROVIDER_MANAGED");
  assert.doesNotMatch(JSON.stringify(blockedPayload), /visitor-secret|site-owned-secret/);
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
