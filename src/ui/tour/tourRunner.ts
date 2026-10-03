// src/ui/tour/tourRunner.ts
//
// Side effects of the guided tour. dispatchTour runs tourReducer, leaves the
// old phase (cancelling its frame or timer) and enters the new one:
//
//   reading     lands on the event's exact time, writes the URL, and holds
//               for a reading time sized to the title and description.
//   travelling  tweens u forward to the next event, one setParam per frame.
//   done        shows "Tour complete" for a moment, then goes idle.
//
// The runner only drives the TimeController; experiences never know a tour
// is running. While one runs it watches for the viewer taking over: any
// controller change it did not cause (scrub, play, a flag, reset, nudges)
// ends the tour, except flipping direction or warp, which leave u alone.
// Picking another experience ends it too. Esc and T go through useShortcuts.

import type { FourDExperience, TimeState, TimelineEvent } from "../../core/types";
import { controller, getUi, runtime, setUi, subscribeUi } from "../runtime";
import { easeInOutCubic } from "../../core/interpolate";
import { DONE_MS, holdMs, isTouring, tourReducer, travelMs, type TourAction, type TourState } from "./tourMachine";

let leavePhase: (() => void) | null = null;
let stopWatching: (() => void) | null = null;
/** True while the runner itself calls the controller, so its own changes do not read as the viewer's. */
let driving = false;

function drive(change: () => void): void {
  driving = true;
  try {
    change();
  } finally {
    driving = false;
  }
}

export function dispatchTour(action: TourAction): void {
  const { tour, experience } = getUi();
  const next = tourReducer(tour, action, experience?.events.length ?? 0);
  if (next === tour) return;
  leavePhase?.();
  leavePhase = null;
  if (isTouring(next) && !stopWatching && experience) stopWatching = watchForTakeover(experience);
  if (!isTouring(next)) {
    stopWatching?.();
    stopWatching = null;
  }
  setUi({ tour: next });
  leavePhase = enter(next, experience);
}

function enter(state: TourState, experience: FourDExperience | null): (() => void) | null {
  switch (state.phase) {
    case "idle":
      settleUrl();
      return null;
    case "done":
      settleUrl();
      return after(DONE_MS, () => dispatchTour({ type: "exit" }));
    case "travelling":
      return experience && travel(experience, experience.events[state.index]);
    case "reading":
      return experience && hold(experience.events[state.index]);
  }
}

/** Playback already keeps the URL off; anything else gets the moment the tour stopped on. */
function settleUrl(): void {
  if (!controller.state.isPlaying) runtime.urlSync?.flush();
}

function after(ms: number, then: () => void): () => void {
  const timer = window.setTimeout(then, ms);
  return () => window.clearTimeout(timer);
}

function travel(experience: FourDExperience, event: TimelineEvent): () => void {
  const from = controller.state.param;
  const to = experience.mapping.toParam(event.time);
  const ms = travelMs(from, to);
  let start: number | null = null;
  const step = (now: number) => {
    start ??= now;
    const x = (now - start) / ms;
    if (x >= 1) {
      dispatchTour({ type: "arrived" });
      return;
    }
    drive(() => controller.setParam(from + (to - from) * easeInOutCubic(x)));
    frame = requestAnimationFrame(step);
  };
  let frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

function hold(event: TimelineEvent): () => void {
  drive(() => {
    controller.pause();
    controller.setTime(event.time);
  });
  runtime.urlSync?.flush();
  return after(holdMs(event), () => dispatchTour({ type: "doneReading" }));
}

function watchForTakeover(experience: FourDExperience): () => void {
  let last: TimeState = controller.state;
  const stopTime = controller.subscribe((state) => {
    const prev = last;
    last = state;
    if (driving) return;
    const settingOnly =
      state.param === prev.param &&
      !state.isPlaying &&
      (state.direction !== prev.direction || state.playbackSpeed !== prev.playbackSpeed);
    if (!settingOnly) dispatchTour({ type: "exit" });
  });
  const stopUi = subscribeUi(() => {
    const { experience: current, load } = getUi();
    if (current !== experience || load.status === "loading") dispatchTour({ type: "exit" });
  });
  return () => {
    stopTime();
    stopUi();
  };
}
