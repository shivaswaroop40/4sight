// src/experiences/iphone/IPhoneState.ts
//
// Pure animation math for the iPhone. Every function here depends only on
// its arguments, so setTime(t) can rebuild the whole scene from t alone and
// scrubbing backwards plays every move in reverse.

import * as THREE from "three";
import { lerp, smoothstep, window as windowFn } from "../../core/interpolate";
import type { IPhoneComponent } from "./iphoneData";

export type Vec3 = [number, number, number];

export interface ComponentPose {
  position: Vec3;
  quaternion: [number, number, number, number];
  scale: Vec3;
}

export interface IPhoneComponentState extends ComponentPose {
  /** Raw 0..1 fraction of this component's own stage window at time t. */
  assembledFraction: number;
}

export interface IPhoneStateSnapshot {
  t: number;
  progress: number;
  screenOpacity: number;
  faceOpacity: number;
  eyeOpenness: number;
  components: Record<string, IPhoneComponentState>;
}

/** Ease out with a small overshoot, so parts pass their seat and click back. Exact at 0 and 1. */
export function easeOutBack(x: number, overshoot = 1.1): number {
  const s = Math.min(1, Math.max(0, x)) - 1;
  return 1 + (overshoot + 1) * s * s * s + overshoot * s * s;
}

/** A bump that is 0 at both ends of [start, end] and 1 in the middle. */
function bump(t: number, start: number, end: number): number {
  return halfSine(windowFn(t, start, end));
}

/** sin(pi s) that is exactly 0 outside the open interval (0, 1). */
function halfSine(s: number): number {
  return s <= 0 || s >= 1 ? 0 : Math.sin(Math.PI * s);
}

const scratchA = new THREE.Quaternion();
const scratchB = new THREE.Quaternion();
const scratchEuler = new THREE.Euler();

/** Raw local progress of a component's stage. */
export function componentAssembledFraction(c: IPhoneComponent, t: number): number {
  return windowFn(t, c.stage.start, c.stage.end);
}

/**
 * Pose of one part at time t: an arc from exploded to assembled with an
 * overshoot, then a squash along the direction it arrived from that springs
 * back to exactly 1 at the end of its stage.
 */
export function componentPose(c: IPhoneComponent, t: number): ComponentPose {
  const p = componentAssembledFraction(c, t);
  const s = easeOutBack(p);
  const ep = c.exploded.position;
  const ap = c.assembled.position;
  const arc = 4 * s * (1 - s) * 0.9;
  const position: Vec3 =
    p >= 1 ? [ap[0], ap[1], ap[2]] : [lerp(ep[0], ap[0], s), lerp(ep[1], ap[1], s) + arc, lerp(ep[2], ap[2], s)];

  scratchEuler.set(c.exploded.rotation[0], c.exploded.rotation[1], c.exploded.rotation[2]);
  scratchA.setFromEuler(scratchEuler);
  scratchEuler.set(c.assembled.rotation[0], c.assembled.rotation[1], c.assembled.rotation[2]);
  scratchB.setFromEuler(scratchEuler);
  scratchA.slerp(scratchB, Math.min(1, s));

  // Stretch in flight, squash on landing, spring back to 1.
  const stretch = bump(p, 0.15, 0.6) * 0.1;
  const squash = bump(p, 0.72, 1) * 0.16;
  const along = 1 + stretch - squash;
  const across = 1 - stretch * 0.5 + squash * 0.6;
  const axis = arrivalAxis(c);
  const scale: Vec3 = [across, across, across];
  scale[axis] = along;

  return { position, quaternion: [scratchA.x, scratchA.y, scratchA.z, scratchA.w], scale };
}

/** The axis (0 x, 1 y, 2 z) along which a part travels the most. */
function arrivalAxis(c: IPhoneComponent): 0 | 1 | 2 {
  const d = c.exploded.position.map((v, i) => Math.abs(v - c.assembled.position[i]));
  if (d[0] >= d[1] && d[0] >= d[2]) return 0;
  return d[1] >= d[2] ? 1 : 2;
}

// Wake-up timings. The display lands at 0.9.
export const WAKE = {
  screenOn: [0.9, 0.93],
  faceIn: [0.93, 0.95],
  eyesOpen: [0.94, 0.96],
  blinkClose: [0.968, 0.975],
  blinkOpen: [0.975, 0.982],
  hop: [0.93, 1.0],
  sparkles: [0.955, 1.0],
} as const;

export function screenOpacity(t: number): number {
  return smoothstep(WAKE.screenOn[0], WAKE.screenOn[1], t);
}

export function faceOpacity(t: number): number {
  return smoothstep(WAKE.faceIn[0], WAKE.faceIn[1], t);
}

/** 0 closed, 1 open. Opens with a little pop, blinks once around t = 0.975. */
export function eyeOpenness(t: number): number {
  const open = easeOutBack(windowFn(t, WAKE.eyesOpen[0], WAKE.eyesOpen[1]), 2);
  const closing = smoothstep(WAKE.blinkClose[0], WAKE.blinkClose[1], t);
  const reopening = smoothstep(WAKE.blinkOpen[0], WAKE.blinkOpen[1], t);
  return Math.max(0, open * (1 - closing + reopening));
}

/** Smile width, 0..1. Grows as the eyes open, extra wide at the top of the hop. */
export function smileAmount(t: number): number {
  return smoothstep(0.945, 0.965, t) * (1 + 0.25 * hopPhase(t).air);
}

export interface HopPose {
  y: number;
  scale: Vec3;
  rotation: Vec3;
  air: number;
}

function hopPhase(t: number): { crouch: number; air: number; jump: number; land: number } {
  const crouch = bump(t, 0.93, 0.952);
  const jump = windowFn(t, 0.952, 0.984);
  const air = halfSine(jump);
  const land = bump(t, 0.984, 1.0);
  return { crouch, air, jump, land };
}

/** Whole-phone hop: crouch, jump with a lean, land with a squash, upright at t = 1. */
export function hopPose(t: number): HopPose {
  const { crouch, air, jump, land } = hopPhase(t);
  const squash = crouch * 0.1 + land * 0.12 - air * 0.06;
  const sy = 1 - squash;
  const sxz = 1 + squash * 0.5;
  return {
    y: air * 0.9,
    scale: [sxz, sy, sxz],
    rotation: [0 - air * 0.12, air * 0.35, (jump <= 0 || jump >= 1 ? 0 : Math.sin(2 * Math.PI * jump)) * 0.12],
    air,
  };
}

/** Pop-in scale for sparkle i of n. Staggered, overshoots, stays at 1 by t = 1. */
export function sparkleScale(t: number, i: number, n: number): number {
  const [start, end] = WAKE.sparkles;
  const span = (end - start) * 0.5;
  const s0 = start + ((end - start - span) * i) / Math.max(1, n - 1);
  return easeOutBack(windowFn(t, s0, s0 + span), 2.5);
}

/** Aggregate, serialisable state for getState(t), tests, and the HUD. */
export function iphoneState(components: IPhoneComponent[], t: number): IPhoneStateSnapshot {
  const result: Record<string, IPhoneComponentState> = {};
  let sum = 0;
  for (const c of components) {
    const assembledFraction = componentAssembledFraction(c, t);
    result[c.id] = { ...componentPose(c, t), assembledFraction };
    sum += assembledFraction;
  }
  return {
    t,
    progress: components.length > 0 ? sum / components.length : 0,
    screenOpacity: screenOpacity(t),
    faceOpacity: faceOpacity(t),
    eyeOpenness: eyeOpenness(t),
    components: result,
  };
}
