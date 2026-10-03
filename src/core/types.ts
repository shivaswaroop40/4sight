// src/core/types.ts
//
// Shared contract. Every experience compiles against this file, so a change
// here is a change for every lane: update docs/CONTRACT.md with it.
//
// The rule that makes everything else work:
//
//   The scene is a pure function of (t, filter state). setTime(t) renders
//   the scene for t under the filter state last passed to setFilters.
//   Calling it twice with the same t and the same filter state produces the
//   same scene. It never reads the previous time, never accumulates, never
//   plays an animation. Scrubbing, reverse, jumping, and warping all fall
//   out of this one rule for free.

export type ExperienceId = "iphone" | "solarSystem" | "galaxy" | "universe" | "mock" | "mockLog" | "mitosis" | "city" | "heart" | "tree" | "continents";

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

  /** Lands on exactly `time` (clamped to the span), so the event that starts at `time` is current. */
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

export interface VisualizationFilter {
  id: string;
  name: string;
  /** Filters sharing a group are radio options: exactly one is on. Ungrouped filters toggle. */
  group?: string;
  /** On when the experience mounts. In a group, exactly one option defaults on. */
  defaultOn: boolean;
  /** One line shown as the control's hint. */
  description?: string;
}

/** Which filters are on, by id. View state owned by the shell. */
export type FilterState = Readonly<Record<string, boolean>>;

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
  /**
   * Set when experience time is real elapsed time: the span from minTime to
   * maxTime, in seconds. The UI then shows "If <span> fit in one day, now is
   * 11:58:43 pm". Leave unset when time is not a duration (iPhone assembly).
   */
  elapsedSpanSeconds?: number;
  /** Labels at the two ends of the slider. */
  labels: { start: string; end: string };
  /** Sorted timeline events. Drives the "What's happening?" panel. */
  events: TimelineEvent[];

  /** Add objects to the scene. Called once when the experience becomes active. */
  mount(context: SceneContext): void;
  /** Reconstruct the scene at time t under the stored filter state. Pure. Idempotent. */
  setTime(time: number): void;
  /** Plain data describing the world at time t. Useful for tests and the HUD. */
  getState(time: number): unknown;
  getCurrentEvent(time: number): TimelineEvent | null;
  getHoveredObject(id: string): ObjectMetadata | null;
  getAvailableFilters(): VisualizationFilter[];
  /**
   * Stores the filter state. Required when getAvailableFilters() returns any.
   * It does not render: the shell calls setTime(t) right after, and setTime(t)
   * renders the scene for t under the stored filter state.
   */
  setFilters?(state: FilterState): void;
  getCameraPresets(): CameraPreset[];
  /**
   * Optional multiplier on the preset camera's distance at time t, for scenes
   * that shrink or grow over time. 1 keeps the authored framing. It applies
   * after a preset, until the viewer drags, zooms, or follows an object.
   */
  cameraDistanceScale?(time: number): number;

  reset(): void;
  dispose(): void;
}
