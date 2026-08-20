import { asProjectId } from "../../domain/shared/id.js";
import { PromptCompilerError, type PromptCompilerInput, type StructuredPromptSpec } from "./contracts.js";

const unique = <T,>(items: readonly T[]): readonly T[] => [...new Set(items)];

export class PromptCompiler {
  compile(input: PromptCompilerInput): StructuredPromptSpec {
    const { project, brief, research, moodboard, visualDNA, direction, exploration, variant } = input;
    if (!project || !brief || !research || !moodboard || !visualDNA || !direction || !exploration || !variant) throw new PromptCompilerError("MISSING_UPSTREAM", "Prompt compilation requires the complete Project → Variant chain.");
    const projectId = asProjectId(project.id);
    if ([brief, research, moodboard, visualDNA, direction, exploration, variant].some((item) => item.projectId !== projectId)) throw new PromptCompilerError("PROJECT_SCOPE", "Prompt compilation cannot cross project boundaries.");
    if (moodboard.researchSessionId !== research.id || visualDNA.moodboardId !== moodboard.id || direction.researchSessionId !== research.id || direction.moodboardId !== moodboard.id || direction.visualDNAId !== visualDNA.id || exploration.directionId !== direction.id || exploration.visualDNAId !== visualDNA.id || variant.explorationId !== exploration.id || variant.directionId !== direction.id) throw new PromptCompilerError("LINEAGE_MISMATCH", "Prompt upstream lineage is inconsistent.");
    const principles = Object.fromEntries(direction.visualDNA.principles.map((item) => { const split = item.indexOf(":"); return split < 0 ? [item, item] : [item.slice(0, split), item.slice(split + 1)]; }));
    const insightIds = (input.insights ?? []).map((item) => item.id);
    const fields = {
      objective: [brief.goal, direction.concept],
      composition: unique([principles.composition ?? "", ...visualDNA.composition]).filter(Boolean),
      color: visualDNA.colorPalette.map((item) => `${item.role}:${item.hex}`),
      material: unique([principles.material ?? "", ...(visualDNA.materials ?? [])]).filter(Boolean),
      camera: unique([principles.photography ?? "", ...variant.label.split(" · ").slice(0, 1)]).filter(Boolean),
      lighting: unique([principles.lighting ?? "自然定向光"]).filter(Boolean),
      typography: unique([principles.typography ?? "", ...(visualDNA.typography ?? [])]).filter(Boolean),
      imagery: unique([principles.image ?? "", ...visualDNA.imagery, ...direction.visualDNA.keywords]).filter(Boolean),
      constraints: unique([...(brief.constraints ?? []), ...(input.constraints ?? []), ...direction.risks]),
    };
    const sourceRefs = {
      objective: [brief.id, direction.id, ...insightIds], composition: [direction.id, visualDNA.id, variant.id], color: [visualDNA.id, variant.id],
      material: [visualDNA.id, direction.id, variant.id], camera: [direction.id, variant.id], lighting: [visualDNA.id, variant.id],
      typography: [direction.id, visualDNA.id, variant.id], imagery: [direction.id, visualDNA.id, moodboard.id, variant.id], constraints: [brief.id, direction.id],
    };
    return { projectId, explorationId: exploration.id, directionId: direction.id, visualDNAId: visualDNA.id, researchSessionId: research.id, fields, sourceRefs };
  }
}
