export const CONTENT_ORIGINS = Object.freeze(["real_ai", "demo_seed", "cached_ai", "user"]);

export function isContentOrigin(value) {
  return CONTENT_ORIGINS.includes(value);
}

export function contentOriginOf(value, fallback = "user") {
  return isContentOrigin(value?.contentOrigin) ? value.contentOrigin : fallback;
}

export function originLabel(value) {
  return ({ real_ai: "REAL", demo_seed: "DEMO", cached_ai: "CACHED", user: "USER" })[value] ?? "USER";
}
