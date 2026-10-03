import { describe, expect, it } from "vitest";
import { defaultFilterState, isDefaultFilterState, toggleFilter } from "./filters";
import type { VisualizationFilter } from "./types";

const FILTERS: VisualizationFilter[] = [
  { id: "gas", name: "Gas & dust", defaultOn: true },
  { id: "xray", name: "X-ray", defaultOn: false },
  { id: "true", name: "True colour", group: "colour", defaultOn: true },
  { id: "heat", name: "Heat", group: "colour", defaultOn: false },
  { id: "age", name: "Age", group: "colour", defaultOn: false },
];

const DEFAULTS = { gas: true, xray: false, true: true, heat: false, age: false };

describe("filter state", () => {
  it("starts every filter at its default", () => {
    expect(defaultFilterState(FILTERS)).toEqual(DEFAULTS);
    expect(defaultFilterState([])).toEqual({});
  });

  it("flips an ungrouped filter and flips it back", () => {
    const off = toggleFilter(FILTERS, DEFAULTS, "gas");
    expect(off).toEqual({ ...DEFAULTS, gas: false });
    expect(toggleFilter(FILTERS, off, "gas")).toEqual(DEFAULTS);
    expect(toggleFilter(FILTERS, DEFAULTS, "xray")).toEqual({ ...DEFAULTS, xray: true });
  });

  it("selects a radio option and clears the rest of its group only", () => {
    const heat = toggleFilter(FILTERS, { ...DEFAULTS, xray: true }, "heat");
    expect(heat).toEqual({ gas: true, xray: true, true: false, heat: true, age: false });
    expect(toggleFilter(FILTERS, heat, "age")).toEqual({ gas: true, xray: true, true: false, heat: false, age: true });
  });

  it("keeps the selected radio option on when it is picked again", () => {
    expect(toggleFilter(FILTERS, DEFAULTS, "true")).toBe(DEFAULTS);
  });

  it("ignores an unknown id", () => {
    expect(toggleFilter(FILTERS, DEFAULTS, "nope")).toBe(DEFAULTS);
  });

  it("knows when the state is back at the defaults", () => {
    expect(isDefaultFilterState(FILTERS, DEFAULTS)).toBe(true);
    expect(isDefaultFilterState(FILTERS, toggleFilter(FILTERS, DEFAULTS, "heat"))).toBe(false);
    expect(isDefaultFilterState(FILTERS, toggleFilter(FILTERS, toggleFilter(FILTERS, DEFAULTS, "xray"), "xray"))).toBe(
      true,
    );
  });
});
