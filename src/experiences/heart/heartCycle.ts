// src/experiences/heart/heartCycle.ts
//
// One heartbeat at 75 beats per minute, as plain functions of t in
// milliseconds (0 to 800). Everything the scene shows is read from here:
// the ECG voltage, the electrical signal's progress, valve openness, chamber
// volumes and pressures, and the cumulative blood flow through each valve.
//
// Blood flow is modelled as cumulative volume (mL) through each boundary
// along a side of the heart: veins -> atrium -> AV valve -> ventricle ->
// semilunar valve -> artery. A chamber's volume is its start volume plus
// what came in minus what went out, so the volumes, the valve timing, and
// the moving blood can never disagree.

import { smoothstep, window as windowFn } from "../../core/interpolate";

export const BEAT_MS = 800;

/**
 * Milliseconds within the beat, after the Wiggers diagram at 75 bpm. The
 * P wave runs 0 to 90, QRS 160 to 240, T 380 to 540, ejection 260 to 540.
 */
export const TIMING = {
  atrialSystole: [50, 150],
  lub: 210,
  dub: 540,
} as const;

export type PhaseId =
  | "diastasis"
  | "atrialSystole"
  | "isovolumetricContraction"
  | "ejection"
  | "isovolumetricRelaxation"
  | "rapidFilling";

export interface Phase {
  id: PhaseId;
  start: number;
  end: number;
}

/** The mechanical cycle. Contiguous, covering [0, BEAT_MS]. */
export const PHASES: Phase[] = [
  { id: "diastasis", start: 0, end: 50 },
  { id: "atrialSystole", start: 50, end: 210 },
  { id: "isovolumetricContraction", start: 210, end: 260 },
  { id: "ejection", start: 260, end: 540 },
  { id: "isovolumetricRelaxation", start: 540, end: 620 },
  { id: "rapidFilling", start: 620, end: 720 },
  { id: "diastasis", start: 720, end: BEAT_MS },
];

export function phaseAt(t: number): Phase {
  for (const p of PHASES) if (t < p.end) return p;
  return PHASES[PHASES.length - 1];
}

// ---------------------------------------------------------------------------
// Shapes

/** sin(pi s), exactly 0 outside the open interval (0, 1). */
function halfSine(s: number): number {
  return s <= 0 || s >= 1 ? 0 : Math.sin(Math.PI * s);
}

function bump(t: number, start: number, end: number): number {
  return halfSine(windowFn(t, start, end));
}

function gauss(t: number, center: number, sigma: number): number {
  const d = (t - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

type RampShape = "smooth" | "early" | "linear";

/** Cumulative flow shapes on s in [0, 1]. "early" peaks a third of the way in, like ejection and the E wave. */
const RAMP: Record<RampShape, (s: number) => number> = {
  smooth: (s) => s * s * (3 - 2 * s),
  early: (s) => 6 * s * s - 8 * s * s * s + 3 * s * s * s * s,
  linear: (s) => s,
};

interface Ramp {
  from: number;
  to: number;
  /** mL moved across the boundary during [from, to]. */
  mL: number;
  shape: RampShape;
}

function cumulative(ramps: Ramp[], t: number): number {
  let sum = 0;
  for (const r of ramps) sum += r.mL * RAMP[r.shape](windowFn(t, r.from, r.to));
  return sum;
}

/** Piecewise smooth keyframes [t, value], held flat outside the first and last key. */
function keyframes(frames: readonly (readonly [number, number])[], t: number): number {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      return v0 + (v1 - v0) * smoothstep(t0, t1, t);
    }
  }
  return frames[frames.length - 1][1];
}

// ---------------------------------------------------------------------------
// Blood flow

export type Side = "right" | "left";

/** Boundaries along one side, upstream to downstream. */
export type Boundary = "veinIn" | "avValve" | "semilunar" | "arteryOut";

/** Stroke volume: what each ventricle pumps per beat. Both sides match. */
export const STROKE_ML = 70;

/**
 * Each boundary moves exactly STROKE_ML per beat, so the heart is back
 * where it started at 800 ms. Vein inflow is fastest while the ventricles
 * squeeze (the AV plane pulls down and sucks the atria full).
 */
const FLOW: Record<Boundary, Ramp[]> = {
  veinIn: [
    { from: 0, to: 50, mL: 3, shape: "smooth" },
    { from: 150, to: 210, mL: 2, shape: "smooth" },
    { from: 210, to: 540, mL: 40, shape: "smooth" },
    { from: 540, to: 620, mL: 5, shape: "smooth" },
    { from: 620, to: 720, mL: 15, shape: "smooth" },
    { from: 720, to: 800, mL: 5, shape: "smooth" },
  ],
  avValve: [
    { from: 0, to: 50, mL: 2, shape: "smooth" },
    { from: 50, to: 150, mL: 20, shape: "smooth" },
    { from: 620, to: 720, mL: 40, shape: "early" },
    { from: 720, to: 800, mL: 8, shape: "smooth" },
  ],
  semilunar: [{ from: 260, to: 540, mL: 70, shape: "early" }],
  arteryOut: [{ from: 0, to: BEAT_MS, mL: 70, shape: "linear" }],
};

