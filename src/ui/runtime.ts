// src/ui/runtime.ts
//
// App-wide singletons and a tiny store for the UI state that lives outside
// the TimeController: the mounted experience, the state of the latest
// experience request, the filters it renders under, the hovered object,
// whether the gallery is open, and the toast in the status rail.
// Components subscribe to exactly the fields they render.

import { useSyncExternalStore } from "react";
import { defaultFilterState, toggleFilter } from "../core/filters";
import { formatMoment, type Moment } from "../core/moment";
import { TimeController } from "../core/TimeController";
import type { ExperienceId, FilterState, FourDExperience, TimeState } from "../core/types";
import { loadExperience } from "../experiences/index";
import type { SceneManager } from "../renderer/SceneManager";
import type { UrlSync } from "./urlSync";

export const controller = new TimeController();

/** Set by App once the renderer exists. */
export const runtime: { manager: SceneManager | null; urlSync: UrlSync | null } = { manager: null, urlSync: null };

/** The latest experience request. "ready" means the mounted experience is the one asked for. */
export type LoadState =
  | { status: "loading"; id: ExperienceId }
  | { status: "ready" }
  | { status: "failed"; id: ExperienceId; message: string };

export type Toast = { kind: "copied" } | { kind: "copyFailed"; url: string };

interface UiState {
  experience: FourDExperience | null;
  load: LoadState;
  /** The filter state the mounted experience renders under. Reset to its defaults on every switch. */
  filters: FilterState;
  hoveredId: string | null;
  galleryOpen: boolean;
  toast: Toast | null;
}

let ui: UiState = {
  experience: null,
  load: { status: "ready" },
  filters: {},
  hoveredId: null,
  galleryOpen: false,
  toast: null,
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

function subscribeUi(listener: () => void): () => void {
  uiListeners.add(listener);
  return () => {
    uiListeners.delete(listener);
  };
}

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(subscribeUi, () => select(ui));
}

let latestRequest = 0;
const failedIds = new Set<ExperienceId>();

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
 * Asking again for an experience that failed reloads the page on it: the
 * browser remembers a failed module fetch for the life of the page, so a
 * second import() of the same chunk fails without touching the network.
 */
export async function showExperience(id: ExperienceId, u = 0): Promise<void> {
  const request = ++latestRequest;
  if (ui.experience?.id === id) {
    setUi({ load: { status: "ready" } });
    return;
  }
  if (failedIds.has(id)) {
    window.location.replace(formatMoment(window.location.href, { id, u }));
    return;
  }
  setUi({ load: { status: "loading", id } });
  try {
    const experience = await loadExperience(id);
    const manager = runtime.manager;
    if (request !== latestRequest || !manager) return;
    const filters = defaultFilterState(experience.getAvailableFilters());
    manager.mount(experience, filters, ui.experience !== null);
    if (u > 0) controller.setParam(u);
    setUi({ experience, filters, load: { status: "ready" }, hoveredId: null });
  } catch (error) {
    failedIds.add(id);
    if (request !== latestRequest) return;
    const message = error instanceof Error ? error.message : String(error);
    setUi({ load: { status: "failed", id, message } });
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
