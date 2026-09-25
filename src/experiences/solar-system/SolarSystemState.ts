// src/experiences/solar-system/SolarSystemState.ts
//
// The solar system at slider position p in [0, 1], as plain data. Pure: no
// Three.js objects, no side effects. The particle shader in AccretionField
// uses the same orbital formulas, so particles and solid bodies agree on
// where every planet is.

import { easeInOutCubic, lerp, smoothstep, window as timeWindow } from "../../core/interpolate";
import { BODIES, type BodyDef } from "./solarData";

/** Orbital clock at p = 1. Angles are phase + omega(r) * tau. */
export const TAU_MAX = 600;
const MOON_RATE = 0.3;

export function tauAt(p: number): number {
  return TAU_MAX * p;
}

/** Keplerian angular rate for a planet at display radius r. Matches omega() in the shader. */
export function planetOmega(r: number): number {
  return 1 / Math.pow(Math.max(r, 0.3), 1.5);
}

export function moonOmega(r: number): number {
  return MOON_RATE / Math.pow(Math.max(r, 0.05), 1.5);
}

export interface BodyState {
  id: string;
  position: [number, number, number];
  /** Orbital angle. World angle for planets, angle around the parent for moons. */
  angle: number;
  /** 0 = scattered particles, 1 = gathered into a ball. */
  clump: number;
  /** How far the body's particles have faded out as the solid body takes over. */
  particleFade: number;
  /** 0 = no solid body yet, 1 = fully formed. */
  solid: number;
  /** 1 = molten, 0 = cooled to its final colour. */
  heat: number;
  /** Self-rotation angle. */
  spin: number;
}

export interface SolarState {
  p: number;
  tau: number;
  /** Cloud contraction, 0 to 1. */
  contract: number;
  /** Solar wind clearing the leftover gas, 0 to 1. */
  clear: number;
  /** Hydrogen fusion in the Sun, 0 to 1. */
  ignition: number;
  /** Orbit guide lines, 0 to 1. */
  orbits: number;
  bodies: BodyState[];
}

export const BODY_INDEX = new Map(BODIES.map((b, i) => [b.id, i]));

export function heatAt(keys: [number, number][], p: number): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, h0] = keys[i];
    const [p1, h1] = keys[i + 1];
    if (p <= p1) return lerp(h0, h1, timeWindow(p, p0, p1));
  }
  return keys[keys.length - 1][1];
}

function orbitAngle(def: BodyDef, tau: number): number {
  if (def.kind === "moon") {
    const dir = def.retrograde ? -1 : 1;
    return def.phase + dir * moonOmega(def.orbit) * tau;
  }
  return def.phase + planetOmega(def.orbit) * tau;
}

export function solarStateAt(p: number): SolarState {
  const pc = Math.min(1, Math.max(0, p));
  const tau = tauAt(pc);

  const bodies: BodyState[] = [];
  for (const def of BODIES) {
    const angle = orbitAngle(def, tau);
    let position: [number, number, number] = [0, 0, 0];
    if (def.kind === "planet") {
      position = [def.orbit * Math.cos(angle), 0, def.orbit * Math.sin(angle)];
    } else if (def.kind === "moon") {
      const parent = bodies[BODY_INDEX.get(def.parent!)!];
      position = [
        parent.position[0] + def.orbit * Math.cos(angle),
        0,
        parent.position[2] + def.orbit * Math.sin(angle),
      ];
    }
    const clump = easeInOutCubic(timeWindow(pc, def.form[0], def.form[1]));
    bodies.push({
      id: def.id,
      position,
      angle,
      clump,
      particleFade: smoothstep(0.85, 1, clump),
      solid: smoothstep(0.7, 1, clump),
      heat: heatAt(def.heat, pc),
      spin: tau * 0.05 * (def.spin ?? 1),
    });
  }

  return {
    p: pc,
    tau,
    contract: smoothstep(0, 0.14, pc),
    clear: smoothstep(0.54, 0.66, pc),
    ignition: smoothstep(0.5, 0.58, pc),
    orbits: smoothstep(0.84, 0.95, pc),
    bodies,
  };
}
