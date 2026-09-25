// src/experiences/iphone/IPhoneState.ts
//
// Pure pose math for the iPhone assembly. componentPose(c, t) never reads
// previous state -- it derives position/orientation from t and the
// component's exploded/assembled poses alone, per CONTRACT.md.

import * as THREE from "three";
import { easeInOutCubic, lerp, window as windowFn } from "../../core/interpolate";
import type { IPhoneComponent } from "./iphoneData";

export interface ComponentPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export interface IPhoneComponentState extends ComponentPose {
  /** Eased 0..1 fraction of this component's own stage window at time t. */
  assembledFraction: number;
}

export interface IPhoneStateSnapshot {
  t: number;
  /** Overall assembly fraction across all components, in [0, 1]. */
  progress: number;
  components: Record<string, IPhoneComponentState>;
}

// Scratch objects reused across calls to avoid per-frame allocation.
// componentPose is still a pure function of (c, t) -- these are just
// working memory, never read across calls.
const scratchExplodedEuler = new THREE.Euler();
const scratchAssembledEuler = new THREE.Euler();
const scratchExplodedQuat = new THREE.Quaternion();
const scratchAssembledQuat = new THREE.Quaternion();
const scratchResultQuat = new THREE.Quaternion();

/** Eased fraction of a component's own assembly window at time t. */
export function componentAssembledFraction(c: IPhoneComponent, t: number): number {
  return easeInOutCubic(windowFn(t, c.stage.start, c.stage.end));
}

/** Pure pose (position + quaternion) for one component at time t. */
export function componentPose(c: IPhoneComponent, t: number): ComponentPose {
  const s = componentAssembledFraction(c, t);

  const ep = c.exploded.position;
  const ap = c.assembled.position;
  const position: [number, number, number] = [
    lerp(ep[0], ap[0], s),
    lerp(ep[1], ap[1], s),
    lerp(ep[2], ap[2], s),
  ];

  scratchExplodedEuler.set(c.exploded.rotation[0], c.exploded.rotation[1], c.exploded.rotation[2]);
  scratchAssembledEuler.set(c.assembled.rotation[0], c.assembled.rotation[1], c.assembled.rotation[2]);
  scratchExplodedQuat.setFromEuler(scratchExplodedEuler);
  scratchAssembledQuat.setFromEuler(scratchAssembledEuler);
  scratchResultQuat.slerpQuaternions(scratchExplodedQuat, scratchAssembledQuat, s);

  return {
    position,
    quaternion: [scratchResultQuat.x, scratchResultQuat.y, scratchResultQuat.z, scratchResultQuat.w],
  };
}

/** Aggregate, serializable state for getState(t) / tests / HUD. */
export function iphoneState(components: IPhoneComponent[], t: number): IPhoneStateSnapshot {
  const result: Record<string, IPhoneComponentState> = {};
  let sum = 0;
  for (const c of components) {
    const pose = componentPose(c, t);
    const assembledFraction = componentAssembledFraction(c, t);
    result[c.id] = { ...pose, assembledFraction };
    sum += assembledFraction;
  }
  const progress = components.length > 0 ? sum / components.length : 0;

  return { t, progress, components: result };
}
