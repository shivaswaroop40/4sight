import { describe, expect, it } from "vitest";
import { holdMs, isTouring, tourReducer, travelMs, type TourAction, type TourState } from "./tourMachine";

const idle: TourState = { phase: "idle" };
const done: TourState = { phase: "done" };
const travelling = (index: number): TourState => ({ phase: "travelling", index });
const reading = (index: number): TourState => ({ phase: "reading", index });

/** Runs actions in order over a tour of `eventCount` events. */
function run(eventCount: number, actions: TourAction["type"][], from: TourState = idle): TourState {
  return actions.reduce((s, type) => tourReducer(s, { type } as TourAction, eventCount), from);
}

describe("tourReducer", () => {
  it("starts by holding on the first event", () => {
    expect(tourReducer(idle, { type: "start" }, 3)).toEqual(reading(0));
  });

  it("restarts from the first event once done", () => {
    expect(tourReducer(done, { type: "start" }, 3)).toEqual(reading(0));
  });

  it("does not start with no events", () => {
    expect(tourReducer(idle, { type: "start" }, 0)).toBe(idle);
  });

  it("walks every event in order, travelling between holds, then finishes", () => {
    const seen: TourState[] = [];
    let s: TourState = idle;
    for (const type of ["start", "doneReading", "arrived", "doneReading", "arrived", "doneReading"] as const) {
      s = tourReducer(s, { type }, 3);
      seen.push(s);
    }
    expect(seen).toEqual([reading(0), travelling(1), reading(1), travelling(2), reading(2), done]);
  });

  it("finishes after reading the only event of a one-event tour", () => {
    expect(run(1, ["start", "doneReading"])).toEqual(done);
  });

  it("Next while travelling arrives at once", () => {
    expect(tourReducer(travelling(2), { type: "next" }, 5)).toEqual(reading(2));
  });

  it("Next while reading moves on to the next event", () => {
    expect(tourReducer(reading(2), { type: "next" }, 5)).toEqual(travelling(3));
  });

  it("Next while reading the last event finishes", () => {
    expect(tourReducer(reading(4), { type: "next" }, 5)).toEqual(done);
  });

  it.each([idle, travelling(1), reading(1), done])("exits to idle from %o", (from) => {
    expect(tourReducer(from, { type: "exit" }, 3)).toEqual(idle);
  });

  it.each<[TourState, TourAction["type"]]>([
    [idle, "exit"],
    [idle, "arrived"],
    [idle, "doneReading"],
    [idle, "next"],
    [travelling(1), "start"],
    [travelling(1), "doneReading"],
    [reading(1), "start"],
    [reading(1), "arrived"],
    [done, "arrived"],
    [done, "doneReading"],
    [done, "next"],
  ])("ignores, returning the same state, %o on %s", (from, type) => {
    expect(tourReducer(from, { type } as TourAction, 3)).toBe(from);
  });
});

describe("isTouring", () => {
  it("is true on an event or on the way to one", () => {
    expect([idle, travelling(0), reading(0), done].map(isTouring)).toEqual([false, true, true, false]);
  });
});

describe("tour timing", () => {
  it("travels 12 s per timeline, between 1 s and 4 s", () => {
    expect(travelMs(0, 0.04)).toBe(1000);
    expect(travelMs(0.12, 0.25)).toBe(1560);
    expect(travelMs(0.22, 0.46)).toBe(2880);
    expect(travelMs(0, 1)).toBe(4000);
  });

  it("holds 1.5 s plus 300 ms a word of the title and description", () => {
    expect(holdMs({ title: "The Sun ignites", description: "" })).toBe(2400);
    expect(holdMs({ title: "Exploded view", description: "Every part of the iPhone floats apart." })).toBe(4200);
    expect(holdMs({ title: "  Spaced ", description: "out\n  words  " })).toBe(2400);
    expect(holdMs({ title: "Ten words", description: "one two three four five six seven eight" })).toBe(4500);
  });

});
