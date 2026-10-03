// src/experiences/keyframe/types.ts
//
// The data shape of a keyframed scene. A scenario is a JSON file in this
// shape; parseScene turns raw JSON into a SceneDef, sampleScene turns a
// SceneDef and a time into plain poses, and KeyframeExperience draws them.
//
// Times in tracks, events, hover text and camera keys are experience time
// (years, minutes, ...), the same unit as minTime and maxTime.

import type { CameraPreset, TimelineEvent, TimeTick } from "../../core/types";
import type { SliderKnot } from "../../core/mappings";
import type { EasingName } from "./easing";
import type { PrimitiveName } from "./primitives";
import type { TimeFormatName } from "./timeFormats";

export type Vec3 = [number, number, number];
/** sRGB components in [0, 1]. */
export type Rgb = [number, number, number];

/**
 * One keyframe. `ease` shapes the segment that arrives at this key from the
 * previous one; "step" holds the previous value until `t`, then jumps.
 */
export interface Key<V> {
  t: number;
  v: V;
  ease: EasingName;
}

/** Keys sorted by t, at least one. Before the first key the first value holds; after the last, the last. */
export type Track<V> = Key<V>[];

export interface Tracks {
  position: Track<Vec3>;
  /** Euler XYZ in degrees. */
  rotation: Track<Vec3>;
  scale: Track<Vec3>;
  color: Track<Rgb>;
  opacity: Track<number>;
  visible: Track<boolean>;
}

/**
 * Places a Y-aligned primitive along the segment from one sibling object to
 * another (plus offsets). The base sits at `from`; scale.y is the fraction
 * of the way to `to` it reaches, so a fibre can grow out of its anchor.
 */
export interface Between {
  from: string;
  to: string;
  fromOffset: Vec3;
  toOffset: Vec3;
}

export type Shading = "toon" | "flat";

export interface SceneObjectDef {
  id: string;
  /** Parent object id. Transforms and visibility inherit through the parent; opacity does not. */
  parent: string | null;
  primitive: PrimitiveName;
  /** Geometry parameters, every key filled in from the primitive's defaults. */
  params: Record<string, number>;
  shading: Shading;
  /** Ink outline thickness in local units, or 0 for none. */
  outline: number;
  /** Draw order among see-through objects; inner shells first. */
  renderOrder: number;
  /** Id into SceneDef.hover; many objects may share one entry. */
  hover: string | null;
  between: Between | null;
  /** True when some opacity key is below 1, so the material is built see-through. */
  transparent: boolean;
  tracks: Tracks;
}

export interface HoverText {
  /** Experience time from which this text applies. */
  from: number;
  text: string;
}

export interface HoverDef {
  name: string;
  category?: string;
  properties?: Record<string, string | number>;
  /** Sorted by `from`; the last one at or before the current time is shown. The first applies before its `from` too. */
  descriptions: HoverText[];
}

export type MappingSpec =
  | { kind: "linear"; ticks?: TimeTick[] }
  | { kind: "knots"; knots: SliderKnot[] };

export interface SceneDef {
  id: string;
  name: string;
  minTime: number;
  maxTime: number;
  mapping: MappingSpec;
  timeFormat: TimeFormatName;
  /**
   * Real seconds in one unit of experience time (60 for minutes, 31557600
   * for years). Set it when experience time is real elapsed time: the HUD
   * then shows the one-day clock. Leave it out for anything else.
   */
  secondsPerUnit?: number;
  labels: { start: string; end: string };
  baseDurationSeconds: number;
  warpPresets: number[];
  events: TimelineEvent[];
  cameraPresets: CameraPreset[];
  /** Multiplier on the preset camera distance over time; empty means always 1. */
  cameraDistanceScale: Track<number>;
  hover: Record<string, HoverDef>;
  /** Parents come before their children. */
  objects: SceneObjectDef[];
}

/** One object at one time, ready to apply to a Three.js node. */
export interface ObjectPose {
  id: string;
  position: Vec3;
  /** Euler XYZ in degrees. */
  rotation: Vec3;
  scale: Vec3;
  color: Rgb;
  opacity: number;
  /** The visible track, and also false when fully faded or scaled to nothing. */
  visible: boolean;
}

export interface SceneSample {
  time: number;
  /** Same order as SceneDef.objects. */
  objects: ObjectPose[];
}
