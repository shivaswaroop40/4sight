import { describe, expect, it } from "vitest";
import { spanClock } from "../../core/analogy";
import { effectiveRate, formatRate } from "../../core/warp";
import { cityExperience as exp } from "./CityExperience";

const pose = (year: number, id: string) => exp.getState(year).objects.find((o) => o.id === id)!;
const shown = (year: number, id: string) => pose(year, id).visible;
const hex = (year: number, id: string) =>
  `#${pose(year, id).color.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;

describe("city timeline", () => {
  it("runs from 1700 to 2025 on a knotted slider", () => {
    expect(exp.minTime).toBe(1700);
    expect(exp.maxTime).toBe(2025);
    expect(exp.mapping.format(1838.4)).toBe("1838");
    expect(exp.mapping.toTime(0.27)).toBe(1830);
    expect(exp.mapping.toParam(1880)).toBeCloseTo(0.45, 9);
    expect(exp.mapping.toTime(0.36)).toBeCloseTo(1855, 9);
    expect(exp.mapping.toParam(exp.mapping.toTime(0.66))).toBeCloseTo(0.66, 9);
    expect(exp.mapping.ticks().map((t) => t.label)).toEqual(["1700", "1760", "1830", "1880", "1930", "1970", "Today"]);
  });

  it("tells the story in order, inside the range", () => {
    expect(exp.events.map((e) => [e.id, e.time])).toEqual([
      ["village", 1700],
      ["port", 1758],
      ["canal", 1792],
      ["gaslight", 1818],
      ["railway", 1838],
      ["factories", 1846],
      ["electric", 1882],
      ["bridge", 1887],
      ["trams", 1895],
      ["skyscrapers", 1902],
      ["cars", 1957],
      ["glass", 1965],
      ["decline", 1976],
      ["park", 1987],
      ["highway-down", 2001],
      ["today", 2012],
    ]);
  });

  it("offers three views", () => {
    expect(exp.getCameraPresets().map((p) => p.name)).toEqual(["Aerial", "Street level", "River view"]);
  });

  it("shows the playback rate in years per second at every warp preset", () => {
    const rate = (warp: number) => formatRate(exp.mapping, effectiveRate(exp.mapping, exp.baseDurationSeconds, 0.5, warp));
    expect(exp.warpPresets.map(rate)).toEqual(["≈ 1.4 years / s", "≈ 2.8 years / s", "≈ 5.6 years / s", "≈ 11 years / s", "≈ 22 years / s"]);
  });
});

describe("city state", () => {
  it("starts as a village: church, mill and fields, nothing industrial", () => {
    expect(shown(1700, "church")).toBe(true);
    expect(shown(1700, "mill")).toBe(true);
    expect(shown(1700, "field-1")).toBe(true);
    for (const id of ["wooden-bridge", "bridge", "train", "railway", "factory-1", "highway", "quay-1"]) {
      expect(shown(1700, id)).toBe(false);
    }
  });

  it("builds the port and a wooden bridge in the 1700s", () => {
    expect(shown(1800, "quay-1")).toBe(true);
    expect(shown(1800, "warehouse-1")).toBe(true);
    expect(shown(1800, "wooden-bridge")).toBe(true);
    expect(shown(1800, "canal")).toBe(true);
  });

  it("lights the quay with gas, then swaps each lamp for an electric one from 1882", () => {
    expect(shown(1810, "gas-lamp-1")).toBe(false);
    expect(shown(1850, "gas-lamp-1")).toBe(true);
    expect(shown(1882, "electric-lamp-1")).toBe(false);
    expect(shown(1890, "gas-lamp-8")).toBe(false);
    expect(shown(1890, "electric-lamp-8")).toBe(true);
    for (let lamp = 1; lamp <= 8; lamp++) {
      for (let year = 1800; year <= 1900; year += 0.05) {
        const both = shown(year, `gas-lamp-${lamp}`) && shown(year, `electric-lamp-${lamp}`);
        expect(both, `lamp ${lamp} in ${year.toFixed(2)}`).toBe(false);
      }
    }
  });

  it("brings the railway in the 1830s and swaps steam for electric in the 1960s", () => {
    expect(shown(1835, "railway")).toBe(false);
    expect(shown(1845, "railway")).toBe(true);
    expect(shown(1845, "train")).toBe(true);
    expect(hex(1900, "train-boiler")).toBe("#4f6b5a");
    expect(hex(2000, "train-boiler")).toBe("#e2e0d8");
    expect(shown(1900, "train-chimney")).toBe(true);
    expect(shown(2000, "train-chimney")).toBe(false);
  });

  it("replaces the wooden bridge with a steel one", () => {
    expect(shown(1885, "wooden-bridge")).toBe(true);
    expect(shown(1885, "bridge")).toBe(false);
    expect(shown(1895, "wooden-bridge")).toBe(false);
    expect(shown(1895, "bridge")).toBe(true);
  });

  it("runs trams until the 1950s and light rail from 2012", () => {
    expect(shown(1900, "tram")).toBe(true);
    expect(shown(1970, "tram")).toBe(false);
    expect(shown(1970, "light-rail")).toBe(false);
    expect(shown(2020, "light-rail")).toBe(true);
  });

  it("smokes while the works run, then keeps one chimney in a park", () => {
    expect(shown(1880, "factory-1")).toBe(true);
    expect(shown(1880, "factory-1-smoke-1")).toBe(true);
    expect(shown(1990, "factory-1")).toBe(false);
    expect(shown(1990, "factory-1-smoke-1")).toBe(false);
    expect(shown(2025, "factory-1-chimney")).toBe(true);
    expect(shown(2025, "factory-2-chimney")).toBe(false);
    expect(shown(2025, "pond")).toBe(true);
    expect(hex(1950, "district-works")).toBe("#b9a07a");
    expect(hex(2000, "district-works")).toBe("#a8c98a");
  });

  it("puts up an elevated highway in 1957 and replaces it with a promenade", () => {
    expect(shown(1960, "highway")).toBe(true);
    expect(shown(1960, "highway-car-1")).toBe(true);
    expect(shown(2010, "highway")).toBe(false);
    expect(shown(2010, "promenade-tree-1")).toBe(true);
  });

  it("stops the mill wheel when the mill stops working", () => {
    expect(pose(1700, "mill-wheel").rotation[2]).toBe(0);
    expect(pose(1795, "mill-wheel").rotation[2]).toBe(-20900);
    expect(pose(1950, "mill-wheel").rotation).toEqual(pose(2025, "mill-wheel").rotation);
  });

  it("finishes every dated landmark and structure by the year its card gives", () => {
    const byId = new Map(exp.def.objects.map((o) => [o.id, o]));
    const root = (id: string) => {
      let o = byId.get(id)!;
      while (o.parent) o = byId.get(o.parent)!;
      return o.id;
    };
    const dated = Object.entries(exp.def.hover).flatMap(([id, h]) => {
      const year = h.properties?.Built ?? h.properties?.Opened;
      return typeof year === "number" && (h.category === "landmark" || h.category === "transport") ? [[id, year] as const] : [];
    });
    expect(dated.map(([id]) => id)).toEqual([
      "railway", "station", "riverside-works", "wooden-bridge", "bridge", "highway", "ring-road", "exchange", "meridian", "glass-tower", "river-spire",
    ]);
    for (const [hover, year] of dated) {
      const roots = new Set(exp.def.objects.filter((o) => o.hover === hover).map((o) => root(o.id)));
      for (const id of roots) {
        expect(pose(year, id).scale, `${id} (${hover}) in ${year}`).toEqual([1, 1, 1]);
        expect(shown(year - 5, id), `${id} (${hover}) in ${year - 5}`).toBe(false);
      }
    }
  });

  it("describes landmarks for the year on screen", () => {
    exp.setTime(1720);
    expect(exp.getHoveredObject("mill")?.description).toBe(
      "The river turns the wheel, and the wheel turns millstones that grind grain into flour.",
    );
    exp.setTime(1995);
    expect(exp.getHoveredObject("mill")?.description).toBe("Restored as a café and small museum.");
    expect(exp.getHoveredObject("chimney")?.description).toMatch(/monument/);
  });

  it("does not mention the park before it is laid out, or the station before it opens", () => {
    exp.setTime(1980);
    expect(exp.getHoveredObject("chimney")?.description).not.toMatch(/park|monument/);
    exp.setTime(1987);
    expect(exp.getHoveredObject("chimney")?.description).toMatch(/monument in the new park/);
    exp.setTime(1837);
    expect(exp.getHoveredObject("station-quarter")?.description).not.toMatch(/station/);
    exp.setTime(1840);
    expect(exp.getHoveredObject("station-quarter")?.description).toMatch(/station/);
  });
});

describe("city one-day clock", () => {
  it("counts from 1700, not from year zero", () => {
    const at = (year: number) => spanClock(year, exp.minTime, exp.maxTime);
    expect(exp.elapsedSpanSeconds).toBe(325 * 31_557_600);
    expect(at(1700)).toBe("12:00:00 am");
    expect(at(1862.5)).toBe("12:00:00 pm");
    expect(at(1880)).toBe("1:17:32 pm");
  });
});
