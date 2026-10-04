import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { spanClock } from "../../core/analogy";
import { fakeSceneContext } from "../../renderer/fakeSceneContext";
import { YEAR_SECONDS } from "../../core/timescale";
import { knotMapping } from "../../core/mappings";
import { buildCosmicWeb } from "./cosmicWeb";
import { EVENTS, KNOTS, formatCosmicTime, seconds } from "./universeData";
import { universeExperience } from "./UniverseExperience";
import { hoverInfo } from "./universeHover";
import { STAGES, cameraScale, dominantStage, scaleFactor, stageWeights, universeStateAt } from "./UniverseState";

const mapping = knotMapping(KNOTS, formatCosmicTime);

describe("universe mapping", () => {
  it("hits every knot exactly", () => {
    for (const k of KNOTS) {
      expect(mapping.toTime(k.u)).toBeCloseTo(k.time, 12);
      expect(mapping.toParam(k.time)).toBeCloseTo(k.u, 9);
    }
  });

  it("round-trips inside every segment, including the tiny first second", () => {
    for (const u of [0.01, 0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.75, 0.93]) {
      expect(mapping.toParam(mapping.toTime(u))).toBeCloseTo(u, 9);
    }
  });

  it("gives inflation and the first microsecond real slider width", () => {
    expect(mapping.toParam(seconds(1e-36))).toBeGreaterThan(0.03);
    expect(mapping.toParam(seconds(1e-6))).toBeGreaterThan(0.1);
    expect(mapping.toParam(seconds(1e-6))).toBeLessThan(0.15);
  });

  it("labels the slider ends and the big milestones", () => {
    expect(mapping.ticks().map((t) => t.label)).toEqual([
      "Big Bang", "", "1 s", "3 min", "380k yrs", "200M yrs", "1B yrs", "9.2B yrs", "Today",
    ]);
  });

  it("reads seconds early and years later", () => {
    expect(formatCosmicTime(0)).toBe("Time zero");
    expect(formatCosmicTime(seconds(1e-36))).toBe("10⁻³⁶ seconds");
    expect(formatCosmicTime(seconds(3e-20))).toBe("3 × 10⁻²⁰ seconds");
    expect(formatCosmicTime(seconds(180))).toBe("3 minutes");
    expect(formatCosmicTime(3.8e5)).toBe("380,000 years");
    expect(formatCosmicTime(2e8)).toBe("200 million years");
    expect(formatCosmicTime(9.2e9)).toBe("9.20 billion years");
    expect(formatCosmicTime(1.38e10)).toBe("13.8 billion years");
  });
});

describe("universe events", () => {
  it("are sorted and span the whole timeline", () => {
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].time).toBeGreaterThan(EVENTS[i - 1].time);
    expect(EVENTS[0].time).toBe(universeExperience.minTime);
    expect(EVENTS[EVENTS.length - 1].time).toBe(universeExperience.maxTime);
  });

  it("puts the key moments at their standard times", () => {
    const at = (id: string) => EVENTS.find((e) => e.id === id)!.time;
    expect(at("nucleosynthesis")).toBeCloseTo(seconds(180), 12);
    expect(at("recombination")).toBe(3.8e5);
    expect(at("first-stars")).toBe(1e8);
    expect(at("sun")).toBe(9.2e9);
    expect(at("today")).toBe(1.38e10);
  });

  it("reports the event in progress", () => {
    expect(universeExperience.getCurrentEvent(5e5)!.id).toBe("recombination");
    expect(universeExperience.getCurrentEvent(1.2e10)!.id).toBe("sun");
  });
});

