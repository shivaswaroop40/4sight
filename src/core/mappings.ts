// src/core/mappings.ts
//
// TimeMapping factories. Every experience uses one of these to convert
// between the timeline parameter u in [0, 1] and its own experience time.

import type { TimeMapping, TimeTick } from "./types";

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** A straight line between min and max. u = 0 -> min, u = 1 -> max. */
export function linearMapping(
  min: number,
  max: number,
  format: (t: number) => string,
  ticks?: TimeTick[],
): TimeMapping {
  const span = max - min;
  return {
    toTime(u: number): number {
      return min + clamp01(u) * span;
    },
    toParam(time: number): number {
      if (span === 0) return 0;
      return clamp01((time - min) / span);
    },
    ticks(): TimeTick[] {
      if (ticks) return ticks;
      return [
        { u: 0, label: format(min) },
        { u: 0.5, label: format(min + span * 0.5) },
        { u: 1, label: format(max) },
      ];
    },
    format,
  };
}

/**
 * Piecewise logarithmic mapping. Knots are evenly spaced on the slider
 * (equal u width per segment). Time is log-interpolated inside each
 * segment, so a segment spanning many orders of magnitude still gets
 * readable slider width.
 *
 * Knot times must be strictly increasing. The first knot may be 0; in that
 * case the segment from knot 0 to knot 1 interpolates linearly at its very
 * start (log(0) is undefined) by treating knot 0 as a tiny positive epsilon
 * internally, without ever reporting a time other than the exact knot value
 * at the knot boundaries.
 *
 * options.logFloor (optional, default 1e-45) is the stand-in for a zero
 * first knot inside log interpolation. The default suits the universe
 * (inflation sits at a visible position). A timeline whose earliest
 * interesting time is, say, 1,000 years should pass logFloor: 1e3 so the
 * first segment is not spent crossing 50 empty orders of magnitude.
 */
export function piecewiseLogMapping(
  knots: { time: number; label: string }[],
  format: (t: number) => string,
  options: { logFloor?: number } = {},
): TimeMapping {
  if (knots.length < 2) {
    throw new Error("piecewiseLogMapping needs at least two knots");
  }
  const n = knots.length - 1;
  const EPS = options.logFloor ?? 1e-45;

  // Log-space value used for interpolation only. Never returned directly.
  const logAt = (time: number): number => Math.log(Math.max(time, EPS));

  function toTime(u: number): number {
    const uc = clamp01(u);
    const scaled = uc * n;
    let seg = Math.floor(scaled);
    if (seg >= n) seg = n - 1;
    if (seg < 0) seg = 0;
    const localU = scaled - seg;

    const a = knots[seg];
    const b = knots[seg + 1];

    if (localU <= 0) return a.time;
    if (localU >= 1) return b.time;

    const logA = logAt(a.time);
    const logB = logAt(b.time);
    const logT = lerpLog(logA, logB, localU);
    return Math.exp(logT);
  }

  function lerpLog(a: number, b: number, s: number): number {
    return a + (b - a) * s;
  }

  function toParam(time: number): number {
    const t = Math.min(Math.max(time, knots[0].time), knots[n].time);

    // Find the segment whose time range contains t.
    let seg = 0;
    for (let i = 0; i < n; i++) {
      if (t >= knots[i].time && t <= knots[i + 1].time) {
        seg = i;
        break;
      }
      seg = i;
    }

    const a = knots[seg];
    const b = knots[seg + 1];

    let localU: number;
    if (a.time === b.time) {
      localU = 0;
    } else {
      const logA = logAt(a.time);
      const logB = logAt(b.time);
      const logT = logAt(t);
      localU = (logT - logA) / (logB - logA);
    }
    localU = clamp01(localU);

    return clamp01((seg + localU) / n);
  }

  function ticks(): TimeTick[] {
    return knots.map((k, i) => ({ u: i / n, label: k.label }));
  }

  return { toTime, toParam, ticks, format };
}
