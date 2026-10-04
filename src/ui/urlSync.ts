// src/ui/urlSync.ts
//
// Keeps the address bar on the current moment (?x=<id>&u=<u>) with
// history.replaceState, so reloading or sharing the URL lands on the same
// frame. Writes are throttled (trailing) and never happen while playing or
// while `held()` says something else moves u every frame (tour travel, a
// video export); playback would otherwise write every frame. Both are
// checked again when the write lands, since an export can start between a
// pause and its write. Pausing, scrubbing while paused, keys and event
// jumps all settle into a paused state, which schedules a write. flush()
// writes at once, for moments the caller knows are final.

import { formatMoment, type Moment } from "../core/moment";
import type { TimeController } from "../core/types";

/** Safari throws past 100 replaceState calls in 30 s; one write per 350 ms stays under that. */
const THROTTLE_MS = 350;

export interface UrlSync {
  flush(): void;
  dispose(): void;
}

export function startUrlSync(
  controller: TimeController,
  current: () => Moment | null,
  held: () => boolean,
): UrlSync {
  let timer: number | null = null;

  const cancel = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const write = () => {
    cancel();
    if (controller.state.isPlaying || held()) return;
    const moment = current();
    if (!moment) return;
    const href = formatMoment(window.location.href, moment);
    if (href === window.location.href) return;
    try {
      window.history.replaceState(window.history.state, "", href);
    } catch {
      // A rate limit (Safari's SecurityError) only costs this write; the next pause writes again.
    }
  };

  const unsubscribe = controller.subscribe((state) => {
    if (state.isPlaying || held()) cancel();
    else if (timer === null) timer = window.setTimeout(write, THROTTLE_MS);
  });

  return {
    flush: write,
    dispose: () => {
      cancel();
      unsubscribe();
    },
  };
}
