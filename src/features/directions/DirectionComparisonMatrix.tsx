import React from "react";
import { COMPARISON_DIMENSIONS, type DirectionComparison } from "../../application/direction/index.js";
import type { Direction } from "../../domain/direction/index.js";

const LABELS = { brief_alignment: "简报一致性", audience_fit: "受众适配", originality: "原创性", identity: "识别度", scalability: "可延展性", cross_media: "跨媒体", complexity: "执行可控性" } as const;
function evidenceLabel(dimension: keyof typeof LABELS): string {
  if (dimension === "complexity") return "依据风险与执行条件";
  if (dimension === "audience_fit") return "依据受众与使用场景";
  return "依据简报与方向原则";
}
export function DirectionComparisonMatrix({ directions, comparison }: { readonly directions: readonly Direction[]; readonly comparison: DirectionComparison }) {
  return <section className="direction-comparison-matrix" aria-label="创意方向比较矩阵"><header><span>比较维度</span>{directions.map((direction) => <strong key={direction.id}>{direction.title}</strong>)}</header>{COMPARISON_DIMENSIONS.map((dimension) => <div key={dimension}><b>{LABELS[dimension]}</b>{directions.map((direction) => { const score = comparison.scores.find((item) => item.directionId === direction.id && item.dimension === dimension); return <span key={direction.id}>{score?.value ?? "—"}<small>{evidenceLabel(dimension)}</small></span>; })}</div>)}</section>;
}
