// src/ui/urlSync.ts
//
// Keeps the address bar on the current moment (?x=<id>&u=<u>) with
// history.replaceState, so reloading or sharing the URL lands on the same
// frame. Writes are throttled (trailing, 250 ms) and never happen while
// playing: playback would otherwise write every frame. Pausing, scrubbing
// while paused, keys and event jumps all settle into a paused state, which
// schedules a write. flush() writes now, for the moments the shell knows
// are final: an experience switch, a flag click, the end of a scrub.

import { formatMoment, type Moment } from "../core/moment";
import type { TimeController } from "../core/types";

const THROTTLE_MS = 250;

export interface UrlSync {
  flush(): void;
  dispose(): void;
}

export function startUrlSync(controller: TimeController, current: () => Moment | null): UrlSync {
  let timer: number | null = null;

  const cancel = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const write = () => {
    cancel();
    const moment = current();
    if (!moment) return;
    const href = formatMoment(window.location.href, moment);
    if (href !== window.location.href) window.history.replaceState(window.history.state, "", href);
  };

  const unsubscribe = controller.subscribe((state) => {
    if (state.isPlaying) cancel();
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
