// src/experiences/tree/treePose.ts
//
// Where every piece of the skeleton is at time t, as plain numbers. The
// experience copies these into instance matrices; tests read them directly.
// The storm limb stops growing when it falls, and juvenile branches are
// shed a few years after they die in the shade.

import { smoothstep } from "../../core/interpolate";
import { STORY } from "./treeModel";
import { axisLength, axisRadius, pointAlong, type Axis, type ClumpSite, type Segment, type Skeleton, type Vec3 } from "./treeSkeleton";

/**
 * Wood is drawn this much thicker than the model's true radius. A real oak
 * trunk is about 1/18 of the tree's height; picture-book oaks are stouter.
 * Hover text and tests use the true radius.
 */
export const DRAWN_THICKNESS = 1.35;

/** Time an axis has grown to: lost wood stops at the storm. */
export function growthTime(axis: Axis, t: number): number {
  return axis.lost ? Math.min(t, STORY.storm) : t;
}

/** 1 while a branch stands, 0 once a dead juvenile branch has dropped off. */
export function standing(axis: Axis, t: number): number {
  if (axis.death === undefined) return 1;
  return 1 - smoothstep(axis.death + 3, axis.death + 4.5, t);
}

/** 1 while a branch carries leaves. */
export function leafy(axis: Axis, t: number): number {
  if (axis.death !== undefined && t > axis.death) return 1 - smoothstep(axis.death, axis.death + 0.6, t);
  if (axis.lost) return 1 - smoothstep(STORY.stormLanded, STORY.stormLanded + 0.5, t);
  return 1;
}

export interface SegmentPose {
  /** Shown length; 0 hides the segment. */
  length: number;
  rBottom: number;
  rTop: number;
}

export function segmentPose(skel: Skeleton, seg: Segment, t: number): SegmentPose {
  const axis = skel.axes[seg.axis];
  const isStub = axis.id === skel.stormLimb && seg.s0 === 0;
  const g = isStub ? Math.min(t, STORY.storm) : growthTime(axis, t);
  const keep = standing(axis, t) * fallenDecay(axis, t);
  const length = Math.max(0, Math.min(seg.length, axisLength(axis, g) - seg.s0)) * (keep > 0 ? 1 : 0);
  if (length <= 0) return { length: 0, rBottom: 0, rTop: 0 };
  const rBottom = axisRadius(axis, seg.passStart, g) * keep * DRAWN_THICKNESS;
  const rTop = (length >= seg.length ? axisRadius(axis, seg.passEnd, g) : axisRadius(axis, Infinity, g)) * keep * DRAWN_THICKNESS;
  return { length, rBottom: Math.max(rBottom, 0.0008), rTop: Math.max(rTop, 0.0006) };
}

/**
 * Wood of the fallen limb rots on the ground: twigs first, then side
 * branches. The main limb stays as a log, which is good news for beetles.
 */
export function fallenDecay(axis: Axis, t: number): number {
  if (!axis.lost || t < STORY.stormLanded) return 1;
  const years = t - STORY.stormLanded;
  if (axis.kind === "twig") return 1 - smoothstep(2, 5, years);
  if (axis.depth >= 2) return 1 - smoothstep(8, 16, years);
  return 1 - 0.25 * smoothstep(10, 60, years);
}

/** Clump centre and radius before seasons are applied. */
export function clumpPose(skel: Skeleton, site: ClumpSite, t: number): { position: Vec3; radius: number } {
  const axis = skel.axes[site.axis];
  const len = axisLength(axis, growthTime(axis, t));
  // Big limbs carry their leaves on side branches, so their own tip clump stays modest while young.
  const reach = axis.kind === "trunk" ? 0.14 : axis.juvenile ? 0.45 : axis.depth === 1 ? 0.28 : axis.kind === "twig" ? 0.6 : 0.45;
  const radius = Math.min(site.maxRadius, reach * len) * standing(axis, t);
  const p = pointAlong(axis, site.frac * len);
  return {
    position: [p[0] + site.offset[0] * radius, p[1] + site.offset[1] * radius, p[2] + site.offset[2] * radius],
    radius,
  };
}

/** Top of the crown as drawn, with every clump in full leaf. */
export function drawnHeight(skel: Skeleton, t: number): number {
  let top = 0;
  for (const site of skel.clumps) {
    const axis = skel.axes[site.axis];
    if (axis.lost && t > STORY.storm) continue;
    const { position, radius } = clumpPose(skel, site, t);
    if (radius > 0) top = Math.max(top, position[1] + radius);
  }
  return top;
}

/** Widest reach of the crown from the trunk, as drawn. */
export function drawnSpread(skel: Skeleton, t: number): number {
  let r = 0;
  for (const site of skel.clumps) {
    const { position, radius } = clumpPose(skel, site, t);
    if (radius > 0) r = Math.max(r, Math.hypot(position[0], position[2]) + radius);
  }
  return r;
}
