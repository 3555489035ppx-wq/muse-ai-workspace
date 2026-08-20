const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

export const defaultCritiqueRubric = [
  { id: 'goal', label: '目标一致性', weight: 0.2 },
  { id: 'audience', label: '受众适配度', weight: 0.15 },
  { id: 'visual', label: '视觉一致性', weight: 0.18 },
  { id: 'difference', label: '差异性', weight: 0.17 },
  { id: 'feasibility', label: '可落地性', weight: 0.15 },
  { id: 'clarity', label: '表达清晰度', weight: 0.15 },
];

export function evaluateExploration({ brief, direction, exploration, analysis }) {
  const keywordCount = new Set([...(brief?.keywords ?? []), ...(direction?.keywords ?? []), ...(analysis?.keywords ?? [])]).size;
  const deliverableCount = brief?.deliverables?.length ?? 0;
  const hasEvidence = Boolean(analysis?.assetCount);
  const hasRisks = Boolean(direction?.risk);
  const promptLength = exploration?.prompt?.length ?? 0;
  const values = {
    goal: clamp(58 + deliverableCount * 7 + (brief?.target ? 12 : 0)),
    audience: clamp(58 + (brief?.audience ? 18 : 0) + Math.min(18, keywordCount * 2)),
    visual: clamp(60 + Math.min(20, keywordCount * 3) + (hasEvidence ? 10 : 0)),
    difference: clamp(56 + (direction?.strategyIndex ?? 1) * 8 + Math.min(14, keywordCount * 2)),
    feasibility: clamp(76 - (hasRisks ? 8 : 0) + Math.min(14, deliverableCount * 4)),
    clarity: clamp(55 + Math.min(30, Math.floor(promptLength / 8)) + (direction?.concept ? 8 : 0)),
  };
  const dimensions = defaultCritiqueRubric.map((rubric) => ({
    ...rubric,
    score: values[rubric.id],
    evidence: rubric.id === 'audience'
      ? `基于目标受众“${brief?.audience || '尚未明确'}”与方向关键词的匹配程度。`
      : rubric.id === 'visual'
      ? `基于 ${analysis?.assetCount ?? 0} 个情绪板素材与 ${keywordCount} 个项目关键词。`
      : rubric.id === 'goal'
        ? `基于 ${deliverableCount} 项交付物与已确认项目目标。`
        : rubric.id === 'feasibility'
          ? `方向风险说明：${direction?.risk || '尚未记录明显风险'}。`
          : `基于当前方向说明、生成参数与候选方案元数据。`,
    suggestion: rubric.id === 'difference' && values[rubric.id] < 75
      ? '拉开构图、尺度或媒介策略，避免只做表面风格变化。'
      : rubric.id === 'clarity' && values[rubric.id] < 75
        ? '明确主次层级，并减少同一画面中的竞争信息。'
        : '当前证据支持度良好，下一轮可继续验证跨场景一致性。',
  }));
  const total = clamp(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0));
  return { total, dimensions, summary: total >= 85 ? '方向清晰且证据充分，可以进入精细化迭代。' : total >= 72 ? '方向基本成立，建议先处理差异性与表达层级。' : '当前方案证据不足，建议回到情绪板或方向比较补强依据。' };
}
