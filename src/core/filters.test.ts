import { describe, expect, it } from "vitest";
import { experiences } from "../experiences/index";
import { defaultFilterState, filterProblems, isDefaultFilterState, isFilterOn, toggleFilter } from "./filters";
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

  it("reads a filter the state leaves out as its default", () => {
    expect(["gas", "xray", "true", "heat", "nope"].map((id) => isFilterOn(FILTERS, {}, id))).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
    expect(isFilterOn(FILTERS, { gas: false, xray: true }, "gas")).toBe(false);
    expect(isFilterOn(FILTERS, { gas: false, xray: true }, "xray")).toBe(true);
  });
});

describe("filter rules", () => {
  it("accepts unique ids and one default per group", () => {
    expect(filterProblems(FILTERS)).toEqual([]);
    expect(filterProblems([])).toEqual([]);
  });

  it("names a repeated id and a group without exactly one default", () => {
    expect(
      filterProblems([
        { id: "a", name: "A", defaultOn: true },
        { id: "a", name: "A again", defaultOn: false },
        { id: "x", name: "X", group: "none", defaultOn: false },
        { id: "y", name: "Y", group: "two", defaultOn: true },
        { id: "z", name: "Z", group: "two", defaultOn: true },
      ]),
    ).toEqual([
      'Filter id "a" is used twice.',
      'Filter group "none" has 0 options on by default, not 1.',
      'Filter group "two" has 2 options on by default, not 1.',
    ]);
  });

  it("holds for every registered experience", async () => {
    const problems = await Promise.all(
      experiences.map(async (entry) => [entry.id, filterProblems((await entry.load()).filters?.options ?? [])]),
    );
    expect(problems).toEqual(experiences.map((entry) => [entry.id, []]));
  });
});
