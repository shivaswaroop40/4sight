import { describe, expect, it } from "vitest";
import { spanClock } from "../../core/analogy";
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

  it("is a pure function of time", () => {
    const a = exp.getState(1923.7);
    exp.getState(1777);
    expect(exp.getState(1923.7)).toEqual(a);
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

  it("lights the quay with gas, then electricity", () => {
    expect(shown(1810, "gas-lamp-1")).toBe(false);
    expect(shown(1850, "gas-lamp-1")).toBe(true);
    expect(shown(1850, "electric-lamp-1")).toBe(false);
    expect(shown(1900, "gas-lamp-1")).toBe(false);
    expect(shown(1900, "electric-lamp-1")).toBe(true);
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

  it("raises the art deco tower in 1930 and the River Spire in 2014", () => {
    const meridian = exp.def.objects.find((o) => o.hover === "meridian")!;
    const owner = meridian.parent!;
    expect(shown(1925, owner)).toBe(false);
    expect(shown(1935, owner)).toBe(true);
    const spire = exp.def.objects.find((o) => o.hover === "river-spire")!.parent!;
    expect(shown(2010, spire)).toBe(false);
    expect(shown(2020, spire)).toBe(true);
  });

  it("describes landmarks for the year on screen", () => {
    exp.setTime(1720);
    expect(exp.getHoveredObject("mill")?.description).toBe(
      "The river turns the wheel, and the wheel turns millstones that grind grain into flour.",
    );
    exp.setTime(1995);
    expect(exp.getHoveredObject("mill")?.description).toBe("Restored as a café and small museum.");
    expect(exp.getHoveredObject("chimney")?.description).toMatch(/kept as a monument/);
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