/** Cumulative mL through a boundary since t = 0. Same on both sides. */
export function flowThrough(boundary: Boundary, t: number): number {
  return cumulative(FLOW[boundary], t);
}

export type ChamberId = "rightAtrium" | "rightVentricle" | "leftAtrium" | "leftVentricle";

/** Volume at t = 0 (late diastole). Ventricles: end-diastolic 120/130 mL, end-systolic 50/60 mL. */
const START_ML: Record<ChamberId, number> = {
  rightAtrium: 45,
  rightVentricle: 108,
  leftAtrium: 40,
  leftVentricle: 98,
};

export function chamberVolume(chamber: ChamberId, t: number): number {
  const isAtrium = chamber === "rightAtrium" || chamber === "leftAtrium";
  const inflow = flowThrough(isAtrium ? "veinIn" : "avValve", t);
  const outflow = flowThrough(isAtrium ? "avValve" : "semilunar", t);
  return START_ML[chamber] + inflow - outflow;
}

// ---------------------------------------------------------------------------
// Pressures (mmHg), shaped after the Wiggers diagram

export type PressureSite = ChamberId | "aorta" | "pulmonaryArtery";

const PRESSURE: Record<PressureSite, readonly (readonly [number, number])[]> = {
  leftVentricle: [[0, 6], [50, 6], [150, 10], [210, 12], [260, 80], [340, 120], [460, 110], [540, 95], [580, 30], [620, 5], [680, 3], [760, 5], [800, 6]],
  aorta: [[0, 88], [260, 80], [340, 120], [460, 112], [540, 100], [552, 95], [570, 99], [800, 88]],
  leftAtrium: [[0, 8], [50, 8], [110, 12], [160, 7], [215, 9], [260, 5], [540, 15], [620, 14], [700, 7], [800, 8]],
  rightVentricle: [[0, 3], [50, 3], [150, 6], [210, 6], [255, 10], [340, 25], [460, 22], [540, 18], [580, 6], [620, 2], [700, 2], [800, 3]],
  pulmonaryArtery: [[0, 12], [255, 10], [340, 25], [460, 22], [540, 18], [552, 16], [570, 17], [800, 12]],
  rightAtrium: [[0, 3], [110, 6], [160, 3], [215, 4], [260, 1], [540, 6], [620, 5], [700, 2], [800, 3]],
};

export function pressure(site: PressureSite, t: number): number {
  return keyframes(PRESSURE[site], t);
}

// ---------------------------------------------------------------------------
// Valves. Openness 1 is wide open, 0 shut; slightly negative is the
// leaflets billowing back just after they snap shut.

export type ValveId = "tricuspid" | "pulmonary" | "mitral" | "aortic";
export type ValveKind = "av" | "semilunar";

export const VALVE_KIND: Record<ValveId, ValveKind> = {
  tricuspid: "av",
  mitral: "av",
  pulmonary: "semilunar",
  aortic: "semilunar",
};

const VALVE_OPEN: Record<ValveKind, readonly (readonly [number, number])[]> = {
  av: [[0, 0.6], [50, 0.65], [110, 1], [160, 0.75], [200, 0.7], [210, -0.14], [221, 0.05], [232, 0], [620, 0], [645, 1], [700, 0.95], [760, 0.65], [800, 0.6]],
  semilunar: [[0, 0], [258, 0], [276, 1], [470, 0.92], [530, 0.45], [540, -0.14], [551, 0.05], [562, 0], [800, 0]],
};

export function valveOpenness(valve: ValveId, t: number): number {
  return keyframes(VALVE_OPEN[VALVE_KIND[valve]], t);
}

export function valveIsOpen(valve: ValveId, t: number): boolean {
  return valveOpenness(valve, t) > 0.02;
}

// ---------------------------------------------------------------------------
// Electrical signal

/** Lead II ECG voltage (mV). P, QRS, and an asymmetric T wave that ends at the dub. */
export function ecg(t: number): number {
  const p = 0.15 * gauss(t, 45, 15);
  const q = -0.12 * gauss(t, 174, 5);
  const r = 1.3 * gauss(t, 190, 6.5);
  const s = -0.3 * gauss(t, 207, 6);
  const tw = 0.32 * gauss(t, 470, t < 470 ? 38 : 24);
  return p + q + r + s + tw;
}

export type ConductionId = "internodal" | "his" | "bundleBranches" | "purkinje";

/** When the signal travels each part of the wiring, in ms. */
export const CONDUCTION: Record<ConductionId, readonly [number, number]> = {
  internodal: [0, 50],
  his: [130, 145],
  bundleBranches: [145, 170],
  purkinje: [170, 205],
};

/** How long a wire stays lit after the signal has passed. */
const AFTERGLOW_MS = 70;

export interface WireState {
  /** 0..1 along the wire: how far the signal has reached. */
  progress: number;
  /** 0..1 brightness of the lit part. */
  glow: number;
}

