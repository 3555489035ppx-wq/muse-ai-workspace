import type { IncomingMessage, ServerResponse } from "node:http";
import museWorker from "../worker/index.js";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requestUrl(request: IncomingMessage): URL {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol;
  return new URL(request.url ?? "/api", `${protocol || "https"}://${request.headers.host || "localhost"}`);
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
  }
  return headers;
}

async function requestBody(request: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
  if (!chunks.length) return undefined;
  return Buffer.concat(chunks).toString("utf8");
}

function runtimeEnvironment(): Record<string, string> {
  return {
    MUSE_SITE_SECRET: process.env.MUSE_SITE_SECRET ?? "",
    MUSE_SITE_AI_ENABLED: process.env.MUSE_SITE_AI_ENABLED ?? "true",
    MUSE_SITE_KILL_SWITCH: process.env.MUSE_SITE_KILL_SWITCH ?? "false",
    MUSE_SITE_REQUEST_BUDGET_CNY: process.env.MUSE_SITE_REQUEST_BUDGET_CNY ?? "1",
    MUSE_SITE_PROJECT_DAILY_BUDGET_CNY: process.env.MUSE_SITE_PROJECT_DAILY_BUDGET_CNY ?? "10",
    // Reuse the deployment's existing DeepSeek secret during the migration to
    // site-managed AI. MUSE_SITE_TEXT_* always wins, so other providers can be
    // configured without changing this compatibility path.
    MUSE_SITE_TEXT_PROVIDER: process.env.MUSE_SITE_TEXT_PROVIDER ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : ""),
    MUSE_SITE_TEXT_DISPLAY_NAME: process.env.MUSE_SITE_TEXT_DISPLAY_NAME ?? (process.env.DEEPSEEK_API_KEY ? "Muse Text AI" : ""),
    MUSE_SITE_TEXT_API_KEY: process.env.MUSE_SITE_TEXT_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "",
    MUSE_SITE_TEXT_BASE_URL: process.env.MUSE_SITE_TEXT_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? "",
    MUSE_SITE_TEXT_MODEL: process.env.MUSE_SITE_TEXT_MODEL ?? process.env.DEEPSEEK_TEXT_MODEL ?? "",
    MUSE_SITE_IMAGE_PROVIDER: process.env.MUSE_SITE_IMAGE_PROVIDER ?? "",
    MUSE_SITE_IMAGE_DISPLAY_NAME: process.env.MUSE_SITE_IMAGE_DISPLAY_NAME ?? "",
    MUSE_SITE_IMAGE_API_KEY: process.env.MUSE_SITE_IMAGE_API_KEY ?? "",
    MUSE_SITE_IMAGE_BASE_URL: process.env.MUSE_SITE_IMAGE_BASE_URL ?? "",
    MUSE_SITE_IMAGE_MODEL: process.env.MUSE_SITE_IMAGE_MODEL ?? "",
  };
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = BODY_METHODS.has(request.method ?? "") ? await requestBody(request) : undefined;
  const webRequest = new Request(requestUrl(request), {
    method: request.method ?? "GET",
    headers: requestHeaders(request),
    body,
  });
  const webResponse = await museWorker.fetch(webRequest, runtimeEnvironment());

  response.statusCode = webResponse.status;
  let setCookie: string | undefined;
  webResponse.headers.forEach((value: string, name: string) => {
    if (name.toLowerCase() === "set-cookie") setCookie = value;
    else response.setHeader(name, value);
  });
  if (setCookie) response.setHeader("set-cookie", setCookie);
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}
