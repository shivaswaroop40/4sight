// src/experiences/tree/treeSkeleton.ts
//
// The oak's branching skeleton, generated once from a seed at its final
// 150-year size. Every axis (trunk, limb, twig, root) is a fixed polyline
// with a birth year and a growth law, so its length and thickness at any t
// are pure functions: the tip walks out along the polyline, and wood at a
// point thickens from the year the tip passed it, as in a real tree (a nail
// in a trunk never rises). Leaf clumps, single leaves and acorns hang off
// sites on those axes.
//
// Azimuths are degrees from +x toward +z. The cutaway notch in the hill
// faces NOTCH_AZIMUTH, toward the default camera.

import { smoothstep } from "../../core/interpolate";
import { STORY, TRUNK_RATE, heightAt, timeAtHeight } from "./treeModel";

export type Vec3 = [number, number, number];

export type AxisKind = "trunk" | "limb" | "twig" | "root";

/** How an axis lengthens. The trunk follows the height model; the rest ease out exponentially. */
export type GrowthLaw = { law: "height"; cap: number } | { law: "exp"; tau: number };

export interface Axis {
  id: number;
  kind: AxisKind;
  depth: number;
  parent: number;
  points: Vec3[];
  /** Cumulative length at each point. */
  cum: number[];
  length: number;
  birth: number;
  growth: GrowthLaw;
  /** Radial growth relative to the trunk. */
  thick: number;
  /** Year the branch dies in the shade of the crown above, if it does. */
  death?: number;
  /** Part of the limb the storm tears off. */
  lost?: boolean;
  /** Short-lived lower branch of the sapling. */
  juvenile?: boolean;
}

export interface Segment {
  axis: number;
  /** Distance from the axis base to this segment's start. */
  s0: number;
  length: number;
  start: Vec3;
  dir: Vec3;
  /** Years the tip passed the segment's start and end. */
  passStart: number;
  passEnd: number;
}

export interface ClumpSite {
  axis: number;
  /** Fraction of the axis's current length. */
  frac: number;
  /** Largest radius the clump reaches. */
  maxRadius: number;
  offset: Vec3;
  tint: number;
}

export interface LeafSite {
  axis: number;
  s: number;
  /** Euler angles for the leaf blade. */
  rotation: Vec3;
  size: number;
}

export interface AcornSite {
  clump: number;
  offset: Vec3;
  /** Acorns appear in order of rank as the crop grows. */
  rank: number;
}

export interface Skeleton {
  axes: Axis[];
  segments: Segment[];
  clumps: ClumpSite[];
  leaves: LeafSite[];
  acorns: AcornSite[];
  /** The limb the storm takes, and where it snaps. */
  stormLimb: number;
  stormBreakS: number;
}

export const NOTCH_AZIMUTH = 45;
export const NOTCH_HALF_ANGLE = 38;
const TRUNK_LENGTH = 13;
/** The buried acorn's centre, where the root leaves it, and where the shoot does. */
export const SEED_CENTER: Vec3 = [0.006, -0.022, 0.006];
const SEED_ROOT: Vec3 = [0.006, -0.036, 0.006];
const SEED_SHOOT: Vec3 = [0.004, -0.012, 0.004];
/** The woodpecker drills here, on the side facing the default camera. */
export const WOODPECKER_HOLE = { s: 7.0, azimuth: 42 } as const;

const DEG = Math.PI / 180;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dirFrom(azimuthDeg: number, elevationDeg: number): Vec3 {
  const a = azimuthDeg * DEG;
  const e = elevationDeg * DEG;
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
}

function azimuthOf(d: Vec3): number {
  return Math.atan2(d[2], d[0]) / DEG;
}

function elevationOf(d: Vec3): number {
  return Math.asin(Math.max(-1, Math.min(1, d[1]))) / DEG;
}

function add(a: Vec3, b: Vec3, s = 1): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

/** Length of an axis at time t. */
export function axisLength(axis: Axis, t: number): number {
  if (t <= axis.birth) return 0;
  if (axis.growth.law === "height") return Math.min(axis.growth.cap, heightAt(t));
  return axis.length * (1 - Math.exp(-(t - axis.birth) / axis.growth.tau));
}

/** Year the tip of an axis reached distance s from its base. */
export function timeAtLength(axis: Axis, s: number): number {
  if (s <= 0) return axis.birth;
  if (axis.growth.law === "height") return timeAtHeight(s);
  const f = s / axis.length;
  if (f >= 1) return Infinity;
  return axis.birth - axis.growth.tau * Math.log(1 - f);
}

/** Radius of an axis at distance s from its base, at time t. */
export function axisRadius(axis: Axis, passTime: number, t: number): number {
  const since = t - passTime;
  if (since <= 0) return 0;
  const min = 0.0026;
  return (min + TRUNK_RATE * axis.thick * since) * smoothstep(0, 0.15, since);
}