describe("universe state", () => {
  it("passes through each stage at the right time", () => {
    expect(stageWeights(1).plasma).toBe(1);
    expect(stageWeights(3.8e5).recombination).toBe(1);
    expect(stageWeights(1e7).darkAges).toBe(1);
    expect(stageWeights(2e8).firstStars).toBe(1);
    expect(stageWeights(1e9).galaxies).toBe(1);
    expect(stageWeights(5e9).structure).toBe(1);
    expect(stageWeights(1.38e10).today).toBe(1);
    expect(dominantStage(0)).toBe("plasma");
  });

  it("keeps stage weights summing to one", () => {
    for (const t of [0, 1e-30, 2.5e5, 6e5, 1e8, 4e8, 3e9, 9e9, 1.38e10]) {
      const w = stageWeights(t);
      expect(STAGES.reduce((n, s) => n + w[s], 0)).toBeCloseTo(1, 12);
    }
  });

  it("expands monotonically to a = 1 today", () => {
    let previous = -1;
    for (let i = 0; i <= 400; i++) {
      const t = 1.38e10 * Math.pow(i / 400, 4);
      const a = scaleFactor(t);
      expect(a).toBeGreaterThan(previous);
      previous = a;
    }
    expect(scaleFactor(0)).toBe(0);
    expect(scaleFactor(1.38e10)).toBeCloseTo(1, 9);
  });

  it("matches the measured redshifts of recombination and matter-radiation equality", () => {
    expect(universeStateAt(3.8e5).redshift).toBeGreaterThan(1050);
    expect(universeStateAt(3.8e5).redshift).toBeLessThan(1150);
    expect(1 / scaleFactor(5.1e4) - 1).toBeGreaterThan(3300);
    expect(1 / scaleFactor(5.1e4) - 1).toBeLessThan(3500);
  });

  it("speeds up late, when dark energy takes over", () => {
    const rate = (t: number) => (scaleFactor(t * 1.01) - scaleFactor(t)) / (0.01 * t);
    expect(rate(5e9)).toBeLessThan(rate(1e9));
    expect(rate(1.3e10)).toBeGreaterThan(rate(8e9));
  });

  it("is opaque before recombination and clear after", () => {
    expect(universeStateAt(1e5).fog).toBe(1);
    expect(universeStateAt(1e6).fog).toBe(0);
    expect(universeStateAt(3.8e5).ripples).toBeGreaterThan(0.95);
  });

  it("keeps the quark soup until the protons event and clears it within a decade of time", () => {
    const protons = EVENTS.find((e) => e.id === "protons")!.time;
    expect(protons).toBe(seconds(1e-5));
    expect(universeStateAt(seconds(1e-6)).quarks).toBeGreaterThan(0.95);
    expect(universeStateAt(protons).quarks).toBeCloseTo(0.5, 1);
    expect(universeStateAt(seconds(1e-4)).quarks).toBe(0);
  });

  it("brings the first stars, galaxies, and the Sun in order", () => {
    expect(universeStateAt(5e7).firstStars).toBe(0);
    expect(universeStateAt(2e8).firstStars).toBe(1);
    expect(universeStateAt(2e8).galaxies).toBe(0);
    expect(universeStateAt(1.38e10).galaxies).toBe(1);
    expect(universeStateAt(9e9).sun).toBeLessThan(1);
    expect(universeStateAt(9.2e9).sun).toBe(1);
  });

  it("pulls the camera back as the universe grows", () => {
    expect(cameraScale(0)).toBe(0.3);
    expect(cameraScale(3.8e5)).toBeLessThan(cameraScale(1e9));
    expect(cameraScale(1.38e10)).toBeCloseTo(1, 12);
  });

  it("is a pure function of time, whatever was asked before", () => {
    const expected = universeStateAt(1e9);
    universeExperience.getState(1.38e10);
    universeExperience.setTime(0);
    expect(universeExperience.getState(1e9)).toEqual(expected);
    expect(expected.fog).toBe(0);
    expect(expected.scaleFactor).toBeCloseTo(0.15, 2);
    expect(expected.stages.galaxies).toBe(1);
    expect(expected.radius).toBeCloseTo(6.39, 2);
  });
});

