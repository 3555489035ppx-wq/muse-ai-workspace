import type { ProjectOutputType, ProjectType } from "../../domain/project/index.js";
import type { EntityId, ProjectId } from "../../domain/shared/id.js";

export interface TemplateResearchStrategy {
  readonly focus: readonly string[];
  readonly sourceMix: readonly ("文化档案" | "用户语境" | "竞品观察" | "视觉趋势")[];
}

export interface TemplateMoodboardStrategy {
  readonly territoryHints: readonly string[];
  readonly assetBias: "文化材料" | "品牌触点" | "编辑图像" | "产品场景";
}

export interface TemplateDirectionStrategy {
  readonly emphasis: readonly ("文化转译" | "识别系统" | "传播叙事" | "材料体验" | "数字体验" | "产品形态" | "结构与交互" | "CMF 策略" | "设计决策链")[];
}

export interface ProjectTemplateDefinition {
  readonly id: EntityId;
  readonly name: string;
  readonly projectType: ProjectType;
  readonly recommendedOutputs: readonly ProjectOutputType[];
  readonly briefPlaceholder: string;
  readonly researchStrategy: TemplateResearchStrategy;
  readonly moodboardStrategy: TemplateMoodboardStrategy;
  readonly directionStrategy: TemplateDirectionStrategy;
}

export interface InstantiateProjectInput {
  readonly name: string;
  readonly description?: string;
  readonly projectType?: ProjectType;
  readonly targetOutputs?: readonly ProjectOutputType[];
  readonly templateId?: EntityId;
  readonly audience?: string;
  readonly context?: string;
  readonly deliverables?: readonly string[];
  readonly constraints?: readonly string[];
  readonly references?: readonly string[];
  readonly keywords?: readonly string[];
  readonly avoid?: readonly string[];
}

export interface TemplateInstantiationResult {
  readonly projectId: ProjectId;
  readonly briefId: EntityId;
  readonly workflowState: "DRAFT";
  readonly templateId?: EntityId;
  readonly provenanceId?: EntityId;
}

export interface TemplateInstantiationProvenance {
  readonly templateId: EntityId;
  readonly templateName: string;
  readonly researchStrategy: TemplateResearchStrategy;
  readonly moodboardStrategy: TemplateMoodboardStrategy;
  readonly directionStrategy: TemplateDirectionStrategy;
}
