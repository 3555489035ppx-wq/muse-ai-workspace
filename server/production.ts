import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMuseAiHandler } from "./server.js";
import { loadServerConfig } from "./config.js";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function safeClientPath(root: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const target = resolve(root, `.${decoded}`);
  const relativeTarget = relative(root, target);
  return relativeTarget.startsWith("..") || isAbsolute(relativeTarget) ? undefined : target;
}

function serveFile(response: ServerResponse, path: string, cacheControl: string): void {
  const contentType = CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
  response.writeHead(200, { "content-type": contentType, "cache-control": cacheControl, "x-content-type-options": "nosniff" });
  createReadStream(path).pipe(response);
}

export function createMuseProductionServer(environment: NodeJS.ProcessEnv = process.env) {
  const config = loadServerConfig(environment);
  const apiHandler = createMuseAiHandler(environment);
  const clientRoot = resolve(process.cwd(), "dist/client");
  const indexPath = join(clientRoot, "index.html");
  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      await apiHandler(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      json(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return;
    }
    const requestedPath = safeClientPath(clientRoot, url.pathname);
    let filePath = indexPath;
    let cacheControl = "no-cache";
    if (requestedPath) {
      try {
        if ((await stat(requestedPath)).isFile()) {
          filePath = requestedPath;
          cacheControl = filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable";
        }
      } catch {
        filePath = indexPath;
      }
    }
    try {
      if (request.method === "HEAD") {
        const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
        response.writeHead(200, { "content-type": contentType, "cache-control": cacheControl, "x-content-type-options": "nosniff" });
        response.end();
        return;
      }
      serveFile(response, filePath, cacheControl);
    } catch {
      json(response, 404, { error: "CLIENT_BUILD_NOT_FOUND" });
    }
  };
  return { config, server: createServer((request, response) => { void handle(request, response); }) };
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
if (entryPath) {
  const { config, server } = createMuseProductionServer();
  server.listen(config.port, "0.0.0.0", () => { process.stdout.write(`Muse production server ready on http://0.0.0.0:${String(config.port)}\n`); });
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
