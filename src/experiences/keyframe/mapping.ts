// src/experiences/keyframe/mapping.ts
//
// Turns a scene's MappingSpec into the TimeMapping the timeline uses.

import { knotMapping, linearMapping, type SliderKnot } from "../../core/mappings";
import type { TimeMapping } from "../../core/types";
import { SPAN_FORMATS, TIME_FORMATS } from "./timeFormats";
import type { SceneDef } from "./types";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Knots joined by straight lines: each segment maps its slice of the slider linearly onto its span of time. */
function linearKnotMapping(knots: SliderKnot[], format: (t: number) => string): TimeMapping {
  const last = knots.length - 1;
  const segment = (inside: (next: SliderKnot) => boolean) => {
    let i = 0;
    while (i < last - 1 && !inside(knots[i + 1])) i++;
    return [knots[i], knots[i + 1]] as const;
  };
  return {
    toTime(u) {
      const uc = clamp01(u);
      const [a, b] = segment((next) => uc <= next.u);
      return a.time + ((uc - a.u) / (b.u - a.u)) * (b.time - a.time);
    },
    toParam(time) {
      const t = Math.min(Math.max(time, knots[0].time), knots[last].time);
      const [a, b] = segment((next) => t <= next.time);
      return a.u + ((t - a.time) / (b.time - a.time)) * (b.u - a.u);
    },
    ticks: () => knots.map((k) => ({ u: k.u, label: k.label })),
    format,
  };
}

export function mappingFor(def: SceneDef): TimeMapping {
  const format = TIME_FORMATS[def.timeFormat];
  const formatSpan = SPAN_FORMATS[def.timeFormat];
  const m = def.mapping;
  const mapping =
    m.kind === "linear"
      ? linearMapping(def.minTime, def.maxTime, format, m.ticks)
      : m.interpolate === "linear"
        ? linearKnotMapping(m.knots, format)
        : knotMapping(m.knots, format);
  return formatSpan ? { ...mapping, formatSpan } : mapping;
}
