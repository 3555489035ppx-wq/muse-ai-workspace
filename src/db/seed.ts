import type { ProjectBrief } from "../domain/project/index.js";
import { ProjectLifecycleService } from "../domain/services/ProjectLifecycleService.js";
import { asEntityId, asProjectId, type ProjectId } from "../domain/shared/id.js";
import { BaseRepository } from "../repositories/base/BaseRepository.js";
import { CanvasRepository } from "../repositories/CanvasRepository.js";
import { ProjectRepository } from "../repositories/ProjectRepository.js";
import type { MuseDatabase } from "./database.js";

export type Phase0SeedMode = "debug" | "test";
export interface Phase0SeedResult { readonly skipped: boolean; readonly projectIds: readonly ProjectId[]; }

const fixtures = [
  { projectId: asProjectId("18000000-0000-4000-8000-000000000001"), briefId: asEntityId("18000000-0000-4000-8000-000000000011"), canvasId: asEntityId("18000000-0000-4000-8000-000000000021"), name: "Phase 0 调试项目 A" },
  { projectId: asProjectId("18000000-0000-4000-8000-000000000002"), briefId: asEntityId("18000000-0000-4000-8000-000000000012"), canvasId: asEntityId("18000000-0000-4000-8000-000000000022"), name: "Phase 0 调试项目 B" },
] as const;

export async function seedPhase0(database: MuseDatabase, mode?: Phase0SeedMode): Promise<Phase0SeedResult> {
  if (mode === undefined) return { skipped: true, projectIds: [] };
  const lifecycle = new ProjectLifecycleService(database);
  const projects = new ProjectRepository(database);
  const briefs = new BaseRepository<ProjectBrief>(database.table("briefs"), "ProjectBrief");
  const canvases = new CanvasRepository(database);
  for (const fixture of fixtures) {
    if ((await projects.get(fixture.projectId)) === undefined) {
      await lifecycle.createMinimalProject({ id: fixture.projectId, name: fixture.name, type: "brand", status: "active", stage: "brief", outputTypes: ["brand_identity"], settings: { locale: "zh-CN", timezone: "Asia/Shanghai" }, schemaVersion: 4 });
    }
    if ((await briefs.get(fixture.briefId)) === undefined) {
      await briefs.create({ id: fixture.briefId, projectId: fixture.projectId, goal: "验证 Phase 0 基础设施", audience: "开发与测试", context: "通用调试 metadata", deliverables: ["基础验证"], constraints: ["不包含正式样板内容"] });
    }
    if ((await canvases.getCanvas(fixture.canvasId)) === undefined) {
      await canvases.createCanvas({ id: fixture.canvasId, projectId: fixture.projectId, name: "基础决策画布" });
    }
  }
  return { skipped: false, projectIds: fixtures.map((fixture) => fixture.projectId) };
}
