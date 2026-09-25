// src/core/interpolate.ts
//
// Pure math helpers. Every experience uses these instead of writing its own.

export function lerp(a: number, b: number, s: number): number {
  return a + (b - a) * s;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(s: number): number {
  const t = Math.min(1, Math.max(0, s));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 0 before start, 1 after end, eased in between. The building block for staged assembly. */
export function window(t: number, start: number, end: number): number {
  if (end <= start) {
    return t >= start ? 1 : 0;
  }
  const s = (t - start) / (end - start);
  return Math.min(1, Math.max(0, s));
}
