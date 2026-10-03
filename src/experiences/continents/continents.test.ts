import { describe, expect, it } from "vitest";
import { EVENTS } from "./continentsData";
import { continentsExperience as exp } from "./ContinentsExperience";
import { continentsStateAt, formatMa } from "./ContinentsState";

function block(ma: number, id: string) {
  return continentsStateAt(-ma).blocks.find((b) => b.id === id)!;
}

function degreesApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const cos =
    Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((a.lon - b.lon) * r);
  return Math.acos(Math.min(1, cos)) / r;
}

describe("continents time axis", () => {
  it("reads as millions of years ago, ending at Today", () => {
    expect(formatMa(-250)).toBe("250 million years ago");
    expect(formatMa(-200)).toBe("200 million years ago");
    expect(formatMa(-0.3)).toBe("Today");
    expect(formatMa(0)).toBe("Today");
  });

  it("formats playback rates as plain spans", () => {
    expect(formatMa(6.25)).toBe("6.3 million years");
    expect(formatMa(25)).toBe("25 million years");
  });

  it("runs from Pangaea to today, linearly", () => {
    expect(exp.minTime).toBe(-250);
    expect(exp.maxTime).toBe(0);
    expect(exp.mapping.toTime(0)).toBe(-250);
    expect(exp.mapping.toTime(1)).toBe(0);
    expect(exp.mapping.toParam(exp.mapping.toTime(0.37))).toBeCloseTo(0.37, 9);
    expect(exp.mapping.ticks().map((t) => t.label)).toEqual(["250M yrs", "200M yrs", "150M yrs", "100M yrs", "50M yrs", "Today"]);
  });

  it("keeps events sorted, inside the range, from Pangaea to Today", () => {
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].time).toBeGreaterThan(EVENTS[i - 1].time);
    expect(EVENTS[0]).toMatchObject({ time: -250, title: "Pangaea", when: "250 million years ago" });
    expect(EVENTS[EVENTS.length - 1]).toMatchObject({ time: 0, title: "Today", when: "Today" });
    expect(EVENTS.find((e) => e.id === "k-pg")!.time).toBe(-66);
    expect(EVENTS.find((e) => e.id === "india-asia")!.time).toBe(-50);
  });
});

describe("continents reconstruction", () => {
  it("puts every block at its present-day position today", () => {
    for (const b of continentsStateAt(0).blocks) {
      const [x, y, z, w] = b.quaternion;
      expect(Math.abs(w)).toBeCloseTo(1, 9);
      expect(Math.hypot(x, y, z)).toBeCloseTo(0, 9);
    }
    expect(block(0, "india").centre.lat).toBeCloseTo(21, 6);
    expect(block(0, "india").centre.lon).toBeCloseTo(78, 6);
  });

  it("keeps India far south in Gondwana and north of the equator today", () => {
    expect(block(150, "india").centre.lat).toBeLessThan(-35);
    expect(block(66, "india").centre.lat).toBeLessThan(-15);
    expect(block(0, "india").centre.lat).toBeGreaterThan(15);
  });

  it("has India racing north far faster than plates move today", () => {
    expect(block(60, "india").speed).toBeGreaterThan(15);
    expect(block(0, "africa").speed).toBeLessThan(3);
    expect(block(0, "australia").speed).toBeGreaterThan(6);
  });

  it("opens the Atlantic", () => {
    const gap = (ma: number) => degreesApart(block(ma, "northAmerica").centre, block(ma, "africa").centre);
    expect(gap(120)).toBeGreaterThan(gap(200));
    expect(gap(0)).toBeGreaterThan(gap(120) + 15);
  });

  it("parks Antarctica on the South Pole and ices it over after 34 million years ago", () => {
    expect(block(66, "antarctica").centre.lat).toBeLessThan(-75);
    expect(block(40, "antarctica").ice).toBe(0);
    expect(block(0, "antarctica").ice).toBe(1);
    expect(block(5, "greenland").ice).toBe(0);
    expect(block(0, "greenland").ice).toBe(1);
  });

  it("raises the Himalaya only after India arrives, and wears the Appalachians down", () => {
    expect(continentsStateAt(-100).ranges.himalaya).toBe(0);
    expect(continentsStateAt(0).ranges.himalaya).toBe(1);
    expect(continentsStateAt(-250).ranges.appalachians).toBe(1);
    expect(continentsStateAt(0).ranges.appalachians).toBeCloseTo(0.4, 9);
  });

  it("is a pure function of time", () => {
    expect(exp.getState(-123.4)).toEqual(exp.getState(-123.4));
    exp.setTime(-150);
    exp.setTime(-40);
    const after = exp.getHoveredObject("india");
    exp.setTime(-40);
    expect(exp.getHoveredObject("india")).toEqual(after);
  });
});

describe("continents hover and views", () => {
  it("describes blocks as they are at the current time", () => {
    exp.setTime(-150);
    expect(exp.getHoveredObject("india")).toMatchObject({
      name: "India",
      properties: { "Centre latitude": `${Math.round(-block(150, "india").centre.lat)}°S` },
    });
    exp.setTime(0);
    expect(exp.getHoveredObject("india")!.properties!["Centre latitude"]).toBe("21°N");
    expect(exp.getHoveredObject("nowhere")).toBeNull();
  });

  it("offers the four ocean views and no filters", () => {
    expect(exp.getCameraPresets().map((p) => p.name)).toEqual(["Atlantic", "Indian Ocean", "Pacific", "South Pole"]);
    expect(exp.getAvailableFilters()).toEqual([]);
  });
});
