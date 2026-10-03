import { describe, expect, it } from "vitest";
import { byTimescale, formatSpan, rungPosition, YEAR_SECONDS } from "./timescale";

describe("formatSpan", () => {
  it("names spans the way a person would say them", () => {
    expect(formatSpan(1)).toBe("1 second");
    expect(formatSpan(10)).toBe("10 seconds");
    expect(formatSpan(90)).toBe("1.5 minutes");
    expect(formatSpan(3600)).toBe("1 hour");
    expect(formatSpan(86_400 * 3)).toBe("3 days");
    expect(formatSpan(YEAR_SECONDS)).toBe("1 year");
    expect(formatSpan(100 * YEAR_SECONDS)).toBe("100 years");
    expect(formatSpan(300 * YEAR_SECONDS)).toBe("300 years");
    expect(formatSpan(250_000 * YEAR_SECONDS)).toBe("250,000 years");
    expect(formatSpan(250e6 * YEAR_SECONDS)).toBe("250 million years");
    expect(formatSpan(4.6e9 * YEAR_SECONDS)).toBe("4.6 billion years");
    expect(formatSpan(13.8e9 * YEAR_SECONDS)).toBe("13.8 billion years");
  });

  it("labels every gallery span naturally", () => {
    expect(formatSpan(0.8)).toBe("0.8 seconds");
    expect(formatSpan(10)).toBe("10 seconds");
    expect(formatSpan(65 * 60)).toBe("65 minutes");
    expect(formatSpan(150 * YEAR_SECONDS)).toBe("150 years");
    expect(formatSpan(325 * YEAR_SECONDS)).toBe("325 years");
    expect(formatSpan(250e6 * YEAR_SECONDS)).toBe("250 million years");
    expect(formatSpan(4.6e9 * YEAR_SECONDS)).toBe("4.6 billion years");
    expect(formatSpan(13.8e9 * YEAR_SECONDS)).toBe("13.8 billion years");
  });

  it("steps down a unit instead of showing two decimals, unless that runs into thousands", () => {
    expect(formatSpan(100 * 60)).toBe("100 minutes");
    expect(formatSpan(2.5 * 3600)).toBe("2.5 hours");
    expect(formatSpan(4.57e9 * YEAR_SECONDS)).toBe("4.57 billion years");
    expect(formatSpan(0.25)).toBe("0.25 seconds");
  });
});

describe("byTimescale", () => {
  it("orders shortest to longest and keeps ties in registry order", () => {
    const entries = [
      { id: "universe", spanSeconds: 4.4e17 },
      { id: "iphone", spanSeconds: 10 },
      { id: "galaxy", spanSeconds: 3e16 },
      { id: "tie", spanSeconds: 10 },
    ];
    expect(byTimescale(entries).map((e) => e.id)).toEqual(["iphone", "tie", "galaxy", "universe"]);
    expect(entries.map((e) => e.id)).toEqual(["universe", "iphone", "galaxy", "tie"]);
  });
});

describe("rungPosition", () => {
  it("runs from one second to the age of the universe on a log scale", () => {
    expect(rungPosition(1)).toBe(0);
    expect(rungPosition(0.2)).toBe(0);
    expect(rungPosition(10)).toBeCloseTo(0.0567, 3);
    expect(rungPosition(4.6e9 * YEAR_SECONDS)).toBeCloseTo(0.9729, 3);
    expect(rungPosition(13.8e9 * YEAR_SECONDS)).toBeCloseTo(1, 9);
    expect(rungPosition(1e20)).toBe(1);
  });
});
