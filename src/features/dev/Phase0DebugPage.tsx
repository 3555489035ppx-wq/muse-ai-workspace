import { useMemo, useState } from "react";
import type { ProjectBrief } from "../../domain/project/index.js";
import { MigrationService, type MigrationResult } from "../../domain/services/MigrationService.js";
import { ProjectLifecycleService } from "../../domain/services/ProjectLifecycleService.js";
import { PROJECT_WORKFLOW_STATES, ProjectWorkflowService, type ProjectWorkflowState } from "../../domain/services/ProjectWorkflowService.js";
import { TraceabilityService, type GeneratedAssetTraceabilityChain } from "../../domain/services/TraceabilityService.js";
import { asEntityId, asProjectId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { db, type MuseDatabase } from "../../db/database.js";
import { AssetRepository } from "../../repositories/AssetRepository.js";
import { BaseRepository } from "../../repositories/base/BaseRepository.js";
import { DirectionRepository } from "../../repositories/DirectionRepository.js";
import { ExplorationRepository } from "../../repositories/ExplorationRepository.js";
import { GenerationRepository } from "../../repositories/GenerationRepository.js";
import { MoodboardRepository } from "../../repositories/MoodboardRepository.js";
import { ProjectRepository } from "../../repositories/ProjectRepository.js";
import { PromptRepository } from "../../repositories/PromptRepository.js";
import { ResearchRepository } from "../../repositories/ResearchRepository.js";

export interface Phase0DebugController {
  listProjects(): Promise<readonly { readonly id: ProjectId; readonly name: string }[]>;
  inspect(): Promise<MigrationResult>;
  deleteProject(id: ProjectId): Promise<void>;
  transition(from: ProjectWorkflowState, to: ProjectWorkflowState): ProjectWorkflowState;
  trace(id: EntityId): Promise<GeneratedAssetTraceabilityChain>;
}

export function createPhase0DebugController(database: MuseDatabase): Phase0DebugController {
  const projects = new ProjectRepository(database);
  const lifecycle = new ProjectLifecycleService(database);
  const migration = new MigrationService(database);
  const workflow = new ProjectWorkflowService();
  const assets = new AssetRepository(database);
  const generation = new GenerationRepository(database);
  const prompts = new PromptRepository(database);
  const explorations = new ExplorationRepository(database);
  const directions = new DirectionRepository(database);
  const moodboards = new MoodboardRepository(database);
  const research = new ResearchRepository(database);
  const briefs = new BaseRepository<ProjectBrief>(database.table("briefs"), "ProjectBrief");
  const traceability = new TraceabilityService({
    getGeneratedAsset: (id) => generation.getGeneratedAsset(id), getAsset: (id) => assets.get(id), getGenerationJob: (id) => generation.getJob(id),
    getPromptVersion: (id) => prompts.getVersion(id), getPromptSpec: (id) => prompts.getSpec(id), getExploration: (id) => explorations.getExploration(id),
    getDirection: (id) => directions.getDirection(id), getVisualDNA: (id) => moodboards.getVisualDNA(id), getMoodboard: (id) => moodboards.getMoodboard(id),
    getResearchSession: (id) => research.getSession(id), getBrief: (id) => briefs.get(id), getProject: (id) => projects.get(id),
  });
  return {
    listProjects: async () => (await projects.list()).map(({ id, name }) => ({ id: asProjectId(id), name })),
    inspect: () => migration.inspectAndMigrate(),
    deleteProject: (id) => lifecycle.deleteProject(id),
    transition: (from, to) => workflow.transition(from, to),
    trace: (id) => traceability.resolveGeneratedAsset(id),
  };
}

export function Phase0DebugPage({ controller: suppliedController }: { readonly controller?: Phase0DebugController }) {
  const controller = useMemo(() => suppliedController ?? createPhase0DebugController(db), [suppliedController]);
  const [output, setOutput] = useState("尚未执行检查");
  const [projectId, setProjectId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [from, setFrom] = useState<ProjectWorkflowState>("DRAFT");
  const [to, setTo] = useState<ProjectWorkflowState>("RESEARCHING");
  const show = (value: unknown) => { setOutput(JSON.stringify(value, null, 2)); };
  const run = (work: () => Promise<unknown>) => { void work().then(show).catch((error: unknown) => { show(error instanceof Error ? { name: error.name, message: error.message } : error); }); };

  return (
    <main>
      <h1>Muse Phase 0 开发检查</h1>
      <p>此页面仅在开发环境注册，展示真实本地实体与基础设施状态。</p>
      <section><h2>项目 A/B 与重新读取</h2><button type="button" onClick={() => { run(() => controller.listProjects()); }}>从 Repository 重新读取项目</button></section>
      <section><h2>迁移检查</h2><button type="button" onClick={() => { run(() => controller.inspect()); }}>检查本地数据库</button></section>
      <section><h2>工作流转换</h2>
        <select value={from} onChange={(event) => { setFrom(event.target.value as ProjectWorkflowState); }}>{PROJECT_WORKFLOW_STATES.map((state) => <option key={state}>{state}</option>)}</select>
        <select value={to} onChange={(event) => { setTo(event.target.value as ProjectWorkflowState); }}>{PROJECT_WORKFLOW_STATES.map((state) => <option key={state}>{state}</option>)}</select>
        <button type="button" onClick={() => { show(controller.transition(from, to)); }}>验证转换</button>
      </section>
      <section><h2>全链 metadata</h2><input aria-label="GeneratedAsset ID" value={assetId} onChange={(event) => { setAssetId(event.target.value); }} /><button type="button" onClick={() => { run(() => controller.trace(asEntityId(assetId))); }}>解析追溯链</button></section>
      <section><h2>事务删除</h2><input aria-label="Project ID" value={projectId} onChange={(event) => { setProjectId(event.target.value); }} /><button type="button" onClick={() => { run(async () => { await controller.deleteProject(asProjectId(projectId)); return controller.listProjects(); }); }}>删除项目并重新读取</button></section>
      <pre aria-live="polite">{output}</pre>
    </main>
  );
}
