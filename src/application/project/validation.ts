import { DomainError } from "../../domain/errors/index.js";
import { PROJECT_OUTPUT_TYPES, PROJECT_TYPES, type ProjectOutputType, type ProjectType } from "../../domain/project/index.js";
import { asEntityId, isEntityId, type EntityId } from "../../domain/shared/id.js";
import type { CreateProjectCommand } from "./contracts.js";

const ALLOWED_FIELDS = new Set(["name", "description", "projectType", "targetOutputs", "templateId", "audience", "context", "deliverables", "constraints", "references", "keywords", "avoid"]);

export class ProjectCreationValidationError extends DomainError {
  constructor(field: string, reason: string) {
    super("PROJECT_CREATION_VALIDATION_FAILED", `项目创建字段 ${field} 无效：${reason}`, { field, reason });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new ProjectCreationValidationError(field, "必须是非空文本");
  return value.trim();
}

function requireUniqueStrings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new ProjectCreationValidationError(field, "必须是非空数组");
  const normalized = value.map((item) => requireString(item, field));
  if (new Set(normalized).size !== normalized.length) throw new ProjectCreationValidationError(field, "不能包含重复项");
  return normalized;
}

function requireProjectType(value: unknown): ProjectType {
  if (typeof value !== "string" || !PROJECT_TYPES.includes(value as ProjectType)) throw new ProjectCreationValidationError("projectType", "不支持的项目类型");
  return value as ProjectType;
}

function requireOutputs(value: unknown): readonly ProjectOutputType[] {
  const outputs = requireUniqueStrings(value, "targetOutputs");
  if (!outputs.every((output) => PROJECT_OUTPUT_TYPES.includes(output as ProjectOutputType))) throw new ProjectCreationValidationError("targetOutputs", "包含不支持的交付类型");
  return outputs as readonly ProjectOutputType[];
}

function optionalStrings(value: unknown, field: string): readonly string[] | undefined {
  return value === undefined ? undefined : requireUniqueStrings(value, field);
}

function optionalTemplateId(value: unknown): EntityId | undefined {
  if (value === undefined) return undefined;
  if (!isEntityId(value)) throw new ProjectCreationValidationError("templateId", "必须是 UUID");
  return asEntityId(value);
}

export function validateCreateProjectInput(value: unknown): CreateProjectCommand {
  if (!isRecord(value)) throw new ProjectCreationValidationError("input", "必须是对象");
  const unknownField = Object.keys(value).find((field) => !ALLOWED_FIELDS.has(field));
  if (unknownField !== undefined) throw new ProjectCreationValidationError(unknownField, "未知字段不被接受");

  const templateId = optionalTemplateId(value.templateId);
  const audience = value.audience === undefined ? undefined : requireString(value.audience, "audience");
  const context = value.context === undefined ? undefined : requireString(value.context, "context");
  const deliverables = optionalStrings(value.deliverables, "deliverables");
  const constraints = optionalStrings(value.constraints, "constraints");
  const references = optionalStrings(value.references, "references");
  const keywords = optionalStrings(value.keywords, "keywords");
  const avoid = optionalStrings(value.avoid, "avoid");
  return {
    name: requireString(value.name, "name"),
    description: requireString(value.description, "description"),
    projectType: requireProjectType(value.projectType),
    targetOutputs: requireOutputs(value.targetOutputs),
    ...(templateId === undefined ? {} : { templateId }),
    ...(audience === undefined ? {} : { audience }),
    ...(context === undefined ? {} : { context }),
    ...(deliverables === undefined ? {} : { deliverables }),
    ...(constraints === undefined ? {} : { constraints }),
    ...(references === undefined ? {} : { references }),
    ...(keywords === undefined ? {} : { keywords }),
    ...(avoid === undefined ? {} : { avoid }),
  };
}
