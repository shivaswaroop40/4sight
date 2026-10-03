// src/experiences/tree/treeModel.ts
//
// The oak as numbers: when things happen, how tall and thick the tree is,
// and which season the leaves show, all as pure functions of t (years since
// the acorn fell, in October). Units are metres and years. The scene and the
// hover text both read from here, so what you see and what you read agree.

import { smoothstep } from "../../core/interpolate";
import { knotMapping, type SliderKnot } from "../solar-system/solarMapping";

/** Story times in years after the acorn fell. Events and visuals both key off these. */
export const STORY = {
  /** The jay drops the acorn and pushes it into the soil. */
  jayLeaves: 0.06,
  /** Oak acorns germinate in autumn: the root (radicle) comes first. */
  radicle: 0.08,
  /** The shoot breaks the soil in spring, about April. */
  shoot: 0.52,
  sapling: 6,
  crownLift: 25,
  firstAcorns: 40,
  mast: 70,
  /** A gale tears off the big limb. */
  storm: 84.3,
  /** The limb is on the ground. */
  stormLanded: 84.55,
  woodpecker: 101,
  woodpeckerLeaves: 118,
  owl: 124,
  end: 150,
} as const;

export const KNOTS: SliderKnot[] = [
  { u: 0, time: 0, label: "Acorn" },
  { u: 0.07, time: 0.1, label: "" },
  { u: 0.18, time: 1, label: "1 yr" },
  { u: 0.31, time: 6, label: "6 yrs" },
  { u: 0.45, time: 25, label: "25 yrs" },
  { u: 0.6, time: 60, label: "60 yrs" },
  { u: 0.7, time: 84, label: "" },
  { u: 0.8, time: 92, label: "90 yrs" },
  { u: 1, time: STORY.end, label: "150 yrs" },
];

export function formatAge(t: number): string {
  if (t < 1 / 12) {
    const w = Math.max(0, Math.round(t * 52));
    return w === 1 ? "1 week" : `${w} weeks`;
  }
  if (t < 1) {
    const m = Math.floor(t * 12);
    return m === 1 ? "1 month" : `${m} months`;
  }
  if (t < 2) return "1 year";
  return `${Math.floor(t)} years`;
}

export const mapping = knotMapping(KNOTS, formatAge);

// Height ------------------------------------------------------------------

const HEIGHT_MAX = 20.5;
const HEIGHT_K = 50;
const HEIGHT_P = 1.2;
/** The first spring flush: a seedling is about 10 cm tall within weeks. */
const FIRST_FLUSH = 0.1;

/**
 * Height of the tree in metres. An open-grown English oak is about 2.5 m at
 * 10 years, 10 m at 40, 15 m at 80 and 19 m at 150, and tops out at 20 to
 * 40 m.
 */
export function heightAt(t: number): number {
  const a = t - STORY.shoot;
  if (a <= 0) return 0;
  return FIRST_FLUSH * smoothstep(0, 0.12, a) + HEIGHT_MAX * Math.pow(1 - Math.exp(-a / HEIGHT_K), HEIGHT_P);
}

/** The year the tree first reached height h. Infinity if it never does. */
export function timeAtHeight(h: number): number {
  if (h <= 0) return STORY.shoot;
  if (h >= heightAt(1e4)) return Infinity;
  let lo: number = STORY.shoot;
  let hi = 1e4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (heightAt(mid) < h) lo = mid;
    else hi = mid;
  }
  return hi;
}

// Thickness ---------------------------------------------------------------

/**
 * Radial growth of the trunk in metres per year: 4 mm a year, the forester's
 * rule that an open-grown oak adds about 2.5 cm of girth a year.
 */
export const TRUNK_RATE = 0.004;
/** Girth is measured at chest height, 1.3 m above the ground. */
const CHEST_HEIGHT = 1.3;

/** Trunk radius at height s: the wood there has been growing since the tip passed it. */
export function trunkRadiusAt(s: number, t: number): number {
  const since = t - timeAtHeight(s);
  return since > 0 ? 0.0012 + TRUNK_RATE * since : 0;
}

/** Girth at chest height in metres, 0 while the tree is shorter than that. */
export function girthAt(t: number): number {
  return 2 * Math.PI * trunkRadiusAt(CHEST_HEIGHT, t);
}

/**
 * Rings laid down at the base, counting the one forming: it grows from
 * late April to September and is complete each October, when t is whole.
 */
