import { describe, expect, it } from "vitest";
import { TimeController } from "./TimeController";
import { linearMapping, piecewiseLogMapping } from "./mappings";
import { effectiveRate, formatWarp, passSeconds, usableWarpPresets } from "./warp";
import type { FourDExperience, TimeMapping } from "./types";

function fakeExperience(mapping: TimeMapping, baseDurationSeconds: number, warpPresets: number[]) {
  const calls: number[] = [];
  const experience = {
    id: "mock",
    name: "Fake",
    minTime: mapping.toTime(0),
    maxTime: mapping.toTime(1),
    mapping,
    baseDurationSeconds,
    warpPresets,
    labels: { start: "start", end: "end" },
    events: [
      { id: "mid", time: mapping.toTime(0.5), title: "Mid", when: "", description: "", keyPoints: [] },
    ],
    mount() {},
    setTime(t: number) {
      calls.push(t);
    },
    getState: () => null,
    getCurrentEvent: () => null,
    getHoveredObject: () => null,
    getAvailableFilters: () => [],
    getCameraPresets: () => [],
    reset() {},
    dispose() {},
  } satisfies FourDExperience;
  return { experience, calls };
}

// Two segments, 1 -> 10 -> 100: T(u) = 10^(2u), dT/du = 2 ln(10) 10^(2u).
const logMapping = piecewiseLogMapping(
  [
    { time: 1, label: "1" },
    { time: 10, label: "10" },
    { time: 100, label: "100" },
  ],
  (t) => t.toFixed(2),
);
const linear = linearMapping(0, 1, (t) => t.toFixed(2));

function playFor(mapping: TimeMapping, base: number, warp: number, seconds: number, frames = 10) {
  const { experience } = fakeExperience(mapping, base, [warp]);
  const c = new TimeController();
  c.attach(experience);
  c.setPlaybackSpeed(warp);
  c.play();
  for (let i = 0; i < frames; i++) c.tick(seconds / frames);
  return c;
}

describe("TimeController warp rate", () => {
  it.each([
    [0.1, 0.02],
    [0.5, 0.1],
    [1, 0.2],
    [2, 0.4],
  ])("linear, base 5 s: %sx advances u by %s per real second", (warp, du) => {
    const c = playFor(linear, 5, warp, 1);
    expect(c.state.param).toBeCloseTo(du, 10);
    expect(c.state.time).toBeCloseTo(du, 10);
    expect(c.state.isPlaying).toBe(true);
  });

  it("linear, base 5 s: 5x finishes the pass in exactly 1 s and pauses at u = 1", () => {
    const c = playFor(linear, 5, 5, 1);
    expect(c.state.param).toBe(1);
    expect(c.state.isPlaying).toBe(false);
  });

  it.each([
    [0.25, 0.00625],
    [1, 0.025],
    [20, 0.5],
  ])("log, base 40 s: %sx advances u by %s per real second", (warp, du) => {
    const c = playFor(logMapping, 40, warp, 1);
    expect(c.state.param).toBeCloseTo(du, 10);
  });

  it("log: 20x for 1 s from u = 0 lands on the middle knot, t = 10", () => {
    const c = playFor(logMapping, 40, 20, 1);
    expect(c.state.time).toBeCloseTo(10, 6);
  });

  it("changing warp while playing changes the rate from that moment", () => {
    const { experience } = fakeExperience(linear, 5, [1, 2]);
    const c = new TimeController();
    c.attach(experience);
    c.play();
    c.tick(1); // 1x: u = 0.2
    c.setPlaybackSpeed(2);
    c.tick(1); // 2x: +0.4
    expect(c.state.param).toBeCloseTo(0.6, 10);
  });

  it("changing warp while paused is kept and used on play", () => {
    const { experience } = fakeExperience(linear, 5, [1, 2]);
    const c = new TimeController();
    c.attach(experience);
    c.setPlaybackSpeed(2);
    expect(c.state.playbackSpeed).toBe(2);
    c.play();
    c.tick(0.5);
    expect(c.state.param).toBeCloseTo(0.2, 10);
  });

  it("ignores zero, negative and NaN speeds", () => {
    const { experience } = fakeExperience(linear, 5, [1]);
    const c = new TimeController();
    c.attach(experience);
    c.setPlaybackSpeed(0);
    c.setPlaybackSpeed(-2);
    c.setPlaybackSpeed(Number.NaN);
    expect(c.state.playbackSpeed).toBe(1);
  });

  it("reset keeps the chosen warp; attach picks 1x again", () => {
    const { experience } = fakeExperience(linear, 5, [0.5, 1, 2]);
    const c = new TimeController();
    c.attach(experience);
    c.setPlaybackSpeed(2);
    c.reset();
    expect(c.state.playbackSpeed).toBe(2);
    c.attach(experience);
    expect(c.state.playbackSpeed).toBe(1);
  });

  it("attach picks the preset nearest 1x when 1x is not offered", () => {
    const { experience } = fakeExperience(linear, 50, [0.25, 4, 10]);
    const c = new TimeController();
    c.attach(experience);
    expect(c.state.playbackSpeed).toBe(0.25);
  });
});

