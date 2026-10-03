// src/ui/tour/tourMachine.ts
//
// The guided tour as a pure state machine, plus its timing rules. A tour
// visits every event in order: it holds on event 0 (starting jumps there)
// for a reading time, then travels forward to the next event and holds
// there, until the last one has been read and the tour is done. Side
// effects (the travel tween, timers) live in tourRunner.ts, which
// dispatches these actions.

export type TourState =
  | { phase: "idle" }
  | { phase: "travelling"; index: number }
  | { phase: "reading"; index: number }
  | { phase: "done" };

export type TourAction = { type: "start" } | { type: "arrived" } | { type: "doneReading" } | { type: "next" } | { type: "exit" };

export const TOUR_IDLE: TourState = { phase: "idle" };

/** On an event or on the way to one; "done" is only the closing message. */
export function isTouring(state: TourState): boolean {
  return state.phase === "travelling" || state.phase === "reading";
}

/** Returns `state` itself when the action does not apply, so callers can skip work on identity. */
export function tourReducer(state: TourState, action: TourAction, eventCount: number): TourState {
  switch (action.type) {
    case "start":
      if (isTouring(state) || eventCount === 0) return state;
      return { phase: "reading", index: 0 };
    case "arrived":
      return state.phase === "travelling" ? { phase: "reading", index: state.index } : state;
    case "doneReading":
      return state.phase === "reading" ? advance(state.index, eventCount) : state;
    case "next":
      if (state.phase === "travelling") return { phase: "reading", index: state.index };
      return state.phase === "reading" ? advance(state.index, eventCount) : state;
    case "exit":
      return state.phase === "idle" ? state : TOUR_IDLE;
  }
}

function advance(index: number, eventCount: number): TourState {
  return index + 1 < eventCount ? { phase: "travelling", index: index + 1 } : { phase: "done" };
}

/** Close to the iPhone's 1x pace (a 10 s pass), so gaps between events read as a glide, not a jump. */
const TRAVEL_MS_PER_PASS = 12_000;
const MIN_TRAVEL_MS = 1_000;
const MAX_TRAVEL_MS = 4_000;

export function travelMs(fromU: number, toU: number): number {
  return Math.min(MAX_TRAVEL_MS, Math.max(MIN_TRAVEL_MS, Math.abs(toU - fromU) * TRAVEL_MS_PER_PASS));
}

/** How long the tour holds on an event: a 1.5 s look at the scene, then its title and description at 200 words a minute. */
export function holdMs(event: { title: string; description: string }): number {
  const words = `${event.title} ${event.description}`.split(/\s+/).filter(Boolean).length;
  return 1500 + words * 300;
}

/** How long "Tour complete" stays up. */
export const DONE_MS = 2500;