export function ringAge(t: number): number {
  const year = Math.floor(t);
  return year + smoothstep(0.5, 0.95, t - year);
}

/** Complete growth rings at the base: one finishes each autumn. */
export function ringCount(t: number): number {
  return t < 1 ? 0 : Math.floor(t);
}

/**
 * Relative width of the ring laid down in year `year` (1 = average). Hashed
 * weather plus a run of narrow rings after the storm, when the tree spends
 * its energy sealing the wound.
 */
export function ringWidth(year: number): number {
  const weather = 0.75 + 0.5 * hash01(year * 7.31 + 2.1);
  const sinceStorm = year - Math.ceil(STORY.storm);
  const stress = sinceStorm >= 0 && sinceStorm < 8 ? 0.45 + 0.07 * sinceStorm : 1;
  return weather * stress;
}

// Framing -----------------------------------------------------------------

/** How big the interesting part of the scene is at t, in metres. Drives the camera. */
export function frameSize(t: number): number {
  const h = heightAt(t);
  // A soft max keeps the acorn stage framed without a kink when the shoot
  // appears. It starts wider so the jay fits, then settles on the acorn.
  const floor = 0.22 + 0.2 * jayOnStage(t);
  return Math.sqrt(floor * floor + (1.12 * h) * (1.12 * h));
}

/** 1 while the jay is burying the acorn, easing to 0 as it flies off. */
function jayOnStage(t: number): number {
  return 1 - smoothstep(STORY.jayLeaves, STORY.jayLeaves + 0.04, t);
}

/**
 * Height above the ground that sits at the world origin, where the presets
 * look. Early on it dips just below the surface so the cutaway shows the
 * root; later it rises into the trunk so the crown fits.
 */
export function viewCenter(t: number): number {
  const s = frameSize(t);
  return s * (-0.12 + 0.37 * smoothstep(0.3, 1.6, s)) + 0.11 * jayOnStage(t);
}

export function cameraScale(t: number): number {
  return frameSize(t) / frameSize(STORY.end);
}

// Seasons -----------------------------------------------------------------
//
// Years flash past far faster than a season can be read: near 150 years
// the slider covers about 8 years a second at 1x. A calendar-true yearly
// cycle would strobe. So the season shown runs on its own clock, Φ(u), a
// fixed table over the slider position:
//
//  1. It follows the real calendar while a year spans enough of the slider
//     (the first year and a half, where the acorn becomes a seedling).
//  2. Everywhere else it is capped at SEASON_CAP cycles per unit of slider,
//     so a cycle always covers at least about 1/SEASON_CAP of the slider:
//     two seconds at 1x, half a second at the fastest 4x warp, whatever
//     the mapping does.
//  3. A gentle piecewise-linear nudge makes it show the right season at
//     each story beat (leaves out for the sapling, ripe acorns at 40, a
//     summer gale), without moving the beats off their true years.
//
// It is a pure function of t: t maps to u, u indexes the table.

/** Year fraction of the day the acorn fell (0 = 1 January). Mid October. */
const ACORN_FALL_PHASE = 0.79;
export const SEASON_CAP = 22;
const SEASON_SAMPLES = 4096;
/** The clock is calendar-true up to here. */
const CALENDAR_UNTIL = 1.55;

/** Story beats and the time of year each should show. */
const SEASON_ANCHORS: [number, number][] = [
  [STORY.sapling, 0.55],
  [STORY.crownLift, 0.58],
  [STORY.firstAcorns, 0.7],
  [STORY.mast, 0.72],
  [STORY.storm, 0.6],
  [STORY.woodpecker, 0.4],
  [STORY.owl, 0.45],
  [STORY.end, 0.72],
];

