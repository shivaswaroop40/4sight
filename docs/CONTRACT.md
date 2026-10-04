# Shared contract

This is the one thing all three developers build together in Phase 1 and then freeze. It lives in `src/core/types.ts`. After the freeze, changing it requires a message in the team chat and all three developers agreeing, because every lane compiles against it.

The rule that makes everything else work:

> The scene is a pure function of `(t, filter state)`. `setTime(t)` renders the scene for `t` under the filter state last passed to `filters.set`. Calling it twice with the same `t` and the same filter state produces the same scene. It never reads the previous time, never accumulates, never plays an animation. Scrubbing, reverse, jumping, and warping all fall out of this one rule for free.

## Time model

Two clocks exist and the contract names both.

**Experience time** is what the user reads. Seconds of assembly for the iPhone, years for the solar system. Each experience declares `minTime` and `maxTime` in its own units.

**Timeline parameter** `u` is a number in `[0, 1]`. The slider, the playback loop, and the time warp all live here. Each experience supplies a `TimeMapping` that converts between `u` and experience time. The iPhone uses a linear mapping. The solar system uses a piecewise logarithmic mapping so that the first hundred thousand years and the last four billion years each get readable slider width.

Playback advances `u`, not experience time:

```text
du/dt_real = direction * playbackSpeed / baseDurationSeconds
```

`baseDurationSeconds` is the real time one full pass takes at 1x. This keeps the TimeController ignorant of what it drives, keeps the solar system playing at a perceptually even pace across many orders of magnitude, and makes 10,000x safe (the loop clamps `u` to `[0, 1]` and pauses at the boundary). The HUD shows the effective rate in experience units at the current position, for example "1x = 230 million years per second here", by reading the mapping's derivative.

## Types

```ts
// src/core/types.ts

export type ExperienceId = "iphone" | "solarSystem" | "galaxy" | "universe" | "mock";

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
  /** Short phrase shown under the title, e.g. "~3 million years after collapse". */
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

/** Which filters are on, by id. View state owned by the shell. Read it with isFilterOn (core/filters.ts). */
export type FilterState = Readonly<Record<string, boolean>>;

/** An experience's filters. Offering filters and taking their state come together. */
export interface ExperienceFilters {
  /** Display order. Ids are unique; a group has exactly one option with defaultOn (see filterProblems). */
  readonly options: readonly VisualizationFilter[];
  /**
   * Stores the state. It does not render: the shell calls setTime(t) right
   * after, and setTime(t) renders the scene for t under the stored state. It
   * may flip pipeline flags (transparent, depthWrite, raycast) when a value
   * changes, but must not depend on time.
   */
  set(state: FilterState): void;
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
  /** Real seconds for one full pass at 1x. iPhone 10, solar system 40. */
  baseDurationSeconds: number;
  /** Time warp values offered in the UI for this experience. */
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
  /** The filters this experience offers and how it takes their state. Leave unset when it has none. */
  filters?: ExperienceFilters;
  getCameraPresets(): CameraPreset[];
  /**
   * Optional multiplier on the preset camera's distance at time t, for scenes
   * that shrink or grow over time. 1 keeps the authored framing. It applies
   * after a preset, until the viewer drags, zooms, or follows an object.
   */
  cameraDistanceScale?(time: number): number;
  /**
   * Optional width over height of what the presets frame at time t. Presets
   * are authored on a 1440x900 screen; on a narrower one the camera fits a
   * subject this wide into the stage. Leave it out for a subject about as
   * wide as it is tall (1.1); return more while the scene spreads sideways.
   */
  cameraSubjectAspect?(time: number): number;

  reset(): void;
  dispose(): void;
}
```

## Filters

A filter changes how the scene is drawn, never what happens in it: hide the gas and dust, turn the casing to X-ray. The shell owns which filters are on. The experience declares its filters and renders under whatever state it is handed.

- `filters` is one optional member, so an experience either offers filters and takes their state, or has neither. Leave it out when there are none.
- `filters.options` lists them in display order. Keep it the same array for the life of the experience. Ids are unique.
- Ungrouped filters are switches. Filters that share a `group` are radio options, and the group name is shown as their heading. Exactly one option in a group has `defaultOn: true`. In development the shell refuses to mount an experience that breaks these rules (`filterProblems`), and a test checks every registered experience.
- `filters.set(state)` only stores the state. The shell then calls `setTime(t)` with the current time, and `setTime` draws the scene for `t` under that state. Toggling a filter while paused updates the frame at once, and scrubbing keeps it applied.
- `set` may flip pipeline flags such as `transparent`, `depthWrite` or a mesh's `raycast` when a value changes, but must not depend on time. Opacity, visibility and uniforms that vary with `t` are set in `setTime`.
- Read the state with `isFilterOn(options, state, id)`. A state that leaves a filter out means its default.
- On mount the shell passes the defaults (`defaultFilterState`) before the first `setTime`. Switching experiences resets to the new experience's defaults.

