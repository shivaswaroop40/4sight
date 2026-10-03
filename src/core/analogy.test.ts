import { describe, expect, it } from "vitest";
import { dayClock } from "./analogy";

describe("dayClock", () => {
  it("starts at midnight on the clock face and ends at midnight", () => {
    expect(dayClock(0)).toBe("12:00:00 am");
    expect(dayClock(0.5)).toBe("12:00:00 pm");
    expect(dayClock(1)).toBe("midnight");
  });

  it("reads am and pm on a 12-hour face", () => {
    expect(dayClock(1 / 24)).toBe("1:00:00 am");
    expect(dayClock(13 / 24)).toBe("1:00:00 pm");
    expect(dayClock(0.75)).toBe("6:00:00 pm");
  });

  it("floors to the second", () => {
    expect(dayClock(86_323.9 / 86_400)).toBe("11:58:43 pm");
    expect(dayClock(0.999_999)).toBe("11:59:59 pm");
    expect(dayClock(59.99 / 86_400)).toBe("12:00:59 am");
  });

  it("puts 50 million of 4.6 billion years about a quarter hour in", () => {
    expect(dayClock(50e6 / 4.6e9)).toBe("12:15:39 am");
  });

  it("clamps outside [0, 1]", () => {
    expect(dayClock(-0.2)).toBe("12:00:00 am");
    expect(dayClock(1.3)).toBe("midnight");
  });
});
