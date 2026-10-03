// src/experiences/keyframe/sample.ts
//
// Pure sampling: a SceneDef and a time in, plain poses out. Nothing here
// touches Three.js or remembers the previous call, so the same t always
// gives the same scene.

import { EASINGS } from "./easing";
import type { HoverDef, ObjectPose, SceneDef, SceneObjectDef, SceneSample, Track, Vec3 } from "./types";

type Mix<V> = (a: V, b: V, s: number) => V;

const mixNumber: Mix<number> = (a, b, s) => a + (b - a) * s;
const mixVec3: Mix<Vec3> = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
/** Booleans cannot blend, so every boolean segment behaves as a step. */
const mixBoolean: Mix<boolean> = (a, b, s) => (s >= 1 ? b : a);

/** Index of the first key with time > t. Keys are sorted. */
function nextKey<V>(track: Track<V>, t: number): number {
  let lo = 0;
  let hi = track.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function sampleTrack<V>(track: Track<V>, t: number, mix: Mix<V>): V {
  const i = nextKey(track, t);
  if (i === 0) return track[0].v;
  if (i === track.length) return track[track.length - 1].v;
  const a = track[i - 1];
  const b = track[i];
  if (b.ease === "step") return a.v;
  return mix(a.v, b.v, EASINGS[b.ease]((t - a.t) / (b.t - a.t)));
}

export function sampleNumber(track: Track<number>, t: number): number {
  return sampleTrack(track, t, mixNumber);
}

function sampleObject(def: SceneObjectDef, t: number): ObjectPose {
  const { tracks } = def;
  const scale = sampleTrack(tracks.scale, t, mixVec3);
  const opacity = sampleTrack(tracks.opacity, t, mixNumber);
  return {
    id: def.id,
    position: sampleTrack(tracks.position, t, mixVec3),
    rotation: sampleTrack(tracks.rotation, t, mixVec3),
    scale,
    color: sampleTrack(tracks.color, t, mixVec3),
    opacity,
    visible: sampleTrack(tracks.visible, t, mixBoolean) && opacity > 0.001 && scale.every((s) => Math.abs(s) > 1e-6),
  };
}

const DEG = 180 / Math.PI;

/**
 * Stretches a Y-aligned pose from one sibling toward another. The Euler XYZ
 * rotation turns +Y onto the direction d with no twist: about Z to lean it
 * by asin(-dx), then about X to swing it toward z.
 */
function placeBetween(def: SceneObjectDef, pose: ObjectPose, byId: Map<string, ObjectPose>): void {
  const b = def.between!;
  const from = byId.get(b.from)!.position;
  const to = byId.get(b.to)!.position;
  const a: Vec3 = [from[0] + b.fromOffset[0], from[1] + b.fromOffset[1], from[2] + b.fromOffset[2]];
  const d: Vec3 = [to[0] + b.toOffset[0] - a[0], to[1] + b.toOffset[1] - a[1], to[2] + b.toOffset[2] - a[2]];
  const distance = Math.hypot(d[0], d[1], d[2]);
  const length = distance * pose.scale[1];
  const n: Vec3 = distance > 1e-9 ? [d[0] / distance, d[1] / distance, d[2] / distance] : [0, 1, 0];
  const centreOffset = def.params.bottom ? 0 : length / 2;
  pose.position = [a[0] + n[0] * centreOffset, a[1] + n[1] * centreOffset, a[2] + n[2] * centreOffset];
  pose.rotation = [Math.atan2(n[2], n[1]) * DEG, 0, Math.atan2(-n[0], Math.hypot(n[1], n[2])) * DEG];
  pose.scale = [pose.scale[0], length, pose.scale[2]];
  if (length <= 1e-6) pose.visible = false;
}

export function sampleScene(def: SceneDef, time: number): SceneSample {
  const t = Math.min(def.maxTime, Math.max(def.minTime, time));
  const objects = def.objects.map((o) => sampleObject(o, t));
  if (def.objects.some((o) => o.between)) {
    const byId = new Map(objects.map((p) => [p.id, p]));
    def.objects.forEach((o, i) => {
      if (o.between) placeBetween(o, objects[i], byId);
    });
  }
  return { time: t, objects };
}

export function hoverDescription(hover: HoverDef, time: number): string {
  let text = hover.descriptions[0].text;
  for (const d of hover.descriptions) {
    if (d.from <= time) text = d.text;
  }
  return text;
}

export function cameraDistanceScaleAt(def: SceneDef, time: number): number {
  return def.cameraDistanceScale.length === 0 ? 1 : sampleNumber(def.cameraDistanceScale, time);
}
