// src/core/Timeline.ts

import type { TimelineEvent } from "./types";

/** The last event whose time is <= t, or null before the first. */
export function eventAt(events: TimelineEvent[], t: number): TimelineEvent | null {
  let current: TimelineEvent | null = null;
  for (const event of events) {
    if (event.time <= t) {
      current = event;
    } else {
      break;
    }
  }
  return current;
}