export function wire(id: ConductionId, t: number): WireState {
  const [a, b] = CONDUCTION[id];
  const progress = windowFn(t, a, b);
  const glow = t < a ? 0 : 1 - windowFn(t, b, b + AFTERGLOW_MS);
  return { progress, glow };
}

/** SA node flash: fires at 0 and fades. */
export function saGlow(t: number): number {
  return 1 - windowFn(t, 0, 60);
}

/** AV node: lights when the atrial wave arrives and holds the signal until the His bundle takes it. */
export function avGlow(t: number): number {
  const arrive = smoothstep(40, 55, t);
  const release = 1 - smoothstep(130, 175, t);
  // A slow shimmer while the node holds the signal, a pure function of t.
  const hold = 0.8 + 0.2 * Math.cos((t - 50) * 0.12);
  return arrive * release * (t > 55 && t < 130 ? hold : 1);
}

export interface WaveState {
  /** 0..1 how far the depolarization wave has spread across the muscle. */
  spread: number;
  /** 0..1 tint of muscle that has fired and not yet reset. */
  tint: number;
}

/** Atria fire with the P wave and reset hidden under the QRS. */
export function atrialWave(t: number): WaveState {
  return { spread: windowFn(t, 0, 80), tint: 1 - smoothstep(160, 240, t) };
}

/** Ventricles fire with the QRS, stay charged through the ST plateau, reset with the T wave. */
export function ventricularWave(t: number): WaveState {
  return { spread: windowFn(t, 165, 235), tint: t < 165 ? 0 : 1 - smoothstep(380, 540, t) };
}

// ---------------------------------------------------------------------------
// Motion

const LV_EDV = START_ML.leftVentricle + 22;
const LV_ESV = LV_EDV - STROKE_ML;

/** 0 relaxed and full, 1 squeezed to end-systole. Follows the volume, so it is still while every valve is shut. */
export function ventricularSqueeze(t: number): number {
  return (LV_EDV - chamberVolume("leftVentricle", t)) / (LV_EDV - LV_ESV);
}

/** Active atrial contraction, peaking mid atrial systole. */
export function atrialSqueeze(t: number): number {
  return bump(t, TIMING.atrialSystole[0], TIMING.atrialSystole[1] + 10);
}

const LA_MIN = 21;
const LA_MAX = 68;

/** 0 emptiest, 1 fullest. Shared by both atria. */
export function atrialFill(t: number): number {
  return (chamberVolume("leftAtrium", t) - LA_MIN) / (LA_MAX - LA_MIN);
}

/** Heart sounds: a short, loud lub and a crisper dub. 0..1. */
export function heartSound(t: number): { lub: number; dub: number } {
  return {
    lub: windowFn(t, TIMING.lub, TIMING.lub + 8) * (1 - windowFn(t, TIMING.lub + 25, TIMING.lub + 75)),
    dub: windowFn(t, TIMING.dub, TIMING.dub + 6) * (1 - windowFn(t, TIMING.dub + 20, TIMING.dub + 65)),
  };
}

// ---------------------------------------------------------------------------

export interface HeartState {
  t: number;
  phase: PhaseId;
  ecgMv: number;
  volumes: Record<ChamberId, number>;
  pressures: Record<PressureSite, number>;
  valves: Record<ValveId, { openness: number; open: boolean }>;
  wires: Record<ConductionId, WireState>;
  saGlow: number;
  avGlow: number;
  atrialWave: WaveState;
  ventricularWave: WaveState;
  ventricularSqueeze: number;
  atrialSqueeze: number;
  sound: { lub: number; dub: number };
}

const CHAMBERS: ChamberId[] = ["rightAtrium", "rightVentricle", "leftAtrium", "leftVentricle"];
const SITES: PressureSite[] = [...CHAMBERS, "aorta", "pulmonaryArtery"];
const VALVES: ValveId[] = ["tricuspid", "pulmonary", "mitral", "aortic"];
const WIRES: ConductionId[] = ["internodal", "his", "bundleBranches", "purkinje"];

function record<K extends string, V>(keys: K[], f: (k: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, f(k)])) as Record<K, V>;
}

export function clampBeat(time: number): number {
  return Math.min(BEAT_MS, Math.max(0, time));
}

export function heartState(time: number): HeartState {
  const t = clampBeat(time);
  return {
    t,
    phase: phaseAt(t).id,
    ecgMv: ecg(t),
    volumes: record(CHAMBERS, (c) => chamberVolume(c, t)),
    pressures: record(SITES, (s) => pressure(s, t)),
    valves: record(VALVES, (v) => ({ openness: valveOpenness(v, t), open: valveIsOpen(v, t) })),
    wires: record(WIRES, (w) => wire(w, t)),
    saGlow: saGlow(t),
    avGlow: avGlow(t),
    atrialWave: atrialWave(t),
    ventricularWave: ventricularWave(t),
    ventricularSqueeze: ventricularSqueeze(t),
    atrialSqueeze: atrialSqueeze(t),
    sound: heartSound(t),
  };
}
