import type { DirectionCandidate } from "./contracts.js";
import { DIRECTION_AXES } from "./contracts.js";

export class DirectionDifferenceError extends Error {
  constructor(readonly code: "COUNT" | "DUPLICATE_HERO" | "DUPLICATE_CONCEPT" | "DUPLICATE_NARRATIVE" | "INSUFFICIENT_AXIS_DIFFERENCE" | "KEYWORD_OVERLAP", message: string) {
    super(message);
    this.name = "DirectionDifferenceError";
  }
}

export function keywordOverlap(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left.map((value) => value.trim().toLowerCase()).filter(Boolean));
  const b = new Set(right.map((value) => value.trim().toLowerCase()).filter(Boolean));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return [...a].filter((value) => b.has(value)).length / union.size;
}

export function axisDifferenceCount(left: DirectionCandidate, right: DirectionCandidate): number {
  return DIRECTION_AXES.filter((axis) => left.axisValues[axis].trim().toLowerCase() !== right.axisValues[axis].trim().toLowerCase()).length;
}

export function validateDirectionDifference(directions: readonly DirectionCandidate[]): readonly DirectionCandidate[] {
  if (directions.length !== 3) throw new DirectionDifferenceError("COUNT", "Creative direction output must contain exactly three candidates.");
  if (new Set(directions.map((item) => item.heroAssetId)).size !== 3) throw new DirectionDifferenceError("DUPLICATE_HERO", "Each direction must use a unique hero asset.");
  if (new Set(directions.map((item) => item.concept.trim().toLowerCase())).size !== 3) throw new DirectionDifferenceError("DUPLICATE_CONCEPT", "Direction concepts must be unique.");
  if (new Set(directions.map((item) => item.narrative.trim().toLowerCase())).size !== 3) throw new DirectionDifferenceError("DUPLICATE_NARRATIVE", "Direction narratives must be unique.");
  for (let left = 0; left < directions.length; left += 1) {
    for (let right = left + 1; right < directions.length; right += 1) {
      const a = directions[left]!; const b = directions[right]!;
      if (axisDifferenceCount(a, b) < 3) throw new DirectionDifferenceError("INSUFFICIENT_AXIS_DIFFERENCE", "Every direction pair must differ on at least three visual axes.");
      if (keywordOverlap(a.keywords, b.keywords) > 0.5) throw new DirectionDifferenceError("KEYWORD_OVERLAP", "Direction keyword overlap exceeds the accepted threshold.");
    }
  }
  return directions;
}
