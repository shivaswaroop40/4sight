// src/ui/runtime.ts
//
// App-wide singletons and a tiny store for the two pieces of UI state that
// live outside the TimeController: the active experience and the hovered
// object. Components subscribe to exactly the fields they render.

import { useSyncExternalStore } from "react";
import { TimeController } from "../core/TimeController";
import type { ExperienceId, TimeState } from "../core/types";
import type { SceneManager } from "../renderer/SceneManager";

export const controller = new TimeController();

/** Set by App once the renderer exists. */
export const runtime: { manager: SceneManager | null } = { manager: null };

interface UiState {
  experienceId: ExperienceId | null;
  hoveredId: string | null;
}

let ui: UiState = { experienceId: null, hoveredId: null };
const uiListeners = new Set<() => void>();

export function setUi(patch: Partial<UiState>): void {
  const next = { ...ui, ...patch };
  if (next.experienceId === ui.experienceId && next.hoveredId === ui.hoveredId) return;
  ui = next;
  for (const l of uiListeners) l();
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
  (window as unknown as { __4sight: unknown }).__4sight = { controller, runtime };
}