describe("TimeController boundaries", () => {
  it("Play at u = 1 going forward restarts from u = 0 and plays", () => {
    const { experience, calls } = fakeExperience(linear, 5, [1]);
    const c = new TimeController();
    c.attach(experience);
    c.setParam(1);
    c.play();
    expect(c.state.param).toBe(0);
    expect(c.state.isPlaying).toBe(true);
    expect(calls.at(-1)).toBe(0);
    c.tick(1);
    expect(c.state.param).toBeCloseTo(0.2, 10);
  });

  it("Play at u = 0 in reverse restarts from u = 1 and plays backward", () => {
    const { experience } = fakeExperience(linear, 5, [1]);
    const c = new TimeController();
    c.attach(experience);
    c.reverse();
    c.play();
    expect(c.state.param).toBe(1);
    c.tick(1);
    expect(c.state.param).toBeCloseTo(0.8, 10);
    expect(c.state.isPlaying).toBe(true);
  });

  it("reverse at the end then play travels back without jumping", () => {
    const c = playFor(linear, 5, 5, 1);
    expect(c.state.param).toBe(1);
    c.reverse();
    c.play();
    expect(c.state.param).toBe(1);
    c.tick(0.1);
    expect(c.state.param).toBeCloseTo(0.9, 10);
  });

  it("reverse playback pauses exactly at u = 0", () => {
    const { experience } = fakeExperience(linear, 5, [2]);
    const c = new TimeController();
    c.attach(experience);
    c.setParam(0.3);
    c.setPlaybackSpeed(2);
    c.reverse();
    c.play();
    c.tick(1);
    expect(c.state.param).toBe(0);
    expect(c.state.isPlaying).toBe(false);
  });

  it("does not advance while scrubbing, and resumes after", () => {
    const { experience } = fakeExperience(linear, 5, [1]);
    const c = new TimeController();
    c.attach(experience);
    c.play();
    c.setScrubbing(true);
    c.setParam(0.5);
    c.tick(1);
    expect(c.state.param).toBe(0.5);
    c.setScrubbing(false);
    c.tick(1);
    expect(c.state.param).toBeCloseTo(0.7, 10);
    expect(c.state.isPlaying).toBe(true);
  });

  it("setParam is pure: the same u yields the same experience time", () => {
    const { experience, calls } = fakeExperience(logMapping, 40, [1]);
    const c = new TimeController();
    c.attach(experience);
    c.setParam(0.37);
    c.setParam(0.9);
    c.setParam(0.37);
    expect(calls.at(-1)).toBe(calls.at(-3));
  });
});

describe("warp helpers", () => {
  it("effective rate on a linear mapping is span * w / base", () => {
    const m = linearMapping(0, 1e9, String);
    expect(effectiveRate(m, 20, 0.3, 1)).toBeCloseTo(5e7, -2);
    expect(effectiveRate(m, 20, 0.3, 5)).toBeCloseTo(2.5e8, -2);
  });

  it("effective rate on the log mapping at u = 0.5, base 10, 2x is 2 ln10 * 10 * 2 / 10", () => {
    // 4 ln(10) = 9.2103...
    expect(effectiveRate(logMapping, 10, 0.5, 2)).toBeCloseTo(9.2103, 2);
  });

  it("effective rate on the log mapping grows 100x across the timeline", () => {
    const start = effectiveRate(logMapping, 10, 0, 1);
    const end = effectiveRate(logMapping, 10, 1, 1, -1);
    expect(start).toBeCloseTo(0.4605, 2);
    expect(end).toBeCloseTo(46.05, 0);
  });

  it("hides presets that would finish a pass in under a second", () => {
    expect(usableWarpPresets({ id: "mock", baseDurationSeconds: 40, warpPresets: [1, 10, 100, 1000, 10000] })).toEqual([
      1, 10,
    ]);
    expect(usableWarpPresets({ id: "mock", baseDurationSeconds: 5, warpPresets: [5, 0.1, 1, 2, 0.5, 1] })).toEqual([
      0.1, 0.5, 1, 2, 5,
    ]);
    expect(passSeconds(40, 20)).toBe(2);
  });

  it("formats warps compactly", () => {
    expect(formatWarp(0.25)).toBe("0.25×");
    expect(formatWarp(1)).toBe("1×");
    expect(formatWarp(20)).toBe("20×");
  });
});
