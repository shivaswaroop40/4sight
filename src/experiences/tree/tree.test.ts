import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { SceneContext } from "../../core/types";
import { EVENTS, hoverInfo } from "./treeData";
import {
  KNOTS,
  SEASON_CAP,
  STORY,
  acornCapacity,
  cameraScale,
  girthAt,
  heightAt,
  mapping,
  ringCount,
  seasonClockAt,
  seasonName,
  seasonPhase,
} from "./treeModel";
import { drawnHeight, segmentPose } from "./treePose";
import { SKELETON, generateSkeleton } from "./treeSkeleton";
import { acornsAt, treeStateAt } from "./treeState";
import { treeExperience } from "./TreeExperience";

describe("oak time axis", () => {
  it("hits every knot exactly and round-trips inside segments", () => {
    for (const k of KNOTS) {
      expect(mapping.toTime(k.u)).toBeCloseTo(k.time, 6);
      expect(mapping.toParam(k.time)).toBeCloseTo(k.u, 6);
    }
    for (const u of [0.03, 0.1, 0.25, 0.4, 0.55, 0.65, 0.75, 0.9]) {
      expect(mapping.toParam(mapping.toTime(u))).toBeCloseTo(u, 6);
    }
  });

  it("gives the first year more than a sixth of the slider", () => {
    expect(mapping.toParam(1)).toBeCloseTo(0.18, 6);
  });

  it("reads ages in weeks, months, then years", () => {
    expect(mapping.format(0)).toBe("0 weeks");
    expect(mapping.format(0.06)).toBe("3 weeks");
    expect(mapping.format(0.62)).toBe("7 months");
    expect(mapping.format(1.5)).toBe("1 year");
    expect(mapping.format(84.9)).toBe("84 years");
  });
});

describe("oak growth", () => {
  it("has no shoot until spring of year one", () => {
    expect(heightAt(0.5)).toBe(0);
    expect(heightAt(1)).toBeGreaterThan(0.1);
    expect(heightAt(1)).toBeLessThan(0.25);
  });

  it("grows to about 19 m by 150 years", () => {
    expect(heightAt(40)).toBeCloseTo(10.0, 1);
    expect(heightAt(150)).toBeCloseTo(19.4, 1);
  });

  it("adds about 2.5 cm of girth a year", () => {
    expect(girthAt(150)).toBeCloseTo(3.64, 2);
    expect((girthAt(100) - girthAt(50)) / 50).toBeCloseTo(0.0251, 3);
  });

  it("lays down one ring per year", () => {
    expect(ringCount(0.9)).toBe(0);
    expect(ringCount(1)).toBe(1);
    expect(ringCount(87.4)).toBe(87);
    expect(treeStateAt(150).rings).toBe(150);
  });

  it("draws a crown within 20% of the modelled height", () => {
    for (const t of [3, 10, 25, 60, 100, 150]) {
      expect(Math.abs(drawnHeight(SKELETON, t) / heightAt(t) - 1)).toBeLessThan(0.2);
    }
  });

  it("generates the same skeleton every time", () => {
    const again = generateSkeleton();
    expect(again.segments.length).toBe(SKELETON.segments.length);
    expect(again.segments[200].start).toEqual(SKELETON.segments[200].start);
  });

  it("only thickens wood the tip has already passed", () => {
    const top = SKELETON.segments.find((s) => SKELETON.axes[s.axis].kind === "trunk" && s.s0 > 10)!;
    expect(segmentPose(SKELETON, top, 30).length).toBe(0);
    expect(segmentPose(SKELETON, top, 150).rBottom).toBeGreaterThan(0.2);
  });
});

describe("oak seasons", () => {
  it("is calendar-true while the acorn germinates", () => {
    expect(seasonName(seasonPhase(0))).toBe("autumn");
    expect(seasonName(seasonPhase(0.3))).toBe("winter");
    expect(seasonName(seasonPhase(0.62))).toBe("spring");
    expect(seasonPhase(1.5)).toBeCloseTo(0.29, 2);
  });

  it("never runs faster than the cap, so fast play cannot strobe", () => {
    const n = 20000;
    let prev = seasonClockAt(mapping.toTime(0));
    let fastest = 0;
    for (let i = 1; i <= n; i++) {
      const c = seasonClockAt(mapping.toTime(i / n));
      expect(c).toBeGreaterThanOrEqual(prev);
      fastest = Math.max(fastest, (c - prev) * n);
      prev = c;
    }
    expect(SEASON_CAP).toBe(22);
    expect(fastest).toBeLessThan(33);
  });

  it("shows the season each story beat needs", () => {
    expect(seasonName(seasonPhase(STORY.sapling))).toBe("summer");
    expect(seasonName(seasonPhase(STORY.firstAcorns))).toBe("summer");
    expect(seasonPhase(STORY.end)).toBeCloseTo(0.72, 3);
    expect(acornsAt(STORY.firstAcorns).onTree).toBeGreaterThan(0);
  });

  it("makes no acorns before 40 and a mast crop at the mast beat", () => {
    expect(acornCapacity(39.9)).toBe(0);
    expect(acornsAt(30).onTree).toBe(0);
    expect(acornsAt(STORY.mast).mast).toBe(true);
  });
});

