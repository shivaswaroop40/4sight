// src/experiences/continents/sphere.ts
//
// Points and rotations on the unit globe. Longitude 0 faces +z, east is +x,
// north is +y, so a camera on +z sees Africa upright with east to the right.
//
// Rotations follow the plate-tectonics convention: an Euler pole and an
// angle, positive counterclockwise seen from above the pole.

import * as THREE from "three";

/** [longitude, latitude] in degrees, GeoJSON order. */
export type LonLat = readonly [number, number];

const DEG = Math.PI / 180;

export function toVec([lon, lat]: LonLat, out = new THREE.Vector3()): THREE.Vector3 {
  const c = Math.cos(lat * DEG);
  return out.set(c * Math.sin(lon * DEG), Math.sin(lat * DEG), c * Math.cos(lon * DEG));
}

export function toLonLat(v: THREE.Vector3): [number, number] {
  const n = v.clone().normalize();
  return [Math.atan2(n.x, n.z) / DEG, Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) / DEG];
}

/** Rotation about the pole at (lon, lat) by angle degrees. */
export function euler(pole: LonLat, angle: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(toVec(pole), angle * DEG);
}

/** East, north, up at a point. Degenerate exactly at the poles, which no anchor or placement uses. */
function frame(p: LonLat): THREE.Matrix4 {
  const up = toVec(p);
  const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
  const north = up.clone().cross(east);
  return new THREE.Matrix4().makeBasis(east, north, up);
}

/**
 * The rotation that carries `anchor` to `to`, turned `turn` degrees
 * counterclockwise about the new position. turn 0 keeps the block's
 * north-up heading. Reads like a paleomap: "India's centre sat at 20°S,
 * 60°E, turned 30° clockwise" is place(INDIA, [60, -20], -30).
 */
export function place(anchor: LonLat, to: LonLat, turn = 0): THREE.Quaternion {
  const from = new THREE.Quaternion().setFromRotationMatrix(frame(anchor));
  const target = new THREE.Quaternion().setFromRotationMatrix(frame(to));
  target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turn * DEG));
  return target.multiply(from.invert());
}

/** Apply `a` after `b`: the block moves by b, then the frame b lives in moves by a. */
export function compose(a: THREE.Quaternion, b: THREE.Quaternion): THREE.Quaternion {
  return a.clone().multiply(b);
}

/** Great-circle angle between two unit vectors, in radians. */
export function arc(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.atan2(a.clone().cross(b).length(), a.dot(b));
}
