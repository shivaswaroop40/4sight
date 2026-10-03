import { describe, expect, it } from "vitest";
import { spanClock } from "../../core/analogy";
import { mitosisExperience as exp } from "./MitosisExperience";

const pose = (t: number, id: string) => exp.getState(t).objects.find((o) => o.id === id)!;

describe("mitosis timeline", () => {
  it("walks the phases in order over about an hour", () => {
    expect(exp.events.map((e) => [e.id, e.time])).toEqual([
      ["interphase", 0],
      ["prophase", 5],
      ["prometaphase", 20],
      ["metaphase", 30],
      ["anaphase", 45],
      ["telophase", 50],
      ["cytokinesis", 52],
      ["daughters", 62],
    ]);
    expect(exp.minTime).toBe(0);
    expect(exp.maxTime).toBe(65);
  });

  it("reads time in minutes", () => {
    expect(exp.mapping.format(38)).toBe("38 min");
    expect(exp.mapping.format(65)).toBe("1 h 05 min");
    expect(exp.mapping.toTime(0.5)).toBe(32.5);
  });

  it("names the event at a time", () => {
    expect(exp.getCurrentEvent(47)?.title).toBe("Anaphase");
    expect(exp.getCurrentEvent(64)?.title).toBe("Two daughter cells");
  });

  it("offers three views", () => {
    expect(exp.getCameraPresets().map((p) => p.name)).toEqual(["Front", "Three-quarter", "Down the spindle"]);
  });

  it("is a pure function of time", () => {
    const a = exp.getState(47.3);
    exp.getState(12);
    expect(exp.getState(47.3)).toEqual(a);
  });
});

describe("mitosis state", () => {
  it("starts as one cell with an intact nucleus and two centrosomes side by side", () => {
    expect(pose(0, "cell-a").visible).toBe(true);
    expect(pose(0, "cell-b").visible).toBe(false);
    expect(pose(0, "nucleus").opacity).toBe(0.4);
    expect(pose(0, "nucleolus").visible).toBe(true);
    expect(pose(0, "centrosome-l").position).toEqual([-0.3, 1.85, 0.25]);
    expect(pose(0, "centrosome-r").position).toEqual([0.3, 1.85, 0.25]);
    expect(pose(0, "contractile-ring").visible).toBe(false);
  });

  it("loses the nucleolus in prophase and the envelope in prometaphase", () => {
    expect(pose(16, "nucleolus").visible).toBe(false);
    expect(pose(19, "nucleus").opacity).toBe(0.4);
    expect(pose(23, "nucleus").visible).toBe(false);
    expect(pose(21, "envelope-fragment-1").visible).toBe(true);
    expect(pose(30, "envelope-fragment-1").visible).toBe(false);
  });

  it("puts the poles on the spindle axis and the sisters on either side of the plate at metaphase", () => {
    expect(pose(35, "centrosome-l").position).toEqual([-2.3, 0, 0]);
    expect(pose(35, "centrosome-r").position).toEqual([2.3, 0, 0]);
    for (const c of ["c1", "c2", "c3", "c4"]) {
      const a = pose(45, `${c}a`).position[0];
      const b = pose(45, `${c}b`).position[0];
      expect(a).toBeCloseTo(-0.06, 6);
      expect(b).toBeCloseTo(0.06, 6);
      expect(pose(45, `kfibre-${c}a`).visible).toBe(true);
    }
  });

  it("pulls the sisters to opposite poles by the end of anaphase", () => {
    expect(pose(50, "c1a").position[0]).toBe(-1.95);
    expect(pose(50, "c1b").position[0]).toBe(1.95);
    const fibre = pose(50, "kfibre-c1a");
    const pole = pose(50, "centrosome-l").position;
    expect(fibre.scale[1]).toBeCloseTo(Math.hypot(-1.95 - pole[0], 0.625 - pole[1], 0.275 - pole[2]), 4);
  });

  it("ends as two cells with new nuclei, joined by a closed-down ring", () => {
    expect(pose(65, "cell-a").position).toEqual([-2.38, 0, 0]);
    expect(pose(65, "cell-b").position).toEqual([2.38, 0, 0]);
    expect(pose(65, "cell-a").scale).toEqual([2.4, 2.4, 2.4]);
    expect(pose(65, "contractile-ring").scale[0]).toBeCloseTo(0.269, 3);
    expect(pose(50, "daughter-nucleus-a").visible).toBe(false);
    expect(pose(65, "daughter-nucleus-a").opacity).toBe(0.4);
    expect(pose(65, "daughter-nucleus-b").opacity).toBe(0.4);
    expect(pose(65, "kfibre-c1a").visible).toBe(false);
  });

  it("describes the chromosomes for the phase on screen", () => {
    exp.setTime(2);
    expect(exp.getHoveredObject("chromosome")?.description).toBe(
      "Copied but still loose: two sister chromatids of long, tangled chromatin.",
    );
    exp.setTime(47);
    expect(exp.getHoveredObject("chromosome")?.description).toMatch(/^The sisters have split\./);
    expect(exp.getHoveredObject("chromosome")?.properties).toEqual({
      "In a human cell": 46,
      "Shown here": 4,
      "Each chromatid": "one DNA molecule",
    });
  });
});

describe("mitosis one-day clock", () => {
  it("squeezes 65 minutes into a day", () => {
    const at = (minute: number) => spanClock(minute, exp.minTime, exp.maxTime);
    expect(exp.elapsedSpanSeconds).toBe(3900);
    expect(at(13)).toBe("4:48:00 am");
    expect(at(65)).toBe("midnight");
  });
});