function buildSeasonClock(): Float64Array {
  const table = new Float64Array(SEASON_SAMPLES + 1);
  table[0] = ACORN_FALL_PHASE;
  let prev = mapping.toTime(0);
  for (let i = 1; i <= SEASON_SAMPLES; i++) {
    const time = mapping.toTime(i / SEASON_SAMPLES);
    table[i] = table[i - 1] + Math.min(time - prev, SEASON_CAP / SEASON_SAMPLES);
    prev = time;
  }
  // Offsets at each anchor, wrapped to the nearest half cycle, interpolated in u.
  const knots: [number, number][] = [[mapping.toParam(CALENDAR_UNTIL), 0]];
  for (const [time, phase] of SEASON_ANCHORS) {
    const u = mapping.toParam(time);
    const raw = sample(table, u);
    let d = phase - (raw - Math.floor(raw));
    d -= Math.round(d);
    knots.push([u, d]);
  }
  const out = new Float64Array(SEASON_SAMPLES + 1);
  for (let i = 0; i <= SEASON_SAMPLES; i++) {
    const u = i / SEASON_SAMPLES;
    let offset = 0;
    if (u > knots[0][0]) {
      const k = knots.findIndex(([ku]) => ku >= u);
      if (k === -1) offset = knots[knots.length - 1][1];
      else {
        const [u0, d0] = knots[k - 1];
        const [u1, d1] = knots[k];
        offset = d0 + (d1 - d0) * ((u - u0) / (u1 - u0));
      }
    }
    out[i] = table[i] + offset;
  }
  return out;
}

function sample(table: Float64Array, u: number): number {
  const x = Math.min(1, Math.max(0, u)) * SEASON_SAMPLES;
  const i = Math.min(SEASON_SAMPLES - 1, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

const seasonClock = buildSeasonClock();

/** Continuous season clock: whole numbers are the displayed years, the fraction is the time of year. */
export function seasonClockAt(t: number): number {
  return sample(seasonClock, mapping.toParam(t));
}

/** Time of year shown at t, 0 = 1 January. */
export function seasonPhase(t: number): number {
  const c = seasonClockAt(t);
  return c - Math.floor(c);
}

export type SeasonName = "winter" | "spring" | "summer" | "autumn";

export function seasonName(phase: number): SeasonName {
  if (phase < 0.21 || phase >= 0.92) return "winter";
  if (phase < 0.42) return "spring";
  if (phase < 0.73) return "summer";
  return "autumn";
}

export interface Foliage {
  /** 0 bare, 1 full leaf. */
  amount: number;
  /** Fresh spring yellow-green, 0..1. */
  fresh: number;
  /** Autumn gold-brown, 0..1. */
  turn: number;
  /** Dead brown leaves a young oak keeps through winter. */
  kept: number;
}

/**
 * Leaf cover at a time of year for a tree of a given age. Oak leafs out in
 * late April and May and turns in late October and November. Young oaks
 * are marcescent: they hold dead brown leaves until spring.
 */
export function foliageAt(phase: number, age: number): Foliage {
  const out = smoothstep(0.29, 0.4, phase);
  const fall = smoothstep(0.84, 0.93, phase);
  const live = out * (1 - fall);
  const marcescent = 1 - smoothstep(10, 25, age);
  const held = phase >= 0.84 ? fall : 1 - smoothstep(0.28, 0.33, phase);
  const kept = marcescent * held * 0.8;
  return {
    amount: Math.max(live, kept),
    fresh: 1 - smoothstep(0.36, 0.5, phase),
    turn: smoothstep(0.76, 0.86, phase),
    kept: live >= kept ? 0 : 1,
  };
}

// Acorns ------------------------------------------------------------------

/** 0..1: how many acorns this tree can make at its age. None before 40, peak from about 80. */
export function acornCapacity(age: number): number {
  if (age < STORY.firstAcorns) return 0;
  return 0.3 + 0.7 * smoothstep(STORY.firstAcorns, 90, age);
}

/** Mast years come every few years: most years are lean, some are huge. */
export function mastFactor(displayYear: number): number {
  const h = hash01(displayYear * 3.17 + 0.5);
  return h > 0.62 ? 1 : 0.28 + 0.2 * h;
}

export interface AcornSeason {
  /** Acorns on the branches, 0..1. */
  onTree: number;
  /** 0 green, 1 ripe brown. */
  ripe: number;
  /** Acorns lying under the tree, 0..1. */
  onGround: number;
}

/** English oak acorns swell in August, ripen in September and October, and drop. */
export function acornSeason(phase: number): AcornSeason {
  return {
    onTree: smoothstep(0.55, 0.62, phase) * (1 - smoothstep(0.76, 0.82, phase)),
    ripe: smoothstep(0.66, 0.78, phase),
    onGround: smoothstep(0.76, 0.81, phase) * (1 - smoothstep(0.89, 0.95, phase)),
  };
}

// -------------------------------------------------------------------------

function hash01(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
