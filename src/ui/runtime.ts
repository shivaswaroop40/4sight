// src/ui/runtime.ts
//
// App-wide singletons and a tiny store for the UI state that lives outside
// the TimeController: the mounted experience, the state of the latest
// experience request, the filters it renders under, the hovered object,
// what the camera is following, whether the gallery is open, the toast in
// the status rail, the guided tour's state, and a video export's progress.
// Components subscribe to exactly the fields they render.

import { useSyncExternalStore } from "react";
import { defaultFilterState, toggleFilter } from "../core/filters";
import { formatMoment, type Moment } from "../core/moment";
import { TimeController } from "../core/TimeController";
import type { ExperienceId, FilterState, FourDExperience, TimeState } from "../core/types";
import { loadExperience } from "../experiences/index";
import type { ExportPlan } from "../renderer/exportPlan";
import type { CameraView, SceneManager } from "../renderer/SceneManager";
import { TOUR_IDLE, type TourState } from "./tour/tourMachine";
import type { UrlSync } from "./urlSync";

export const controller = new TimeController();

/** Set by App once the renderer exists. */
export const runtime: { manager: SceneManager | null; urlSync: UrlSync | null } = { manager: null, urlSync: null };

/**
 * The latest experience request. "ready" means the mounted experience is the
 * one asked for. `u` is the moment it was asked for, so a retry opens there.
 */
export type LoadState =
  | { status: "loading"; id: ExperienceId; u: number }
  | { status: "ready" }
  | { status: "failed"; id: ExperienceId; u: number; message: string };

export type Toast = { kind: "copied" } | { kind: "copyFailed"; url: string } | { kind: "saved"; fileName: string };

/** A video export. Rendering counts frames up to plan.frames; at plan.frames the file is being finished. */
export type ExportState =
  | { phase: "idle" }
  | { phase: "rendering"; frame: number; plan: ExportPlan }
  | { phase: "failed"; message: string };

export const EXPORT_IDLE: ExportState = { phase: "idle" };

interface UiState {
  experience: FourDExperience | null;
  load: LoadState;
  /** The filter state the mounted experience renders under. Reset to its defaults on every switch. */
  filters: FilterState;
  hoveredId: string | null;
  /** Camera state, not time state: scrubbing, playback and the tour leave it alone. */
  camera: CameraView;
  galleryOpen: boolean;
  toast: Toast | null;
  tour: TourState;
  exporting: ExportState;
  /** True once this browser is known to encode a video codec export can use. */
  exportable: boolean;
}

let ui: UiState = {
  experience: null,
  load: { status: "ready" },
  filters: {},
  hoveredId: null,
  camera: { mode: "orbit" },
  galleryOpen: false,
  toast: null,
  tour: TOUR_IDLE,
  exporting: EXPORT_IDLE,
  exportable: false,
};
const uiListeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>): void {
  const next = { ...ui, ...patch };
  const keys = Object.keys(next) as (keyof UiState)[];
  if (keys.every((k) => Object.is(next[k], ui[k]))) return;
  ui = next;
  for (const l of uiListeners) l();
}

export function getUi(): UiState {
  return ui;
}

export function subscribeUi(listener: () => void): () => void {
  uiListeners.add(listener);
  return () => {
    uiListeners.delete(listener);
  };
}

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(subscribeUi, () => select(ui));
}

let latestRequest = 0;

/** The mounted experience and the exact current u. */
export function currentMoment(): Moment | null {
  const experience = runtime.manager?.current;
  return experience ? { id: experience.id, u: controller.state.param } : null;
}

/**
 * Loads an experience's chunk and mounts it at u, paused. The current
 * experience keeps running while the chunk downloads, and only the latest
 * request may mount, so picking A then B quickly ends on B.
 *
 * Asking again for the experience that just failed reloads the page on it:
 * the browser remembers a failed module fetch for the life of the page, so
 * a second import() of the same chunk fails without touching the network.
 */
export async function showExperience(id: ExperienceId, u = 0): Promise<void> {
  const request = ++latestRequest;
  if (ui.experience?.id === id) {
    setUi({ load: { status: "ready" } });
    return;
  }
  if (ui.load.status === "failed" && ui.load.id === id) {
    window.location.replace(formatMoment(window.location.href, { id, u }));
    return;
  }
  setUi({ load: { status: "loading", id, u } });
  try {
    const experience = await loadExperience(id);
    const manager = runtime.manager;
    if (request !== latestRequest || !manager) return;
    const filters = defaultFilterState(experience.getAvailableFilters());
    manager.mount(experience, filters, ui.experience !== null);
    if (u > 0) controller.setParam(u);
    setUi({ experience, filters, load: { status: "ready" }, hoveredId: null });
  } catch (error) {
    if (request !== latestRequest) return;
    const message = error instanceof Error ? error.message : String(error);
    setUi({ load: { status: "failed", id, u, message } });
  }
}

/** Applies the viewer pressing filter `id`: the scene re-renders at the current moment, paused or not. */
export function pressFilter(id: string): void {
  const experience = ui.experience;
  if (!experience) return;
  const filters = toggleFilter(experience.getAvailableFilters(), ui.filters, id);
  if (filters === ui.filters) return;
  runtime.manager?.setFilters(filters);
  setUi({ filters });
}

function subscribeTime(listener: () => void): () => void {
  return controller.subscribe(listener);
}

/**
 * Re-renders only when the selected value changes (Object.is). Select
 * primitives, e.g. (s) => s.isPlaying, never the whole state.
 */
export function useTime<T>(select: (s: TimeState) => T): T {
  return useSyncExternalStore(subscribeTime, () => select(controller.state));
}

// Dev-only handle for debugging in the console: window.__4sight.controller.state
if (import.meta.env.DEV) {
  (window as unknown as { __4sight: unknown }).__4sight = { controller, runtime, getUi };
}
