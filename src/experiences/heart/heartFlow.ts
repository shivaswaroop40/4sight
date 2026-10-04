// src/experiences/heart/heartFlow.ts
//
// Blood as numbered parcels. Parcel i carries the label q = (i + 0.5) * DQ
// mL: the volume of blood that entered the side before it. Along each side
// the cumulative flow through every boundary is known in closed form
// (heartCycle), so the region a parcel is in at time t, and how far along
// it, follow without stepping a simulation:
//
//   region k holds the labels between G[k+1](t) and G[k](t)
//
// When a valve is shut no labels cross it, so the parcels on either side
// wait; when it opens they move as fast as the blood does.

import { BEAT_MS, STROKE_ML, chamberVolume, clampBeat, flowThrough, type Side } from "./heartCycle";
import { FLOW_REGIONS, POOLS, deform, deformParams, poolShrink, shrinkPoint, type FlowPath, type Vec3 } from "./heartLayout";

/** A whole number of parcels per beat, so labels shift by whole parcels each beat and t = 800 matches t = 0. */
export const PARCELS_PER_BEAT = 26;
const DQ = STROKE_ML / PARCELS_PER_BEAT;
/** Blood shown along the veins and arteries, in mL. Display amounts, not anatomy. */
const VEIN_ML = 18;
const ARTERY_ML = 36;

const ATRIUM: Record<Side, "rightAtrium" | "leftAtrium"> = { right: "rightAtrium", left: "leftAtrium" };
const VENTRICLE: Record<Side, "rightVentricle" | "leftVentricle"> = { right: "rightVentricle", left: "leftVentricle" };

/** G[0..4] for one side: label limits at the vein inlet, AV valve... artery outlet. */
export function labelBounds(side: Side, t: number): [number, number, number, number, number] {
  const a0 = chamberVolume(ATRIUM[side], 0);
  const v0 = chamberVolume(VENTRICLE[side], 0);
  const g3 = flowThrough("semilunar", t) + ARTERY_ML;
  const g2 = flowThrough("avValve", t) + ARTERY_ML + v0;
  const g1 = flowThrough("veinIn", t) + ARTERY_ML + v0 + a0;
  return [g1 + VEIN_ML, g1, g2, g3, flowThrough("arteryOut", t)];
}

export const PARCELS_PER_SIDE = Math.ceil(labelBounds("right", BEAT_MS)[0] / DQ) + 1;

/** 0 vein, 1 atrium, 2 ventricle, 3 artery. */
export type RegionIndex = 0 | 1 | 2 | 3;