/** Point at distance s along an axis polyline. */
export function pointAlong(axis: Axis, s: number): Vec3 {
  const { points, cum } = axis;
  if (s <= 0) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (s <= cum[i]) {
      const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
      const a = points[i - 1];
      const b = points[i];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return points[points.length - 1];
}

interface AxisSpec {
  kind: AxisKind;
  parent: number;
  attachS: number;
  azimuth: number;
  elevation: number;
  length: number;
  growth: GrowthLaw;
  thick: number;
  segments: number;
  /** Degrees of random zigzag per segment. Oak branches are famously crooked. */
  crook: number;
  /** Degrees added to the elevation at each joint: up for reaching limbs, down for heavy ones. */
  bend: number;
  /** Minimum gap after the parent tip passes before the bud breaks. */
  delay?: number;
  death?: number;
  juvenile?: boolean;
}

export function generateSkeleton(seed = 1759): Skeleton {
  const rand = mulberry32(seed);
  const jitter = (amount: number) => (rand() * 2 - 1) * amount;
  const axes: Axis[] = [];

  function addAxis(spec: AxisSpec): number {
    const parent = spec.parent >= 0 ? axes[spec.parent] : null;
    const base: Vec3 = parent ? pointAlong(parent, spec.attachS) : SEED_ROOT;
    const born = parent ? timeAtLength(parent, spec.attachS) + (spec.delay ?? 0.3) : spec.kind === "root" ? STORY.radicle : STORY.shoot;
    const points: Vec3[] = [base];
    const cum = [0];
    let az = spec.azimuth;
    let el = spec.elevation;
    const step = spec.length / spec.segments;
    for (let i = 0; i < spec.segments; i++) {
      const d = dirFrom(az, el);
      points.push(add(points[i], d, step));
      cum.push(step * (i + 1));
      az += jitter(spec.crook);
      el = Math.max(-80, Math.min(88, el + spec.bend + jitter(spec.crook * 0.7)));
    }
    const axis: Axis = {
      id: axes.length,
      kind: spec.kind,
      depth: parent ? parent.depth + 1 : 0,
      parent: spec.parent,
      points,
      cum,
      length: spec.length,
      birth: born,
      growth: spec.growth,
      thick: spec.thick,
      death: spec.death,
      juvenile: spec.juvenile,
    };
    axes.push(axis);
    return axis.id;
  }

  // The trunk: nearly straight while it is a seedling, crooks higher up.
  const trunk = axes.length;
  {
    const pts: Vec3[] = [SEED_SHOOT];
    const cum = [0];
    const stops = [0.6, 2.5, 5, 7.8, 10.4, TRUNK_LENGTH];
    let x = 0;
    let z = 0;
    let prev = 0;
    for (const s of stops) {
      const sway = Math.min(0.35, s * 0.03);
      x = 0.6 * x + jitter(sway);
      z = 0.6 * z + jitter(sway);
      const p: Vec3 = [x, s + SEED_SHOOT[1], z];
      const last = pts[pts.length - 1];
      prev += Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]);
      pts.push(p);
      cum.push(prev);
    }
    axes.push({
      id: trunk,
      kind: "trunk",
      depth: 0,
      parent: -1,
      points: pts,
      cum,
      length: prev,
      birth: STORY.shoot,
      growth: { law: "height", cap: prev },
      thick: 1,
    });
  }

  // Juvenile branches clothe the sapling, then die in the shade as the crown rises.
  const golden = 137.5;
  let az = 30;
  for (let s = 0.16; s < 4.4; s += 0.24 + s * 0.05) {
    az += golden + jitter(18);
    const death = timeAtHeight(s + 6.5) + jitter(2);
    const length = 0.75 + 0.5 * s + jitter(0.15);
    const j = addAxis({
      kind: "limb",
      parent: trunk,
      attachS: s,
      azimuth: az,
      elevation: 22 + jitter(10),
      length,
      growth: { law: "exp", tau: 5 },
      thick: 0.55,
      segments: 2,
      crook: 22,
      bend: 6,
      delay: 0.5,
      death,
      juvenile: true,
    });
    for (const f of [0.45, 0.8]) {
      const side = rand() < 0.5 ? -1 : 1;
      addAxis({
        kind: "twig",
        parent: j,
        attachS: f * length,
        azimuth: az + side * (35 + jitter(15)),
        elevation: 40 + jitter(15),
        length: length * (0.42 + jitter(0.08)),
        growth: { law: "exp", tau: 4 },
        thick: 0.4,
        segments: 2,
        crook: 25,
        bend: 4,
        death,
        juvenile: true,
      });
    }
  }

  // The permanent limbs, placed by hand for a broad open-grown oak dome.
  // Low limbs spread wide and nearly level; high ones reach up. None of the
  // big low limbs points at the default camera, so the trunk and the storm
  // scar stay in view.
  const LIMBS: { s: number; az: number; el: number; L: number; storm?: true }[] = [
    { s: 3.3, az: 195, el: 10, L: 11.8 },
    { s: 3.8, az: 112, el: 14, L: 11.2 },
    { s: 4.4, az: 272, el: 12, L: 11.4 },
    { s: 5.4, az: -16, el: 18, L: 9.8, storm: true },
    { s: 6.4, az: 158, el: 24, L: 9.8 },
    { s: 7.3, az: 232, el: 26, L: 9.6 },
    { s: 8.1, az: 78, el: 28, L: 9.2 },
    { s: 9.0, az: 318, el: 30, L: 9 },
    { s: 10.0, az: 128, el: 36, L: 8.2 },
    { s: 10.9, az: 22, el: 38, L: 7.8 },
    { s: 11.7, az: 250, el: 42, L: 7.2 },
    { s: 12.3, az: 176, el: 48, L: 6.6 },
    { s: 12.8, az: 340, el: 52, L: 6.2 },
  ];
  let stormLimb = -1;
  for (const spec of LIMBS.map((l) => ({ ...l, L: l.L * 0.86 }))) {
    const low = spec.el < 30;
    const limb = addAxis({
      kind: "limb",
      parent: trunk,
      attachS: spec.s,
      azimuth: spec.az + jitter(6),
      elevation: spec.el,
      length: spec.L,
      growth: { law: "exp", tau: 24 },
      thick: 0.78,
      segments: 4,
      crook: 16,
      bend: low ? 5 : 2.5,
      delay: 0.6,
    });
    if (spec.storm) stormLimb = limb;
    const limbAxis = axes[limb];
    const fracs = [0.32, 0.5, 0.66, 0.82, 0.95];
    fracs.forEach((f, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const tip = pointAlong(limbAxis, f * spec.L);
      const prev = pointAlong(limbAxis, Math.max(0, f * spec.L - 0.5));
      const d: Vec3 = [tip[0] - prev[0], tip[1] - prev[1], tip[2] - prev[2]];
      const len = spec.L * (0.42 - 0.12 * f) + jitter(0.4);
      const secondary = addAxis({
        kind: "limb",
        parent: limb,
        attachS: f * spec.L,
        azimuth: azimuthOf(d) + side * (38 + jitter(14)),
        elevation: Math.min(65, elevationOf(d) + 6 + jitter(10)),
        length: len,
        growth: { law: "exp", tau: 11 },
        thick: 0.45,
        segments: 3,
        crook: 22,
        bend: 3,
        delay: 1,
      });
      for (const g of [0.5, 0.9]) {
        addAxis({
          kind: "twig",
          parent: secondary,
          attachS: g * len,
          azimuth: azimuthOf(d) + side * (10 + jitter(40)),
          elevation: 35 + jitter(20),
          length: len * (0.48 + jitter(0.1)),
          growth: { law: "exp", tau: 5 },
          thick: 0.3,
          segments: 2,
          crook: 28,
          bend: 2,
          delay: 0.8,
        });
      }
    });
  }

  // Roots. The radicle becomes a taproot; laterals take over and spread far
  // past the crown; sinkers drop from them. Several laterals run into the
  // cutaway notch so they can be seen.
  const taproot = addAxis({
    kind: "root",
    parent: -1,
    attachS: 0,
    azimuth: NOTCH_AZIMUTH,
    elevation: -84,
    length: 2.6,
    growth: { law: "exp", tau: 5 },
    thick: 0.5,
    segments: 4,
    crook: 18,
    bend: 0,
  });
  const lateralAz = [NOTCH_AZIMUTH - 22, NOTCH_AZIMUTH + 6, NOTCH_AZIMUTH + 28, 120, 170, 215, 260, 300, 345];
  lateralAz.forEach((a, i) => {
    const len = 7 + rand() * 4;
    const lateral = addAxis({
      kind: "root",
      parent: taproot,
      attachS: 0.05 + 0.04 * i,
      azimuth: a + jitter(5),
      elevation: -14 + jitter(4),
      length: len,
      growth: { law: "exp", tau: 38 },
      thick: 0.5,
      segments: 4,
      crook: 22,
      bend: 2.5,
      delay: 0.9 + i * 0.35,
    });
    for (const f of [0.25, 0.5, 0.75]) {
      addAxis({
        kind: "root",
        parent: lateral,
        attachS: f * len,
        azimuth: a + jitter(30),
        elevation: -62 + jitter(15),
        length: 1.2 + rand() * 1.1,
        growth: { law: "exp", tau: 18 },
        thick: 0.32,
        segments: 2,
        crook: 25,
        bend: 0,
        delay: 3,
      });
      const side = rand() < 0.5 ? -1 : 1;
      addAxis({
        kind: "root",
        parent: lateral,
        attachS: f * len + 0.3,
        azimuth: a + side * (40 + jitter(15)),
        elevation: -10 + jitter(6),
        length: 1.6 + rand() * 1.6,
        growth: { law: "exp", tau: 14 },
        thick: 0.25,
        segments: 2,
        crook: 30,
        bend: 0,
        delay: 2,
      });
    }
  });

  // The storm breaks the limb a short way out from the trunk; everything
  // beyond the break goes with it.
  const stormBreakS = 0.9;
  for (const axis of axes) {
    let a: Axis | undefined = axis;
    while (a && a.id !== stormLimb) a = a.parent >= 0 ? axes[a.parent] : undefined;
    if (a) axis.lost = true;
  }

  const segments: Segment[] = [];
  for (const axis of axes) {
    for (let i = 1; i < axis.points.length; i++) {
      const a = axis.points[i - 1];
      const b = axis.points[i];
      const len = axis.cum[i] - axis.cum[i - 1];
      const dir: Vec3 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];
      // The storm limb's first segment is split at the break, so the stub can stay behind.
      if (axis.id === stormLimb && i === 1) {
        segments.push(segment(axis, axis.cum[0], stormBreakS, a, dir));
        segments.push(segment(axis, stormBreakS, len - stormBreakS, add(a, dir, stormBreakS), dir));
        continue;
      }
      segments.push(segment(axis, axis.cum[i - 1], len, a, dir));
    }
  }

  // Leaf clumps sit at branch ends and along the outer half of twigs.
  const clumps: ClumpSite[] = [];
  for (const axis of axes) {
    if (axis.kind === "root") continue;
    const isTip = !axes.some((b) => b.parent === axis.id);
    const sites: [number, number][] =
      axis.kind === "trunk"
        ? [[0.97, 1.4], [0.85, 0.9]]
        : axis.juvenile
          ? axis.kind === "twig"
            ? [[1, 0.5], [0.6, 0.42]]
            : [[1, 0.6], [0.7, 0.5], [0.42, 0.4]]
          : axis.kind === "twig"
            ? [[1, 1.7], [0.55, 1.35]]
            : axis.depth === 1
              ? [[1, 2.1]]
              : isTip
                ? [[1, 1.8]]
                : [[1, 1.8], [0.45, 1.3]];
    for (const [frac, maxRadius] of sites) {
      clumps.push({
        axis: axis.id,
        frac,
        maxRadius: maxRadius * (0.85 + rand() * 0.3),
        offset: [jitter(0.35), 0.15 + rand() * 0.25, jitter(0.35)],
        tint: rand(),
      });
    }
  }

  // Single leaves on the young stems, about every 2.5 cm, in a 2/5 spiral.
  const leaves: LeafSite[] = [];
  for (const axis of axes) {
    if (axis.kind === "root") continue;
    if (!(axis.kind === "trunk" || axis.juvenile)) continue;
    const maxS = axis.kind === "trunk" ? 4.6 : axis.length;
    let k = 0;
    for (let s = 0.035; s < maxS; s += 0.025 + s * 0.012) {
      const turn = (k++ * 0.4 + rand() * 0.05) * Math.PI * 2;
      leaves.push({
        axis: axis.id,
        s,
        rotation: [0.85 + jitter(0.25), turn, jitter(0.5)],
        size: 0.85 + rand() * 0.3,
      });
    }
  }

  // Acorns: a few per clump, on clumps of the permanent crown.
  const acorns: AcornSite[] = [];
  clumps.forEach((c, i) => {
    const axis = axes[c.axis];
    if (axis.juvenile || axis.kind === "trunk") return;
    const n = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2;
      const e = (rand() - 0.5) * Math.PI * 0.6;
      // On the surface of the clump, which is flattened underneath like the blob geometry.
      const y = Math.sin(e) * (e < 0 ? 0.78 : 1);
      acorns.push({ clump: i, offset: [Math.cos(a) * Math.cos(e) * 1.04, y * 1.04, Math.sin(a) * Math.cos(e) * 1.04], rank: rand() });
    }
  });
  acorns.sort((a, b) => a.rank - b.rank);

  return { axes, segments, clumps, leaves, acorns, stormLimb, stormBreakS };
}

function segment(axis: Axis, s0: number, length: number, start: Vec3, dir: Vec3): Segment {
  return {
    axis: axis.id,
    s0,
    length,
    start,
    dir,
    passStart: timeAtLength(axis, s0),
    passEnd: timeAtLength(axis, s0 + length),
  };
}

/** The one oak every view of this experience shares. Deterministic, so a module constant is safe. */
export const SKELETON = generateSkeleton();
