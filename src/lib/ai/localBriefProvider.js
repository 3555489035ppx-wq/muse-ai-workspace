import { now } from '../ids';

const splitItems = (value) => Array.isArray(value)
  ? value.filter(Boolean)
  : String(value ?? '').split(/[、，,\n]/).map((item) => item.trim()).filter(Boolean);

export async function organizeProjectBrief(input, onProgress) {
  for (const message of ['正在梳理项目目标', '正在识别受众与使用场景', '正在整理约束与待确认问题']) {
    onProgress?.(message);
    await new Promise((resolve) => window.setTimeout(resolve, 260));
  }
  const deliverables = splitItems(input.deliverables);
  const constraints = splitItems(input.constraints);
  return {
    target: input.requirement.trim(),
    audience: input.audience.trim(),
    background: input.background?.trim() || '尚未补充项目背景。',
    deliverables,
    constraints,
    keywords: splitItems(input.keywords),
    avoid: splitItems(input.avoid),
    opportunities: [
      `围绕“${input.name.trim()}”建立一套可延展、可验证的视觉方向。`,
      deliverables.length ? `让 ${deliverables.join('、')} 共享一致的视觉判断依据。` : '先明确最优先的交付物，再展开视觉探索。',
    ],
    risks: constraints.length ? constraints.map((item) => `需要在创意方向中持续验证：${item}`) : ['项目约束仍不充分，建议在方向生成前补充时间、预算或媒介限制。'],
    questions: [
      '本项目最希望用户记住的一个核心印象是什么？',
      '哪些现有品牌资产必须保留，哪些可以重新定义？',
    ],
    analyzedAt: now(),
};
}