export interface Parcel {
  side: Side;
  index: number;
  region: RegionIndex;
  /** 0 at the region's entry, 1 at its exit. */
  s: number;
  position: [number, number, number];
  /** Heading in the xy plane, radians. */
  angle: number;
  /** 0..1, fades in at the vein inlet and out at the artery outlet. */
  scale: number;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface SampledPath {
  points: number[];
  widths: number[];
  cum: number[];
}

/** Catmull-Rom through the control points, resampled so s is proportional to arc length. */
function sample(path: FlowPath): SampledPath {
  const pts = path.points;
  const per = 16;
  const points: number[] = [];
  const widths: number[] = [];
  const at = (i: number): Vec3 => pts[Math.min(pts.length - 1, Math.max(0, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let j = 0; j < per; j++) {
      const u = j / per;
      const u2 = u * u;
      const u3 = u2 * u;
      for (let c = 0; c < 3; c++) {
        points.push(
          0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3),
        );
      }
      widths.push(path.width[i] + (path.width[i + 1] - path.width[i]) * u);
    }
  }
  const last = pts[pts.length - 1];
  points.push(last[0], last[1], last[2]);
  widths.push(path.width[path.width.length - 1]);
  const cum = [0];
  for (let k = 1; k < widths.length; k++) {
    const dx = points[3 * k] - points[3 * k - 3];
    const dy = points[3 * k + 1] - points[3 * k - 2];
    const dz = points[3 * k + 2] - points[3 * k - 1];
    cum.push(cum[k - 1] + Math.hypot(dx, dy, dz));
  }
  return { points, widths, cum };
}

const SAMPLED: Record<Side, SampledPath[][]> = {
  right: FLOW_REGIONS.right.map((r) => r.variants.map(sample)),
  left: FLOW_REGIONS.left.map((r) => r.variants.map(sample)),
};

/** Point, unit tangent (xy), and half-width at fraction s of a sampled path. */
function evaluate(path: SampledPath, s: number): { p: [number, number, number]; tx: number; ty: number; width: number } {
  const total = path.cum[path.cum.length - 1];
  const target = Math.min(1, Math.max(0, s)) * total;
  let k = 1;
  while (k < path.cum.length - 1 && path.cum[k] < target) k++;
  const seg = path.cum[k] - path.cum[k - 1] || 1;
  const f = (target - path.cum[k - 1]) / seg;
  const a = 3 * (k - 1);
  const b = 3 * k;
  const p: [number, number, number] = [
    path.points[a] + (path.points[b] - path.points[a]) * f,
    path.points[a + 1] + (path.points[b + 1] - path.points[a + 1]) * f,
    path.points[a + 2] + (path.points[b + 2] - path.points[a + 2]) * f,
  ];
  const dx = path.points[b] - path.points[a];
  const dy = path.points[b + 1] - path.points[a + 1];
  const len = Math.hypot(dx, dy) || 1;
  const width = path.widths[k - 1] + (path.widths[k] - path.widths[k - 1]) * f;
  return { p, tx: dx / len, ty: dy / len, width };
}

/** Where every visible parcel is at time t, deformed with the beating heart. */
export function parcelsAt(time: number): Parcel[] {
  const t = clampBeat(time);
  const params = deformParams(t);
  const out: Parcel[] = [];
  for (const side of ["right", "left"] as const) {
    const g = labelBounds(side, t);
    const regions = FLOW_REGIONS[side];
    for (let i = 0; i < PARCELS_PER_SIDE; i++) {
      const q = (i + 0.5) * DQ;
      if (q > g[0] || q <= g[4]) continue;
      let k = 0;
      while (k < 3 && q <= g[k + 1]) k++;
      const s = (g[k] - q) / (g[k] - g[k + 1]);
      const seed = (i % PARCELS_PER_BEAT) + (side === "left" ? 1000 : 0);
      const variants = SAMPLED[side][k];
      const path = variants[Math.floor(hash(seed) * variants.length) % variants.length];
      const e = evaluate(path, s);
      // Three lanes with a little jitter read as streams rather than noise.
      const lane = (((i % PARCELS_PER_BEAT) % 3) - 1) * 0.62 + (hash(seed + 77) - 0.5) * 0.25;
      const lateral = lane * e.width;
      let x = e.p[0] - e.ty * lateral;
      let y = e.p[1] + e.tx * lateral;
      const pool = regions[k].pool;
      if (pool) [x, y] = shrinkPoint(x, y, POOLS[pool], poolShrink(POOLS[pool].band, t));
      const position = deform(x, y, e.p[2], params);
      const ahead = deform(x + e.tx * 0.05, y + e.ty * 0.05, e.p[2], params);
      // Parcels hand over from a vessel to a cavity where the vessel dives
      // behind the cut face, so they fade out of one and into the other.
      const fadeIn = k === 0 ? Math.min(1, s / 0.15) : k === 1 ? Math.min(1, s / 0.12) : 1;
      const fadeOut = k === 0 ? Math.min(1, (1 - s) / 0.25) : k === 3 ? Math.min(1, (1 - s) / 0.2) : 1;
      out.push({
        side,
        index: i,
        region: k as RegionIndex,
        s,
        position,
        angle: Math.atan2(ahead[1] - position[1], ahead[0] - position[0]),
        scale: Math.min(fadeIn, fadeOut),
      });
    }
  }
  return out;
}
