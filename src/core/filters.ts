// src/core/filters.ts
//
// The filter state reducer. The shell owns which filters are on; an
// experience only stores the state and renders under it in setTime.
//
// Ungrouped filters flip. Filters sharing a group are radio options: picking
// one turns the rest of its group off, and picking the one already on keeps
// it on, so a group always has exactly one option on.

import type { FilterState, VisualizationFilter } from "./types";

export function defaultFilterState(filters: readonly VisualizationFilter[]): FilterState {
  return Object.fromEntries(filters.map((f) => [f.id, f.defaultOn]));
}

/** The next state after the viewer presses filter `id`. Returns `state` itself when nothing changes. */
export function toggleFilter(filters: readonly VisualizationFilter[], state: FilterState, id: string): FilterState {
  const target = filters.find((f) => f.id === id);
  if (!target) return state;
  if (target.group === undefined) return { ...state, [id]: !state[id] };
  if (state[id]) return state;
  const next: Record<string, boolean> = { ...state };
  for (const f of filters) {
    if (f.group === target.group) next[f.id] = f.id === id;
  }
  return next;
}

/** True when every filter is at its default, so the Filters button needs no "changed" mark. */
export function isDefaultFilterState(filters: readonly VisualizationFilter[], state: FilterState): boolean {
  return filters.every((f) => state[f.id] === f.defaultOn);
}
