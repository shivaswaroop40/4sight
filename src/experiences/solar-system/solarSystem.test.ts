import { describe, expect, it } from "vitest";
import { fakeSceneContext } from "../../renderer/fakeSceneContext";
import { EVENTS, KNOTS } from "./solarData";
import { formatYears, knotMapping } from "./solarMapping";
import { solarStateAt } from "./SolarSystemState";
import { solarSystemExperience } from "./SolarSystemExperience";

const mapping = knotMapping(KNOTS, formatYears);

function body(p: number, id: string) {
  return solarStateAt(p).bodies.find((b) => b.id === id)!;
}

describe("solar mapping", () => {
  it("hits every knot exactly", () => {
    for (const k of KNOTS) {
      expect(mapping.toTime(k.u)).toBeCloseTo(k.time, 6);
      expect(mapping.toParam(k.time)).toBeCloseTo(k.u, 6);
    }
  });

  it("round-trips inside segments", () => {
    for (const u of [0.05, 0.2, 0.33, 0.5, 0.61, 0.77, 0.9]) {
      expect(mapping.toParam(mapping.toTime(u))).toBeCloseTo(u, 6);
    }
  });

  it("labels interior ticks with times, leaving story beats to the event flags", () => {
    expect(mapping.ticks().map((t) => t.label)).toEqual([
      "Nebula", "100k yrs", "1M yrs", "10M yrs", "50M yrs", "100M yrs", "700M yrs", "Today",
    ]);
  });

  it("states the start in elapsed time, like the readout", () => {
    expect(EVENTS[0].when).toBe("Year 0 · 4.6 billion years ago");
  });

  it("keeps events sorted and inside the range", () => {
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].time).toBeGreaterThan(EVENTS[i - 1].time);
    expect(EVENTS[0].time).toBe(solarSystemExperience.minTime);
    expect(EVENTS[EVENTS.length - 1].time).toBe(solarSystemExperience.maxTime);
  });
});

describe("solar state", () => {
  it("starts as a cloud with no solid bodies", () => {
    const s = solarStateAt(0);
    expect(s.bodies.every((b) => b.solid === 0)).toBe(true);
    expect(s.ignition).toBe(0);
  });

  it("forms giants before rocky planets, and the Moon after Earth", () => {
    expect(body(0.45, "jupiter").solid).toBe(1);
    expect(body(0.45, "earth").solid).toBe(0);
    expect(body(0.66, "earth").solid).toBe(1);
    expect(body(0.66, "moon").solid).toBe(0);
  });

  it("ends with every body formed, cooled, and the Sun burning", () => {
    const s = solarStateAt(1);
    expect(s.ignition).toBe(1);
    for (const b of s.bodies) {
      expect(b.solid).toBe(1);
      if (b.id !== "sun" && b.id !== "io") expect(b.heat).toBe(0);
    }
  });

  it("keeps moons at their orbit distance from the parent", () => {
    const earth = body(0.9, "earth");
    const moon = body(0.9, "moon");
    const d = Math.hypot(moon.position[0] - earth.position[0], moon.position[2] - earth.position[2]);
    expect(d).toBeCloseTo(0.45, 6);
  });

  it("never calls the Sun molten", () => {
    for (const u of [0.3, 0.55, 1]) {
      solarSystemExperience.setTime(mapping.toTime(u));
      expect(solarSystemExperience.getHoveredObject("sun")!.description).not.toMatch(/molten/i);
    }
  });

  it("offers named camera views, none duplicating the Overview button", () => {
    expect(solarSystemExperience.getCameraPresets().map((p) => p.name)).toEqual(["Tilted", "Top", "Edge-on"]);
  });

  it("is a pure function of time", () => {
    const t = mapping.toTime(0.63);
    expect(solarSystemExperience.getState(t)).toEqual(solarSystemExperience.getState(t));
  });
});

describe("solar filters", () => {
  it("offers Gas & dust and Orbits, both on by default", () => {
    expect(solarSystemExperience.getAvailableFilters().map((f) => [f.id, f.name, f.defaultOn])).toEqual([
      ["gas-and-dust", "Gas & dust", true],
      ["orbits", "Orbits", true],
    ]);
  });

  it("hides the gas and dust and the orbit lines at the same t only while their filters are off", () => {
    const ctx = fakeSceneContext();
    solarSystemExperience.mount(ctx);
    const gas = ctx.scene.getObjectByName("gas-and-dust")!;
    const orbits = () => ctx.scene.getObjectsByProperty("name", "orbit").map((o) => o.visible);
    const today = mapping.toTime(1);

    solarSystemExperience.setFilters!({ "gas-and-dust": true, orbits: true });
    solarSystemExperience.setTime(today);
    expect(gas.visible).toBe(true);
    expect(orbits()).toEqual(Array(8).fill(true));

    solarSystemExperience.setFilters!({ "gas-and-dust": false, orbits: false });
    solarSystemExperience.setTime(today);
    expect(gas.visible).toBe(false);
    expect(orbits()).toEqual(Array(8).fill(false));

    solarSystemExperience.setFilters!({ "gas-and-dust": true, orbits: true });
    solarSystemExperience.setTime(today);
    expect(gas.visible).toBe(true);
    expect(orbits()).toEqual(Array(8).fill(true));
    solarSystemExperience.dispose();
  });

  it("draws no orbit lines before the planets settle, whatever the filter says", () => {
    const ctx = fakeSceneContext();
    solarSystemExperience.mount(ctx);
    solarSystemExperience.setFilters!({ "gas-and-dust": true, orbits: true });
    solarSystemExperience.setTime(mapping.toTime(0.3));
    expect(ctx.scene.getObjectsByProperty("name", "orbit").some((o) => o.visible)).toBe(false);
    solarSystemExperience.dispose();
  });
});
