// src/core/warp.ts
//
// Time warp semantics, in one place.
//
// A warp preset w is a multiplier on the experience's 1x playback rate:
//
//   du/dt_real = direction * w / baseDurationSeconds
//
// so a full pass takes baseDurationSeconds / w real seconds, and at every
// point on the timeline experience time advances w times faster than at 1x
// there. On a linear mapping the effective rate is constant. On a piecewise
// log mapping it grows with t (for example about 4 kyr/s near the protosun
// and about 300 Myr/s near today at 1x), which is exactly the point: the
// readout shows the temporal scale the user is moving through.
//
// A preset that would finish the whole pass in under MIN_PASS_SECONDS is
// instant, not a warp. usableWarpPresets drops such presets (and warns in
// dev) so every offered preset is visibly different. Pick presets per
// experience so the slowest is a contemplative pass and the fastest still
// takes a couple of seconds, e.g. base 40 s with [0.25, 0.5, 1, 2, 5, 10, 20].

import type { FourDExperience, TimeMapping } from "./types";

/** The fastest usable preset still takes this many real seconds per full pass. */
export const MIN_PASS_SECONDS = 1;

/** Real seconds for one full pass at warp w. */
export function passSeconds(baseDurationSeconds: number, warp: number): number {
  return baseDurationSeconds / warp;
}

const warned = new Set<string>();

/** The experience's presets, sorted, deduplicated, with instant presets removed. */
export function usableWarpPresets(experience: Pick<FourDExperience, "id" | "warpPresets" | "baseDurationSeconds">): number[] {
  const sorted = [...new Set(experience.warpPresets)]
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => a - b);
  const usable = sorted.filter((w) => passSeconds(experience.baseDurationSeconds, w) >= MIN_PASS_SECONDS);
  const dropped = sorted.filter((w) => !usable.includes(w));
  if (dropped.length > 0 && import.meta.env?.DEV && !warned.has(experience.id)) {
    warned.add(experience.id);
    console.warn(
      `[4sight] ${experience.id}: warp ${dropped.map((w) => `${w}x`).join(", ")} would finish a ` +
        `${experience.baseDurationSeconds} s pass in under ${MIN_PASS_SECONDS} s and is hidden. ` +
        `Lower the preset or raise baseDurationSeconds.`,
    );
  }
  if (usable.length > 0) return usable;
  return sorted.length > 0 ? [sorted[0]] : [1];
}

/** The warp selected when an experience is attached: 1x if offered, else the preset nearest 1x. */
export function defaultWarp(experience: Pick<FourDExperience, "id" | "warpPresets" | "baseDurationSeconds">): number {
  const presets = usableWarpPresets(experience);
  let best = presets[0];
  for (const w of presets) {
    if (Math.abs(Math.log(w)) < Math.abs(Math.log(best))) best = w;
  }
  return best;
}

/**
 * Local derivative dT/du of a mapping at u, looking in the playback
 * direction so a knot of a piecewise mapping reports the segment ahead.
 */
export function mappingDerivative(mapping: TimeMapping, u: number, direction: 1 | -1 = 1): number {
  // Both samples sit strictly inside the segment ahead, so a knot with a
  // jump (a zero first knot and its logFloor) does not read as a huge rate.
  const h = 1e-5;
  let a: number;
  let b: number;
  if (direction === 1) {
    a = Math.min(u + h / 2, 1 - h);
    b = a + h;
  } else {
    b = Math.max(u - h / 2, h);
    a = b - h;
  }
  return (mapping.toTime(b) - mapping.toTime(a)) / h;
}

/** Experience time units advanced per real second at u, at warp w. Always non-negative. */
export function effectiveRate(
  mapping: TimeMapping,
  baseDurationSeconds: number,
  u: number,
  warp: number,
  direction: 1 | -1 = 1,
): number {
  return Math.abs(mappingDerivative(mapping, u, direction)) * (warp / baseDurationSeconds);
}

/** "≈ 230 Myr / s" using the experience's own formatter. */
export function formatRate(mapping: TimeMapping, rate: number): string {
  return `≈ ${mapping.format(rate)} / s`;
}

/** "1x", "0.25x", "20x". */
export function formatWarp(warp: number): string {
  const text = warp >= 1 ? String(Number(warp.toPrecision(4))) : String(Number(warp.toPrecision(2)));
  return `${text}×`;
}
