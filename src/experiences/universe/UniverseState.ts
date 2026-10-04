// src/experiences/universe/UniverseState.ts
//
// The universe at time t (years after the Big Bang), as plain data. Pure: no
// Three.js objects, no side effects. Every visual channel is a smoothstep in
// log time, so each era gets the same treatment whether it lasts a
// trillionth of a second or a billion years.

import { lerp, smoothstep } from "../../core/interpolate";
import { TODAY } from "./universeData";

export const STAGES = ["plasma", "recombination", "darkAges", "firstStars", "galaxies", "structure", "today"] as const;
export type Stage = (typeof STAGES)[number];
export type StageWeights = Record<Stage, number>;

/** log10 of years, safe at t = 0. */
function logYears(t: number): number {
  return Math.log10(Math.max(t, 1e-60));
}

/** log10 of years for a time given in seconds. */
function lsec(s: number): number {
  return Math.log10(s / 3.156e7);
}

const L = Math.log10;

/** Boundaries between consecutive stages: centre in years, half-width in decades of log time. */
const BOUNDARIES: [number, number][] = [
  [2.5e5, 0.12],
  [6e5, 0.12],
  [1e8, 0.15],
  [4e8, 0.15],
  [3e9, 0.15],
  [9e9, 0.08],
];

/**
 * How much of each stage the universe is in at time t. Each weight is the
 * difference of two neighbouring boundary steps, so the weights always sum
 * to 1 and at most two stages overlap.
 */
export function stageWeights(t: number): StageWeights {
  const lt = logYears(t);
  const steps = [1, ...BOUNDARIES.map(([at, w]) => smoothstep(L(at) - w, L(at) + w, lt)), 0];
  const weights = {} as StageWeights;
  STAGES.forEach((stage, i) => {
    weights[stage] = steps[i] - steps[i + 1];
  });
  return weights;
}

/** The stage with the largest weight. */
export function dominantStage(t: number): Stage {
  const w = stageWeights(t);
  return STAGES.reduce((best, s) => (w[s] > w[best] ? s : best), STAGES[0]);
}

// Flat Lambda-CDM with Planck 2018 parameters, radiation (with neutrinos)
// included. t(a) = integral of da / (a H) has no closed form with all three
// terms, so it is tabulated once on a log grid and inverted by interpolation.
const HUBBLE_TIME = 14.44e9; // 1 / H0 in years, H0 = 67.7 km/s/Mpc
const OMEGA_R = 9.1e-5;
const OMEGA_M = 0.31;
const OMEGA_L = 1 - OMEGA_M - OMEGA_R;
const A_MIN = 1e-12;
const STEPS = 4000;

const { lnA, lnT } = (() => {
  const lnA = new Float64Array(STEPS + 1);
  const lnT = new Float64Array(STEPS + 1);
  const x0 = Math.log(A_MIN);
  const dx = (Math.log(1.2) - x0) / STEPS;
  const hubble = (x: number) => {
    const a = Math.exp(x);
    return Math.sqrt(OMEGA_R / a ** 4 + OMEGA_M / a ** 3 + OMEGA_L);
  };
  // Deep in the radiation era, t = a^2 / (2 H0 sqrt(OmegaR)).
  let t = (HUBBLE_TIME * A_MIN * A_MIN) / (2 * Math.sqrt(OMEGA_R));
  for (let i = 0; i <= STEPS; i++) {
    const x = x0 + i * dx;
    if (i > 0) t += (HUBBLE_TIME * dx * (1 / hubble(x - dx) + 1 / hubble(x))) / 2;
    lnA[i] = x;
    lnT[i] = Math.log(t);
  }
  return { lnA, lnT };
})();

function interpolate(xs: Float64Array, ys: Float64Array, x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
}

// The model's own age (about 13.8 billion years) is stretched onto TODAY so a = 1 lands exactly there.
const LN_MODEL_AGE = interpolate(lnA, lnT, 0);

/** Size of the universe relative to today (a = 1 today). Monotonic. */
export function scaleFactor(t: number): number {
  if (t <= 0) return 0;
  const lt = Math.log(t / TODAY) + LN_MODEL_AGE;
  if (lt <= lnT[0]) return A_MIN * Math.exp((lt - lnT[0]) / 2);
  return Math.exp(interpolate(lnT, lnA, lt));
}

