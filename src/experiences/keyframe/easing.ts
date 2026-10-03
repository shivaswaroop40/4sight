// src/experiences/keyframe/easing.ts
//
// Named easing curves for keyframe segments. Each maps progress s in [0, 1]
// to eased progress. The sampler handles "step" itself (hold, then jump at
// the key), so its curve here only matters at the segment ends.

export const EASINGS = {
  linear: (s: number) => s,
  step: (s: number) => (s >= 1 ? 1 : 0),
  easeIn: (s: number) => s * s * s,
  easeOut: (s: number) => 1 - Math.pow(1 - s, 3),
  easeInOut: (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2),
  smooth: (s: number) => s * s * (3 - 2 * s),
  /** Overshoots by about 10% and settles: a cartoon pop. */
  backOut: (s: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2);
  },
} as const satisfies Record<string, (s: number) => number>;

export type EasingName = keyof typeof EASINGS;

export function isEasingName(name: string): name is EasingName {
  return Object.hasOwn(EASINGS, name);
}
