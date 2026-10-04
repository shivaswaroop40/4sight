import { describe, expect, it } from "vitest";
import { freeBand, type HudPiece } from "./hudBand";

const PHONE = { top: 0, bottom: 844, left: 0, right: 390 };
const DESKTOP = { top: 0, bottom: 900, left: 0, right: 1440 };

describe("freeBand", () => {
  it("runs from the lowest top piece to the highest bottom piece", () => {
    const pieces: HudPiece[] = [
      { edge: "top", top: 12, bottom: 56, left: 12, right: 56 },
      { edge: "top", top: 66, bottom: 114, left: 12, right: 290 },
      { edge: "bottom", top: 600, bottom: 832, left: 12, right: 378 },
      { edge: "bottom", top: 554, bottom: 594, left: 12, right: 378 },
    ];
    expect(freeBand(PHONE, pieces)).toEqual({ top: 114 / 844, bottom: 554 / 844 });
  });

  it("leaves out a bottom piece that does not reach across the middle, like the desktop info card", () => {
    const pieces: HudPiece[] = [
      { edge: "top", top: 24, bottom: 74, left: 24, right: 160 },
      { edge: "bottom", top: 96, bottom: 520, left: 1072, right: 1416 },
      { edge: "bottom", top: 702, bottom: 876, left: 130, right: 1310 },
    ];
    expect(freeBand(DESKTOP, pieces)).toEqual({ top: 74 / 900, bottom: 702 / 900 });
  });

  it("is the whole stage when nothing is declared", () => {
    expect(freeBand(PHONE, [])).toEqual({ top: 0, bottom: 1 });
  });
});
