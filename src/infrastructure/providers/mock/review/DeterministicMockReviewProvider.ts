import { REVIEW_RUBRIC, type ReviewProvider, type ReviewProviderInput, type ReviewProviderOutput } from "../../../../application/review/ReviewProvider.js";

const labels = { brief_match: "需求匹配", direction: "方向一致", audience: "受众适配", identity: "识别度", composition: "构图", originality: "原创性", cross_media: "跨媒介" } as const;
function score(text: string, index: number) { let hash = index + 17; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 31); return 70 + ((hash >>> 0) % 25); }
export class DeterministicMockReviewProvider implements ReviewProvider {
  readonly id = "muse-deterministic-review"; readonly mock = true;
  async review(input: ReviewProviderInput): Promise<ReviewProviderOutput> {
    await Promise.resolve();
    const basis = `${input.brief.goal}|${input.direction.concept}|${input.promptVersion.promptText}|${input.generatedAsset.seed ?? ""}`;
    const evidenceIds = [input.brief.id, input.direction.id, input.promptVersion.id, input.generatedAsset.id];
    const dimensions = REVIEW_RUBRIC.map((key, index) => ({ key, score: score(basis, index), evidenceIds, evidence: `${labels[key]}证据来自简报、锁定方向、提示词版本与生成资产。`, problem: `${labels[key]}仍存在可被下一轮验证的局部差距。`, reason: `${input.direction.title} 的视觉规则在当前夹具中尚未完全展开。`, impact: `可能影响${labels[key]}的识别与决策可信度。`, recommendation: `下一轮围绕${labels[key]}保留核心概念并做单变量调整。` }));
    return { dimensions, summary: `${input.brief.goal}：当前方案与“${input.direction.title}”方向整体一致，建议按证据逐项迭代。` };
  }
}