```ts
// src/core/filters.ts
export function defaultFilterState(filters: readonly VisualizationFilter[]): FilterState;
/** Ungrouped: flip. Grouped: select id and clear the rest of its group; picking the selected option keeps it on. */
export function toggleFilter(filters: readonly VisualizationFilter[], state: FilterState, id: string): FilterState;
export function isDefaultFilterState(filters: readonly VisualizationFilter[], state: FilterState): boolean;
/** Whether filter `id` is on. A state that leaves it out means its default. */
export function isFilterOn(filters: readonly VisualizationFilter[], state: FilterState, id: string): boolean;
/** What breaks the filter rules, one sentence each. Empty when the filters are valid. */
export function filterProblems(filters: readonly VisualizationFilter[]): string[];
```

## Helpers Shiv ships alongside the types

These live in `src/core/` and every experience uses them instead of writing its own.

```ts
// src/core/mappings.ts
export function linearMapping(min: number, max: number, format: (t: number) => string, ticks?: TimeTick[]): TimeMapping;
/** Knots are evenly spaced on the slider. Time is log-interpolated inside each segment. */
export function piecewiseLogMapping(knots: { time: number; label: string }[], format: (t: number) => string): TimeMapping;

// src/core/interpolate.ts
export function lerp(a: number, b: number, s: number): number;
export function smoothstep(edge0: number, edge1: number, x: number): number;
export function easeInOutCubic(s: number): number;
/** 0 before start, 1 after end, eased in between. The building block for staged assembly. */
export function window(t: number, start: number, end: number): number;

// src/core/Timeline.ts
/** The last event whose time is <= t, or null before the first. */
export function eventAt(events: TimelineEvent[], t: number): TimelineEvent | null;
```

## The mock experience

Phase 1 ends when this runs and every control behaves.

```ts
export const mockExperience: FourDExperience = {
  id: "mock",
  name: "Mock",
  minTime: 0,
  maxTime: 1,
  mapping: linearMapping(0, 1, (t) => t.toFixed(2)),
  baseDurationSeconds: 5,
  warpPresets: [0.1, 0.5, 1, 2, 5],
  labels: { start: "A", end: "C" },
  events: [
    { id: "a", time: 0, title: "At A", when: "t = 0", description: "", keyPoints: [] },
    { id: "b", time: 0.5, title: "At B", when: "t = 0.5", description: "", keyPoints: [] },
    { id: "c", time: 1, title: "At C", when: "t = 1", description: "", keyPoints: [] },
  ],
  mount(ctx) { /* add one cube, register it as hoverable "cube" */ },
  setTime(t) { /* cube.position = A→B for t in [0, 0.5], B→C for t in [0.5, 1] */ },
  getState(t) { return { position: /* same math */ }; },
  getCurrentEvent(t) { return eventAt(this.events, t); },
  getHoveredObject(id) { return id === "cube" ? { id, name: "Cube", description: "Test object" } : null; },
  getCameraPresets() { return []; },
  reset() {},
  dispose() {},
};
```

Exit checks for Phase 1, all three developers watching:

1. Drag the slider to 0, 0.5, 1. The cube is at A, B, C.
2. Press play. The cube travels A to C in 5 seconds. Press reverse. It travels back.
3. Set warp to 5x. The trip takes 1 second. Set 0.1x. It takes 50 seconds.
4. Drag while playing. Release. Playback continues from where you released.
5. The "What's happening?" panel reads "At A", "At B", "At C" as you pass the events.
6. Hover the cube. A tooltip appears near the cursor reading "Cube".

## Registering an experience

`src/experiences/index.ts` holds one light entry per experience. The entry carries what the gallery shows without loading the experience, and a dynamic import that loads it on demand, so each experience is its own chunk.

```ts
export interface ExperienceEntry {
  id: ExperienceId;
  name: string;
  /** One line for the gallery card, under ~60 characters. */
  tagline: string;
  /** Length of the span of time the experience shows, in real seconds. Orders the gallery. */
  spanSeconds: number;
  /** Dynamic import, so each experience is its own chunk. */
  load: () => Promise<FourDExperience>;
}

// Example:
{
  id: "solarSystem",
  name: "Solar System",
  tagline: "A cloud of dust becomes the Sun and eight planets",
  spanSeconds: 4.6e9 * YEAR_SECONDS,
  load: () => import("./solar-system/SolarSystemExperience").then((m) => m.solarSystemExperience),
}
```

Never import an experience module statically from shell code. A static import pulls it into the main chunk.