describe("oak story", () => {
  it("keeps events sorted and inside the range", () => {
    const times = EVENTS.map((e) => e.time);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    expect(times[0]).toBe(treeExperience.minTime);
    expect(times[times.length - 1]).toBe(treeExperience.maxTime);
  });

  it("tells the beats in order", () => {
    expect(EVENTS.map((e) => e.id)).toEqual([
      "acorn",
      "radicle",
      "first-leaves",
      "marcescence",
      "sapling",
      "crown-lift",
      "first-acorns",
      "mast",
      "storm",
      "healing",
      "woodpecker",
      "owl",
      "veteran",
    ]);
    expect(treeExperience.getCurrentEvent(84.5)?.title).toBe("A storm tears off a limb");
  });

  it("follows the limb from attached to falling to fallen", () => {
    expect(treeStateAt(84).limb).toBe("attached");
    expect(treeStateAt(84.4).limb).toBe("falling");
    expect(treeStateAt(90).limb).toBe("fallen");
  });

  it("brings each animal on stage in its window", () => {
    expect(treeStateAt(0.02).wildlife).toEqual(["jay"]);
    expect(treeStateAt(5).wildlife).toEqual(["rabbit"]);
    expect(treeStateAt(110).wildlife).toContain("woodpecker");
    expect(treeStateAt(140).wildlife).toContain("owl");
    expect(treeStateAt(60).wildlife).not.toContain("owl");
  });

  it("stages the life from acorn to veteran", () => {
    expect(treeStateAt(0).stage).toBe("acorn");
    expect(treeStateAt(0.3).stage).toBe("germinating");
    expect(treeStateAt(6).stage).toBe("sapling");
    expect(treeStateAt(150).stage).toBe("veteran");
  });

  it("is a pure function of time", () => {
    const a = JSON.stringify(treeStateAt(87.3));
    treeStateAt(12);
    expect(JSON.stringify(treeStateAt(87.3))).toBe(a);
    expect(treeExperience.getState(42)).toEqual(treeExperience.getState(42));
  });
});

describe("oak hover and camera", () => {
  it("reports trunk age, height and girth at t", () => {
    const trunk = hoverInfo("trunk", 150)!;
    expect(trunk.description).toMatch(/^150 growth rings/);
    expect(trunk.properties).toEqual({ Age: "150 years", Height: "19 m", Girth: "3.6 m at 1.3 m" });
    expect(hoverInfo("trunk", 0.2)).toBeNull();
  });

  it("calls the scar a hollow once rot opens it", () => {
    expect(hoverInfo("scar", 90)!.name).toBe("Storm scar");
    expect(hoverInfo("scar", 130)!.name).toBe("Storm scar and hollow");
  });

  it("frames the jay, then pulls in close on the acorn", () => {
    expect(treeExperience.cameraDistanceScale!(150)).toBe(1);
    expect(cameraScale(0)).toBeCloseTo(0.0194, 4);
    expect(cameraScale(0.2)).toBeCloseTo(0.0101, 4);
  });

  it("has hover text for every part it registers, and unregisters them all", () => {
    const registered = new Map<THREE.Object3D, string>();
    const context: SceneContext = {
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      renderer: {} as THREE.WebGLRenderer,
      registerHoverable: (object, id) => registered.set(object, id),
      unregisterHoverable: (object) => registered.delete(object),
    };
    treeExperience.mount(context);
    treeExperience.setTime(150);
    const ids = [...new Set(registered.values())].sort();
    expect(ids).toEqual([
      "acorns", "canopy", "hill", "jay", "owl", "rabbit", "rings", "roots", "scar",
      "squirrel", "storm", "storm-limb", "trunk", "woodpecker", "woodpecker-hole",
    ]);
    for (const id of ids) expect(treeExperience.getHoveredObject(id)?.name).toBeTruthy();
    treeExperience.dispose();
    expect(registered.size).toBe(0);
    expect(context.scene.children.length).toBe(0);
  });

  it("offers three named views", () => {
    expect(treeExperience.getCameraPresets().map((p) => p.name)).toEqual(["Three-quarter", "Trunk and rings", "Below the canopy"]);
  });
});