describe("universe scene data", () => {
  it("generates the same web every time", () => {
    const a = buildCosmicWeb(2000, 100);
    const b = buildCosmicWeb(2000, 100);
    expect(a.particles.count).toBe(2000);
    expect(a.galaxies.count).toBe(100);
    expect(a.knots[a.cluster].position).toEqual([0.42, 0.16, 0.22]);
    expect(a.filaments.length).toBeGreaterThan(40);
    expect(a.particles.home).toEqual(b.particles.home);
    expect(a.filaments).toEqual(b.filaments);
  });

  it("keeps every particle inside the ball and galaxies clear of the Milky Way", () => {
    const web = buildCosmicWeb(2000, 300);
    for (let i = 0; i < web.particles.count; i++) {
      const [x, y, z] = web.particles.home.subarray(i * 3, i * 3 + 3);
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(0.9401);
    }
    for (let g = 0; g < web.galaxies.count; g++) {
      const [x, y, z] = web.galaxies.position.subarray(g * 3, g * 3 + 3);
      expect(Math.hypot(x, y, z)).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("tells a different hover story before and after the CMB is released", () => {
    expect(hoverInfo("cmb", 1e3)!.description).toMatch(/glowing fog/);
    expect(hoverInfo("cmb", 1e9)!.description).toMatch(/oldest light|cosmic microwave background/);
    expect(hoverInfo("sun", 1.38e10)!.description).toMatch(/Solar System experience/);
    expect(hoverInfo("nothing", 0)).toBeNull();
    expect(hoverInfo("toString", 0)).toBeNull();
    expect(hoverInfo("constructor", 0)).toBeNull();
  });

  it("stops saying the CMB is breaking free once the fog has cleared", () => {
    expect(universeStateAt(3.5e5).fog).toBeGreaterThan(0);
    expect(hoverInfo("cmb", 3.5e5)!.description).toMatch(/breaking free right now/);
    expect(universeStateAt(4.5e5).fog).toBe(0);
    expect(hoverInfo("cmb", 5e5)!.description).toMatch(/cosmic microwave background/);
    expect(hoverInfo("cmb", 5e5)!.description).not.toMatch(/breaking free/);
  });

  it("walks the Sun from a collapsing cloud to middle age", () => {
    expect(universeStateAt(8.8e9).sun).toBeGreaterThan(0.001);
    expect(hoverInfo("sun", 8.8e9)!.description).toMatch(/collapsing/);
    expect(hoverInfo("sun", 9.3e9)!.description).toMatch(/planets/);
    expect(hoverInfo("sun", 1.1e10)!.description).toMatch(/oceans/);
    expect(hoverInfo("sun", 1.38e10)!.description).toMatch(/halfway/);
    const texts = new Set([8.8e9, 9.3e9, 1.1e10, 1.38e10].map((t) => hoverInfo("sun", t)!.description));
    expect(texts.size).toBe(4);
  });

  it("sizes the dots from the renderer's pixel ratio at each frame, not the one at mount", () => {
    const ctx = fakeSceneContext();
    const renderer = ctx.renderer as unknown as { getPixelRatio: () => number };
    universeExperience.mount(ctx);
    const matter = ctx.scene.getObjectsByProperty("type", "Points")[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const frame = () => matter.onBeforeRender(ctx.renderer, ctx.scene, ctx.camera, matter.geometry, matter.material, new THREE.Group());
    frame();
    expect(matter.material.uniforms.uPointScale.value).toBe(26);
    renderer.getPixelRatio = () => 2;
    frame();
    expect(matter.material.uniforms.uPointScale.value).toBe(52);
    renderer.getPixelRatio = () => 1;
    frame();
    expect(matter.material.uniforms.uPointScale.value).toBe(26);
    universeExperience.dispose();
  });

  it("offers the three named views, none duplicating the Overview button", () => {
    expect(universeExperience.getCameraPresets().map((p) => p.name)).toEqual(["Wide", "Inside the web", "Galaxy close-up"]);
  });
});

describe("universe one-day clock", () => {
  it("is the cosmic calendar: the Sun forms at 4 pm", () => {
    const at = (time: number) => spanClock(time, universeExperience.minTime, universeExperience.maxTime);
    expect(universeExperience.elapsedSpanSeconds).toBe(13.8e9 * YEAR_SECONDS);
    expect(at(EVENTS.find((e) => e.id === "sun")!.time)).toBe("4:00:00 pm");
    expect(at(13.8e9 - 300_000)).toBe("11:59:58 pm");
    expect(at(13.8e9)).toBe("midnight");
  });
});
