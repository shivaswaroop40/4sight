import { describe, expect, it } from "vitest";
import { IPHONE_DATA_FALLBACK } from "./iphoneData";
import { componentPose, eyeOpenness, faceOpacity, hopPose, iphoneState, screenOpacity } from "./IPhoneState";
import { iphoneExperience } from "./IPhoneExperience";

const byId = (id: string) => IPHONE_DATA_FALLBACK.components.find((c) => c.id === id)!;

describe("iPhone poses", () => {
  it("puts the battery at its exploded pose at t = 0", () => {
    const pose = componentPose(byId("battery"), 0);
    expect(pose.position[0]).toBeCloseTo(1.8, 6);
    expect(pose.position[1]).toBeCloseTo(-1.7, 6);
    expect(pose.position[2]).toBeCloseTo(0.5, 6);
    expect(pose.scale).toEqual([1, 1, 1]);
  });

  it("puts every part at its assembled pose with unit scale at t = 1", () => {
    for (const c of IPHONE_DATA_FALLBACK.components) {
      const pose = componentPose(c, 1);
      pose.position.forEach((v, i) => expect(v).toBeCloseTo(c.assembled.position[i], 6));
      pose.scale.forEach((v) => expect(v).toBeCloseTo(1, 6));
      expect(Math.abs(pose.quaternion[3])).toBeCloseTo(1, 6);
    }
    expect(componentPose(byId("display"), 1).position).toEqual([0, 0, 0.145]);
  });

  it("is a pure function of t", () => {
    const a = JSON.stringify(iphoneState(IPHONE_DATA_FALLBACK.components, 0.37));
    iphoneState(IPHONE_DATA_FALLBACK.components, 0.9);
    const b = JSON.stringify(iphoneState(IPHONE_DATA_FALLBACK.components, 0.37));
    expect(a).toBe(b);
  });

  it("ends the hop upright on the floor", () => {
    expect(hopPose(1)).toEqual({ y: 0, scale: [1, 1, 1], rotation: [0, 0, 0], air: 0 });
    expect(hopPose(0.968).y).toBeGreaterThan(0.5);
  });
});

describe("iPhone wake-up", () => {
  it("keeps the screen and face off before the display lands", () => {
    expect(screenOpacity(0.85)).toBe(0);
    expect(faceOpacity(0.85)).toBe(0);
    expect(eyeOpenness(0.85)).toBe(0);
  });

  it("is fully awake at t = 1", () => {
    expect(screenOpacity(1)).toBe(1);
    expect(faceOpacity(1)).toBe(1);
    expect(eyeOpenness(1)).toBe(1);
  });

  it("blinks around t = 0.975", () => {
    expect(eyeOpenness(0.965)).toBeCloseTo(1, 6);
    expect(eyeOpenness(0.975)).toBe(0);
  });
});

describe("iPhone events and presets", () => {
  it("has 8 sorted events and returns the last one at or before t", () => {
    const times = iphoneExperience.events.map((e) => e.time);
    expect(times).toEqual([0, 0.04, 0.12, 0.22, 0.46, 0.62, 0.76, 0.92]);
    expect(iphoneExperience.getCurrentEvent(0.5)?.id).toBe("cameras");
    expect(iphoneExperience.getCurrentEvent(1)?.title).toBe("It's alive!");
  });

  it("offers four camera presets with three-quarter first", () => {
    expect(iphoneExperience.getCameraPresets().map((p) => p.name)).toEqual(["Three-quarter", "Front", "Back", "Side"]);
  });
});
