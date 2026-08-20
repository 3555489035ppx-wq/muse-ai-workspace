import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer, type ViteDevServer } from "vite";
import type { ensureDecisionMap, loadDecisionMap } from "../../src/features/canvas/CreativeDecisionMapPage.js";
import { EntityCanvasAdapter } from "../../src/application/canvas/index.js";
import { gateDatabase } from "../helpers/phase-one-case.js";
import { createGeneratedCase } from "../helpers/generation-case.js";

interface PageModule { readonly ensureDecisionMap: typeof ensureDecisionMap; readonly loadDecisionMap: typeof loadDecisionMap; }
let server: ViteDevServer | undefined;
const modulePromise = createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" }).then(async value => { server = value; return value.ssrLoadModule("/src/features/canvas/CreativeDecisionMapPage.tsx") as Promise<PageModule>; });
after(async () => { await server?.close(); });

void test("decision map page creates, reloads and isolates canvas position and viewport", async () => { const { ensureDecisionMap, loadDecisionMap } = await modulePromise; const database = gateDatabase("p17-map-page"); try { const a = await createGeneratedCase(database, 79, "山西文化遗产"); const b = await createGeneratedCase(database, 80, "成都独立咖啡"); const mapA = await ensureDecisionMap(a.projectId, database, a.nextId); const mapB = await ensureDecisionMap(b.projectId, database, b.nextId); await new EntityCanvasAdapter(database, { entityIdFactory: a.nextId }).add(a.projectId, mapA.canvas.id, "brief", a.briefId, { x: 40, y: 60 }); const reloadedA = await loadDecisionMap(a.projectId, database); const reloadedB = await loadDecisionMap(b.projectId, database); assert.deepEqual(reloadedA.nodes[0]?.position, { x: 40, y: 60 }); assert.equal(reloadedA.viewport?.zoom, 0.8); assert.equal(reloadedB.nodes.length, 0); assert.notEqual(mapA.canvas.id, mapB.canvas.id); } finally { database.close(); } });
