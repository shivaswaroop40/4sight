import { describe, expect, it } from "vitest";
import { mockExperience } from "./mockExperience";

function position(t: number) {
  return (mockExperience.getState(t) as { position: { x: number; y: number; z: number } })
    .position;
}

describe("mockExperience", () => {
  it("is at A when t = 0", () => {
    const p = position(0);
    expect(p.x).toBeCloseTo(-2);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0);
  });

  it("is at B when t = 0.5", () => {
    const p = position(0.5);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1.5);
    expect(p.z).toBeCloseTo(0);
  });

  it("is at C when t = 1", () => {
    const p = position(1);
    expect(p.x).toBeCloseTo(2);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0);
  });

  it("is a pure function of t: repeated calls agree", () => {
    const first = position(0.37);
    const second = position(0.37);
    expect(first).toEqual(second);
  });
});
