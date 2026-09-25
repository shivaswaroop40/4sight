// src/experiences/solar-system/solarMapping.ts
//
// Slider mapping for the solar system. Like piecewiseLogMapping, but each
// knot carries its own slider position so the busy accretion era gets more
// width than the quiet last four billion years. Segments that start at time
// 0 interpolate linearly (log(0) is undefined); every other segment is
// log-interpolated.

import type { TimeMapping, TimeTick } from "../../core/types";

export interface SliderKnot {
  u: number;
  time: number;
  label: string;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function knotMapping(knots: SliderKnot[], format: (t: number) => string): TimeMapping {
  const last = knots.length - 1;

  function segmentForU(u: number): number {
    for (let i = 0; i < last; i++) {
      if (u <= knots[i + 1].u) return i;
    }
    return last - 1;
  }

  function segmentForTime(time: number): number {
    for (let i = 0; i < last; i++) {
      if (time <= knots[i + 1].time) return i;
    }
    return last - 1;
  }

  return {
    toTime(u: number): number {
      const uc = clamp01(u);
      const i = segmentForU(uc);
      const a = knots[i];
      const b = knots[i + 1];
      const s = clamp01((uc - a.u) / (b.u - a.u));
      if (s <= 0) return a.time;
      if (s >= 1) return b.time;
      if (a.time <= 0) return a.time + (b.time - a.time) * s;
      return Math.exp(Math.log(a.time) + (Math.log(b.time) - Math.log(a.time)) * s);
    },
    toParam(time: number): number {
      const t = Math.min(Math.max(time, knots[0].time), knots[last].time);
      const i = segmentForTime(t);
      const a = knots[i];
      const b = knots[i + 1];
      const s =
        a.time <= 0
          ? (t - a.time) / (b.time - a.time)
          : (Math.log(Math.max(t, a.time)) - Math.log(a.time)) / (Math.log(b.time) - Math.log(a.time));
      return clamp01(a.u + clamp01(s) * (b.u - a.u));
    },
    ticks(): TimeTick[] {
      return knots.map((k) => ({ u: k.u, label: k.label }));
    },
    format,
  };
}

export function formatYears(t: number): string {
  if (t < 1) return "0 years";
  if (t < 1e3) return `${Math.round(t)} years`;
  if (t < 1e6) return `${(t / 1e3).toFixed(t < 1e4 ? 1 : 0)} thousand years`;
  if (t < 1e9) return `${(t / 1e6).toFixed(t < 1e7 ? 1 : 0)} million years`;
  return `${(t / 1e9).toFixed(2)} billion years`;
}
