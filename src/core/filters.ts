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
  const on = isFilterOn(filters, state, id);
  if (target.group === undefined) return { ...state, [id]: !on };
  if (on) return state;
  const next: Record<string, boolean> = { ...state };
  for (const f of filters) {
    if (f.group === target.group) next[f.id] = f.id === id;
  }
  return next;
}

/** True when every filter is at its default, so the Filters button needs no "changed" mark. */
export function isDefaultFilterState(filters: readonly VisualizationFilter[], state: FilterState): boolean {
  return filters.every((f) => isFilterOn(filters, state, f.id) === f.defaultOn);
}

/** Whether filter `id` is on. A state that leaves it out means its default. */
export function isFilterOn(filters: readonly VisualizationFilter[], state: FilterState, id: string): boolean {
  return state[id] ?? filters.find((f) => f.id === id)?.defaultOn ?? false;
}

/** What breaks the filter rules, one sentence each: ids are unique and a group has exactly one default. */
export function filterProblems(filters: readonly VisualizationFilter[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const defaults = new Map<string, number>();
  for (const f of filters) {
    if (ids.has(f.id)) problems.push(`Filter id "${f.id}" is used twice.`);
    ids.add(f.id);
    if (f.group !== undefined) defaults.set(f.group, (defaults.get(f.group) ?? 0) + (f.defaultOn ? 1 : 0));
  }
  for (const [group, count] of defaults) {
    if (count !== 1) problems.push(`Filter group "${group}" has ${count} options on by default, not 1.`);
  }
  return problems;
}
