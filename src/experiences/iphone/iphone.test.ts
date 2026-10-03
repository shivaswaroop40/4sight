import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { fakeSceneContext } from "../../renderer/fakeSceneContext";
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
    expect(times).toEqual([0, 0.04, 0.12, 0.22, 0.46, 0.62, 0.76, 0.95]);
    expect(iphoneExperience.getCurrentEvent(0.5)?.id).toBe("cameras");
    expect(iphoneExperience.getCurrentEvent(1)?.title).toBe("It's alive!");
  });

  it("lands the It's alive! flag on a visible face", () => {
    const wake = iphoneExperience.events.at(-1)!;
    expect(faceOpacity(wake.time)).toBe(1);
  });

  it("has no one-day analogy, since assembly progress is not elapsed time", () => {
    expect(iphoneExperience.elapsedSpanSeconds).toBeUndefined();
  });

  it("pulls the camera in as the phone assembles", () => {
    expect(iphoneExperience.cameraDistanceScale!(0)).toBeCloseTo(1.3, 6);
    expect(iphoneExperience.cameraDistanceScale!(1)).toBe(1);
  });

  it("offers four camera presets with three-quarter first", () => {
    expect(iphoneExperience.getCameraPresets().map((p) => p.name)).toEqual(["Three-quarter", "Front", "Back", "Side"]);
  });
});

describe("iPhone X-ray", () => {
  it("offers one X-ray switch, off by default", () => {
    expect(iphoneExperience.getAvailableFilters().map((f) => [f.id, f.name, f.group, f.defaultOn])).toEqual([
      ["xray", "X-ray", undefined, false],
    ]);
  });

  it("turns the glass translucent at the same t and lets hover reach the parts inside", () => {
    const ctx = fakeSceneContext();
    iphoneExperience.mount(ctx);
    const glass = (ctx.scene.getObjectByName("display")!.children[0] as THREE.Mesh).material as THREE.Material;
    const front: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [[0, 0, 15], [0, 0, 0]];
    const back: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [[0, 0, -15], [0, 0, 0]];

    iphoneExperience.setFilters!({ xray: false });
    iphoneExperience.setTime(1);
    expect([glass.opacity, glass.transparent]).toEqual([1, false]);
    expect([ctx.hoverAt(...front), ctx.hoverAt(...back)]).toEqual(["display", "back-glass"]);

    iphoneExperience.setFilters!({ xray: true });
    iphoneExperience.setTime(1);
    expect([glass.opacity, glass.transparent]).toEqual([0.16, true]);
    expect([ctx.hoverAt(...front), ctx.hoverAt(...back)]).toEqual(["battery", "battery"]);

    iphoneExperience.setFilters!({ xray: false });
    iphoneExperience.setTime(1);
    expect([glass.opacity, glass.transparent]).toEqual([1, false]);
    expect(ctx.hoverAt(...front)).toBe("display");
    iphoneExperience.dispose();
  });

  it("keeps the frame solid, so the phone keeps its ink silhouette", () => {
    const ctx = fakeSceneContext();
    iphoneExperience.mount(ctx);
    iphoneExperience.setFilters!({ xray: true });
    iphoneExperience.setTime(1);
    const band = ctx.scene.getObjectByName("frame")!.children[0] as THREE.Mesh;
    expect((band.material as THREE.Material).opacity).toBe(1);
    expect(band.getObjectByName("outline")!.visible).toBe(true);
    iphoneExperience.dispose();
  });
});
