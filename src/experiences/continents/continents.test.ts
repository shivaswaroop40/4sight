import { describe, expect, it } from "vitest";
import { fakeSceneContext } from "../../renderer/fakeSceneContext";
import { spanClock } from "../../core/analogy";
import { YEAR_SECONDS } from "../../core/timescale";
import { ANCHORS, EVENTS } from "./continentsData";
import { continentsExperience as exp } from "./ContinentsExperience";
import { continentsStateAt, formatMa, rotationAt } from "./ContinentsState";
import { triangulate } from "./globeModel";
import { GREATER_INDIA, OUTLINES } from "./outlines";
import { toLonLat, toVec } from "./sphere";

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
    expect(exp.mapping.toTime(0)).toBe(-250);
    expect(exp.mapping.toTime(1)).toBe(0);
    expect(exp.mapping.toParam(exp.mapping.toTime(0.37))).toBeCloseTo(0.37, 9);
    expect(exp.mapping.ticks().map((t) => t.label)).toEqual(["250M yrs", "200M yrs", "150M yrs", "100M yrs", "50M yrs", "Today"]);
  });

  it("keeps events sorted and spanning exactly the range", () => {
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].time).toBeGreaterThan(EVENTS[i - 1].time);
    expect(EVENTS[0].time).toBe(exp.minTime);
    expect(Object.is(EVENTS[EVENTS.length - 1].time, exp.maxTime)).toBe(true);
    expect(exp.getCurrentEvent(0)!.title).toBe("Today");
    expect(exp.getCurrentEvent(-60)!.title).toBe("The dinosaurs die out");
  });
});

describe("continents outlines", () => {
  it("triangulates every outline as a simple polygon", () => {
    const polygons = [...Object.values(OUTLINES).flat(), ...GREATER_INDIA];
    for (const rings of polygons) {
      const points = rings.reduce((n, ring) => n + ring.length, 0);
      expect(triangulate(rings).tris).toHaveLength(points - 2 + 2 * (rings.length - 1));
    }
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

  it("slows India after the collision to the 4 to 5 cm a year the event card quotes", () => {
    const speeds = [45, 40, 30, 20, 10, 0].map((ma) => block(ma, "india").speed);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1] + 1e-6);
    expect(speeds[0]).toBeLessThan(10);
    expect(block(0, "india").speed).toBeGreaterThanOrEqual(4);
    expect(block(0, "india").speed).toBeLessThan(5);
    exp.setTime(0);
    expect(exp.getHoveredObject("india")!.properties!.Speed).toBe("4 cm a year");
  });

  it("drives India about 2,400 km into Asia since the collision, with Greater India's tip at the suture at 50 Ma", () => {
    const inEurasiaFrame = (p: readonly [number, number], ma: number) =>
      toLonLat(toVec(p).applyQuaternion(rotationAt("india", ma)).applyQuaternion(rotationAt("eurasia", ma).invert()));
    const tip = GREATER_INDIA[0][0].reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(inEurasiaFrame(tip, 50)[1]).toBeCloseTo(29.5, 0);
    expect(inEurasiaFrame(ANCHORS.india, 0)[1] - inEurasiaFrame(ANCHORS.india, 50)[1]).toBeCloseTo(22, 0);
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

  it("is a pure function of time: scrubbing back lands on the same world", () => {
    exp.setTime(-150);
    const first = exp.getHoveredObject("india");
    exp.setTime(-40);
    exp.setTime(-150);
    expect(exp.getHoveredObject("india")).toEqual(first);
    expect(first).toMatchObject({
      name: "India",
      description: "Deep in Gondwana, between Africa, Antarctica and Australia. Its northern edge, Greater India, reached far beyond today's coast.",
      properties: { "Centre latitude": "42°S", Speed: "3 cm a year" },
    });
    expect(exp.getState(-123.4)).toEqual(continentsStateAt(-123.4));
  });
});

describe("continents hover and views", () => {
  it("describes blocks as they are at the current time", () => {
    exp.setTime(-150);
    expect(exp.getHoveredObject("india")!.properties).toEqual({ "Centre latitude": "42°S", Speed: "3 cm a year" });
    exp.setTime(0);
    expect(exp.getHoveredObject("india")!.properties!["Centre latitude"]).toBe("21°N");
    expect(exp.getHoveredObject("ocean")!.name).toBe("Ocean");
    expect(exp.getHoveredObject("nowhere")).toBeNull();
  });

  it("calls the ocean Panthalassa exactly while its map label is drawn", () => {
    const labelOpacity = (time: number) => continentsStateAt(time).labels.find((l) => l.id === "panthalassa")!.opacity;
    exp.setTime(-171);
    expect(labelOpacity(-171)).toBeCloseTo(0.05, 9);
    expect(exp.getHoveredObject("ocean")!.name).toBe("Panthalassa");
    exp.setTime(-169);
    expect(labelOpacity(-169)).toBe(0);
    expect(exp.getHoveredObject("ocean")!.name).toBe("Ocean");
  });

  it("keeps the Tethys label up until Arabia closes it, as the stories say", () => {
    const tethys = (ma: number) => continentsStateAt(-ma).labels.find((l) => l.id === "tethys")!.opacity;
    expect(tethys(56)).toBe(1);
    expect(tethys(35)).toBe(1);
    expect(tethys(20)).toBe(0);
    exp.setTime(-35);
    expect(exp.getHoveredObject("africa")!.description).toBe("Crawling north into Europe, closing the old Tethys Ocean.");
    exp.setTime(-20);
    expect(exp.getHoveredObject("arabia")!.description).toBe("Arabia hits Asia and folds up the Zagros Mountains in Iran.");
  });

  it("offers the four ocean views and a today's-coastlines overlay, off by default", () => {
    expect(exp.getCameraPresets().map((p) => p.name)).toEqual(["Atlantic", "Indian Ocean", "Pacific", "South Pole"]);
    expect(exp.getAvailableFilters().map((f) => [f.id, f.name, f.defaultOn])).toEqual([
      ["today-coastlines", "Today's coastlines", false],
    ]);
  });

  it("draws today's coastline of every block when the overlay is on", () => {
    const ctx = fakeSceneContext();
    exp.mount(ctx);
    const ghosts = ctx.scene.getObjectByName("today-coastlines")!;
    exp.setTime(-150);
    expect(ghosts.visible).toBe(false);
    exp.setFilters!({ "today-coastlines": true });
    exp.setTime(-150);
    expect(ghosts.visible).toBe(true);
    expect(ghosts.children).toHaveLength(Object.values(OUTLINES).flat().length);
    exp.dispose();
  });
});

describe("continents one-day clock", () => {
  it("counts from Pangaea, 250 million years ago, not from the zero of the axis", () => {
    const at = (time: number) => spanClock(time, exp.minTime, exp.maxTime);
    expect(exp.elapsedSpanSeconds).toBe(250e6 * YEAR_SECONDS);
    expect(at(-250)).toBe("12:00:00 am");
    expect(at(-125)).toBe("12:00:00 pm");
    expect(at(-66)).toBe("5:39:50 pm");
    expect(at(0)).toBe("midnight");
  });
});
