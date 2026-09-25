// src/core/types.ts
//
// Shared contract. Frozen after Phase 1. Every experience compiles against
// this file. Changing it requires a message in the team chat and all three
// developers agreeing.
//
// The rule that makes everything else work:
//
//   setTime(t) is a pure function of t. Calling it twice with the same t
//   produces the same scene. It never reads the previous time, never
//   accumulates, never plays an animation. Scrubbing, reverse, jumping, and
//   warping all fall out of this one rule for free.

export type ExperienceId = "iphone" | "solarSystem" | "galaxy" | "universe" | "mock" | "mockLog";

/** Normalized slider and playback parameter in [0, 1]. */
export type TimeParam = number;

export interface TimeTick {
  u: TimeParam;
  label: string;
}

export interface TimeMapping {
  /** Experience time at parameter u. */
  toTime(u: TimeParam): number;
  /** Parameter for an experience time. Clamped to [0, 1]. */
  toParam(time: number): TimeParam;
  /** Labelled positions to draw under the slider. */
  ticks(): TimeTick[];
  /** Human readable time for the HUD, e.g. "0.42", "380,000 years", "9.2 billion years". */
  format(time: number): string;
}

export interface TimeState {
  param: TimeParam;
  time: number;
  isPlaying: boolean;
  direction: 1 | -1;
  playbackSpeed: number;
}

export interface TimeController {
  readonly state: TimeState;

  play(): void;
  pause(): void;
  toggle(): void;
  reverse(): void;

  setTime(time: number): void;
  setParam(u: TimeParam): void;
  setPlaybackSpeed(speed: number): void;
  jumpToEvent(eventId: string): void;
  reset(): void;

  /** Called once per frame by the render loop with real elapsed seconds. */
  tick(dtSeconds: number): void;

  /** The experience whose mapping and duration drive playback. */
  attach(experience: FourDExperience): void;

  /** Notifies UI and the attached experience. Returns an unsubscribe. */
  subscribe(listener: (state: TimeState) => void): () => void;
}

export interface TimelineEvent {
  id: string;
  /** Experience time at which this event starts. Events are sorted by time. */
  time: number;
  title: string;
  /** Short phrase shown under the title, e.g. "~200 million years after the Big Bang". */
  when: string;
  description: string;
  keyPoints: string[];
  category?: string;
}

export interface ObjectMetadata {
  id: string;
  name: string;
  description: string;
  category?: string;
  properties?: Record<string, string | number>;
}

export interface FilterContext {
  experience: FourDExperience;
  /** Shader uniforms the experience exposes for filters to drive. */
  uniforms: Record<string, { value: unknown }>;
  /** Named Three.js objects filters may show, hide, or restyle. */
  objects: Record<string, import("three").Object3D>;
}

export interface VisualizationFilter {
  id: string;
  name: string;
  /** Filters in the same group are mutually exclusive (radio). Ungrouped filters toggle. */
  group?: string;
  apply(context: FilterContext): void;
  reset?(context: FilterContext): void;
}

export type CameraMode = "orbit" | "free" | "follow" | "overview";

export interface CameraPreset {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

/** Handed to an experience when it is mounted. Owned by the renderer lane. */
export interface SceneContext {
  scene: import("three").Scene;
  camera: import("three").PerspectiveCamera;
  renderer: import("three").WebGLRenderer;
  /** Makes an object hoverable and selectable under the given metadata id. */
  registerHoverable(object: import("three").Object3D, id: string): void;
  unregisterHoverable(object: import("three").Object3D): void;
}

export interface FourDExperience {
  id: ExperienceId;
  name: string;

  minTime: number;
  maxTime: number;
  mapping: TimeMapping;
  /** Real seconds for one full pass at 1x. iPhone 10, galaxy 30, universe 60. */
  baseDurationSeconds: number;
  /**
   * Time warp values offered in the UI for this experience. Each is a
   * multiplier on the 1x rate: a full pass takes baseDurationSeconds / w real
   * seconds. Presets faster than a 1 s pass are hidden (see core/warp.ts).
   */
  warpPresets: number[];
  /** Labels at the two ends of the slider. */
  labels: { start: string; end: string };
  /** Sorted timeline events. Drives the "What's happening?" panel. */
  events: TimelineEvent[];

  /** Add objects to the scene. Called once when the experience becomes active. */
  mount(context: SceneContext): void;
  /** Reconstruct the scene at time t. Pure. Idempotent. */
  setTime(time: number): void;
  /** Plain data describing the world at time t. Useful for tests and the HUD. */
  getState(time: number): unknown;
  getCurrentEvent(time: number): TimelineEvent | null;
  getHoveredObject(id: string): ObjectMetadata | null;
  getAvailableFilters(): VisualizationFilter[];
  getCameraPresets(): CameraPreset[];

  reset(): void;
  dispose(): void;
}
