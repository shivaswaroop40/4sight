import { describe, expect, it } from "vitest";
import { REFERENCE_BAND, fitStage } from "./stageFit";

const band = (top: number, bottom: number, height: number) => ({ top: top / height, bottom: bottom / height });

describe("fitStage", () => {
  it("keeps the authored framing on the 1440x900 layout", () => {
    const fit = fitStage(1440 / 900, REFERENCE_BAND);
    expect(fit.scale).toBeCloseTo(1, 9);
    expect(fit.centerY).toBeCloseTo(0.5, 9);
  });

  it("fits a phone's width and lifts the target between the top bar and the bottom sheet", () => {
    const fit = fitStage(390 / 844, band(114, 554, 844));
    expect(fit.scale).toBeCloseTo(1.661, 3);
    expect(fit.centerY * 844).toBeCloseTo(377.4, 1);
  });

  it("backs off further for a subject that spreads sideways", () => {
    expect(fitStage(390 / 844, band(114, 554, 844), 1.45).scale).toBeCloseTo(2.19, 2);
  });

  it("fits the band's height when the screen is wide but short", () => {
    const fit = fitStage(1280 / 720, band(74, 526, 720));
    expect(fit.scale).toBeCloseTo(1.112, 3);
    expect(fit.centerY * 720).toBeCloseTo(344.6, 1);
  });

  it("falls back to the authored framing when the HUD leaves almost nothing free", () => {
    expect(fitStage(844 / 390, band(116, 90, 390))).toEqual({ scale: 1, centerY: 0.5 });
  });

  it("ignores the subject's width on a landscape screen", () => {
    expect(fitStage(1440 / 900, REFERENCE_BAND, 1.45).scale).toBeCloseTo(1, 9);
  });
});
