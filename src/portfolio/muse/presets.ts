export type MockupPreset = {
  tiltX: number;
  tiltY: number;
  rotate: number;
  scale: number;
  origin: string;
};

export const mockupPresets = {
  hero: { tiltX: 2, tiltY: -7, rotate: -0.6, scale: 1.02, origin: "center center" },
  evidence: { tiltX: 1, tiltY: 5, rotate: 0.4, scale: 1, origin: "center center" },
  direction: { tiltX: 2, tiltY: -5, rotate: -0.3, scale: 1.03, origin: "center center" },
  concept: { tiltX: 1, tiltY: 6, rotate: 0.5, scale: 1, origin: "center center" },
  flat: { tiltX: 0, tiltY: 0, rotate: 0, scale: 1, origin: "center center" },
} satisfies Record<string, MockupPreset>;
