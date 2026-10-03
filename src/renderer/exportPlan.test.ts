import { describe, expect, it } from "vitest";
import { exportPlan, frameParam } from "./exportPlan";

describe("exportPlan", () => {
  it("renders a 1440x900 desktop at 1728x1080, one frame per 1/30 s", () => {
    expect(exportPlan(10, 1440 / 900)).toEqual({ fps: 30, frames: 300, width: 1728, height: 1080 });
  });

  it("renders a 390x844 phone portrait at 888x1920", () => {
    expect(exportPlan(10, 390 / 844)).toEqual({ fps: 30, frames: 300, width: 888, height: 1920 });
  });

  it("fills the whole box when the viewport is exactly 16:9", () => {
    expect(exportPlan(40, 16 / 9)).toEqual({ fps: 30, frames: 1200, width: 1920, height: 1080 });
  });

  it("is width bound for wide and squat viewports", () => {
    expect(exportPlan(40, 2.4)).toMatchObject({ width: 1920, height: 800 });
    expect(exportPlan(40, 0.75)).toMatchObject({ width: 1080, height: 1440 });
  });

  it("treats a square viewport as landscape", () => {
    expect(exportPlan(10, 1)).toMatchObject({ width: 1080, height: 1080 });
  });

  it("keeps sides even", () => {
    expect(exportPlan(10, 1.37)).toMatchObject({ width: 1480, height: 1080 });
  });

  it("scales the frame count with fps and never drops below two frames", () => {
    expect(exportPlan(10, 1.6, 60).frames).toBe(600);
    expect(exportPlan(0.01, 1.6).frames).toBe(2);
  });
});

describe("frameParam", () => {
  it("runs from u = 0 on the first frame to u = 1 on the last", () => {
    const plan = exportPlan(10, 1.6);
    expect([0, 1, 299].map((i) => frameParam(plan, i))).toEqual([0, 1 / 299, 1]);
  });
});
