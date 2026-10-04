// src/experiences/continents/ContinentsState.ts
//
// The globe at a given time, as plain data. Pure: each block's rotation is
// a slerp between the two key ages around it, so the scene is a function of
// time alone. Time is -Ma (millions of years, negative in the past).

import * as THREE from "three";
import { ANCHORS, BLOCKS, MAP_LABELS, RANGES, type BlockDef, type LabelAnchor, type Profile } from "./continentsData";
import type { BlockId } from "./outlines";
import { AGES, ROTATIONS } from "./reconstruction";
import { arc, toLonLat, toVec } from "./sphere";

export const OLDEST_MA = AGES[0];

const EARTH_RADIUS_KM = 6371;

export interface BlockState {
  id: BlockId;
  /** Rotation carrying the present-day outline to its position, [x, y, z, w]. */
  quaternion: [number, number, number, number];
  /** Where the block's anchor sits, in degrees. */
  centre: { lon: number; lat: number };
  /** Drift speed of the anchor, in cm per year. */
  speed: number;
  /** 0 = bare land, 1 = ice sheet. */
  ice: number;
}

export interface ContinentsState {
  ma: number;
  blocks: BlockState[];
  /** Mountain growth by range id, 0 to 1. */
  ranges: Record<string, number>;
  labels: { id: string; position: [number, number, number]; opacity: number }[];
}

export function maAt(time: number): number {
  return Math.min(OLDEST_MA, Math.max(0, -time));
}

export function profileAt(profile: Profile, ma: number): number {
  if (ma >= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [ma1, v1] = profile[i];
    if (ma >= ma1) {
      const [ma0, v0] = profile[i - 1];
      return v0 + ((ma0 - ma) / (ma0 - ma1)) * (v1 - v0);
    }
  }
  return profile[profile.length - 1][1];
}

export function rotationAt(id: BlockId, ma: number, out = new THREE.Quaternion()): THREE.Quaternion {
  const keys = ROTATIONS[id];
  const m = Math.min(OLDEST_MA, Math.max(0, ma));
  let i = 0;
  while (i < AGES.length - 2 && m < AGES[i + 1]) i++;
  const s = (AGES[i] - m) / (AGES[i] - AGES[i + 1]);
  return out.slerpQuaternions(keys[i], keys[i + 1], s);
}

function anchorAt(id: BlockId, ma: number): THREE.Vector3 {
  return toVec(ANCHORS[id]).applyQuaternion(rotationAt(id, ma));
}

/** Average speed over one million years around ma. */
function speedAt(id: BlockId, ma: number): number {
  const older = Math.min(OLDEST_MA, ma + 0.5);
  const younger = Math.max(0, older - 1);
  const km = arc(anchorAt(id, older), anchorAt(id, younger)) * EARTH_RADIUS_KM;
  // 1 km per million years is 0.1 cm per year.
  return (km / (older - younger)) * 0.1;
}

const scratchQ = new THREE.Quaternion();
const scratchV = new THREE.Vector3();

export function labelPosition(anchor: LabelAnchor, ma: number, out = new THREE.Vector3()): THREE.Vector3 {
  if (anchor.kind === "fixed") return toVec(anchor.at, out);
  const [idA, a] = anchor.a;
  const [idB, b] = anchor.b;
  toVec(a, out).applyQuaternion(rotationAt(idA, ma, scratchQ));
  return out.add(toVec(b, scratchV).applyQuaternion(rotationAt(idB, ma, scratchQ))).normalize();
}

/** One block at ma, for when only one is needed, as on its hover card. */
export function blockStateAt(def: BlockDef, ma: number): BlockState {
  const q = rotationAt(def.id, ma);
  const [lon, lat] = toLonLat(anchorAt(def.id, ma));
  return {
    id: def.id,
    quaternion: [q.x, q.y, q.z, q.w],
    centre: { lon, lat },
    speed: speedAt(def.id, ma),
    ice: def.ice ? profileAt(def.ice, ma) : 0,
  };
}

export function continentsStateAt(time: number): ContinentsState {
  const ma = maAt(time);
  return {
    ma,
    blocks: BLOCKS.map((def) => blockStateAt(def, ma)),
    ranges: Object.fromEntries(RANGES.map((r) => [r.id, profileAt(r.growth, ma)])),
    labels: MAP_LABELS.map((l) => {
      const p = labelPosition(l.anchor, ma);
      return { id: l.id, position: [p.x, p.y, p.z], opacity: profileAt(l.opacity, ma) };
    }),
  };
}

/**
 * Moments on the axis are zero or negative ("200 million years ago"). The
 * HUD also passes positive spans through format to show the playback rate,
 * so those read as plain durations ("6 million years").
 */
export function formatMa(time: number): string {
  if (time > 0) {
    const span = time < 10 ? Math.round(time * 10) / 10 : Math.round(time);
    return `${span} million years`;
  }
  const ma = Math.round(maAt(time));
  return ma === 0 ? "Today" : `${ma} million years ago`;
}

export function formatLatitude(lat: number): string {
  const r = Math.round(lat);
  return r === 0 ? "Equator" : `${Math.abs(r)}°${r > 0 ? "N" : "S"}`;
}

export function formatSpeed(cmPerYear: number): string {
  if (cmPerYear < 0.5) return "Barely moving";
  return `${Math.round(cmPerYear)} cm a year`;
}