/** Display radius of the observable-universe ball today, in scene units. */
export const RADIUS_TODAY = 10;
const RADIUS_SEED = 0.12;
const RADIUS_INFLATED = 3.5;

/**
 * Display radius. The real scale factor spans 26+ decades, so the ball uses
 * a storybook scale: inflation pops it from a dot to a ball, log(a) grows it
 * through the hot early eras, and a itself takes over late so the speed-up
 * from dark energy is visible.
 */
export function displayRadius(t: number): number {
  if (t <= 0) return RADIUS_SEED;
  const ls = logYears(t);
  const a = scaleFactor(t);
  const ell = Math.min(1, Math.max(0, (Math.log10(a) + 10) / 10));
  const grown = RADIUS_INFLATED + RADIUS_TODAY * (0.25 * ell + 0.4 * a);
  const seed = RADIUS_SEED + 0.3 * smoothstep(lsec(1e-44), lsec(1e-36), ls);
  return lerp(seed, grown, smoothstep(lsec(1e-36), lsec(1e-32), ls));
}

/**
 * Camera distance multiplier. Backing off as sqrt(R) rather than R lets the
 * ball grow on screen; the floor keeps the time-zero burst from filling it.
 */
export function cameraScale(t: number): number {
  return Math.max(0.3, Math.sqrt(displayRadius(t) / RADIUS_TODAY));
}

export interface UniverseState {
  time: number;
  scaleFactor: number;
  /** How much light emitted now is stretched by the time it reaches us; Infinity at t = 0. */
  redshift: number;
  radius: number;
  stages: StageWeights;
  /** The Big Bang burst, 1 at t = 0. */
  flash: number;
  /** Opaque plasma fog. */
  fog: number;
  /** Fog colour, 0 white-hot to 1 orange. */
  fogHeat: number;
  /** Free quarks in the early soup, gone once protons form. */
  quarks: number;
  /** Drives the fog's boiling pattern; frozen once the CMB is released. */
  boil: number;
  /** Sound-wave ripples printed on the fog: the CMB pattern. */
  ripples: number;
  /** The released CMB shell still glowing around the ball. */
  afterglow: number;
  /** 0 smooth gas, 1 full cosmic web. */
  structure: number;
  firstStars: number;
  galaxies: number;
  milkyWay: number;
  sun: number;
}

export function universeStateAt(time: number): UniverseState {
  const t = Math.max(0, Math.min(TODAY, time));
  const lt = logYears(t);
  const a = scaleFactor(t);
  const fog = 1 - smoothstep(L(3.2e5), L(4.2e5), lt);
  return {
    time: t,
    scaleFactor: a,
    redshift: a > 0 ? 1 / a - 1 : Infinity,
    radius: displayRadius(t),
    stages: stageWeights(t),
    flash: 1 - smoothstep(lsec(1e-40), lsec(1e-33), lt),
    fog,
    fogHeat: smoothstep(lsec(1e-6), L(3.8e5), lt),
    quarks: smoothstep(lsec(1e-33), lsec(1e-31), lt) * (1 - smoothstep(lsec(4e-6), lsec(2.5e-5), lt)),
    boil: (Math.min(Math.max(lt, lsec(1e-36)), L(3.8e5)) - lsec(1e-36)) * 0.15,
    ripples: smoothstep(L(1e4), L(3.5e5), lt),
    afterglow: smoothstep(L(3e5), L(3.8e5), lt) * (1 - smoothstep(L(4.2e5), L(1.5e6), lt)),
    structure: smoothstep(L(2e6), L(8e9), lt),
    firstStars: smoothstep(L(8e7), L(1.5e8), lt) * (1 - smoothstep(L(4e8), L(1.5e9), lt)),
    galaxies: smoothstep(L(2.5e8), L(2.5e9), lt),
    milkyWay: smoothstep(L(6e8), L(5e9), lt),
    sun: smoothstep(L(8.6e9), L(9.2e9), lt),
  };
}
