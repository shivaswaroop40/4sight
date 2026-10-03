import { describe, expect, it } from "vitest";
import type { ExperienceId } from "./types";
import { formatMoment, parseMoment } from "./moment";

const IDS: ExperienceId[] = ["iphone", "solarSystem"];
const BASE = "http://localhost:5201/4sight/";

describe("parseMoment", () => {
  it("reads the experience and the position", () => {
    expect(parseMoment("?x=solarSystem&u=0.5", IDS, "iphone")).toEqual({ id: "solarSystem", u: 0.5 });
  });

  it("falls back on an unknown or missing experience", () => {
    expect(parseMoment("?x=galaxy&u=0.25", IDS, "iphone")).toEqual({ id: "iphone", u: 0.25 });
    expect(parseMoment("", IDS, "iphone")).toEqual({ id: "iphone", u: 0 });
  });

  it("reads a bad or missing u as 0 and clamps the rest", () => {
    expect(parseMoment("?x=iphone&u=soon", IDS, "iphone").u).toBe(0);
    expect(parseMoment("?x=iphone&u=", IDS, "iphone").u).toBe(0);
    expect(parseMoment("?x=iphone&u=Infinity", IDS, "iphone").u).toBe(0);
    expect(parseMoment("?x=iphone&u=1.7", IDS, "iphone").u).toBe(1);
    expect(parseMoment("?x=iphone&u=-3", IDS, "iphone").u).toBe(0);
  });
});

describe("formatMoment", () => {
  it("writes x and u, rounding u up to 4 decimal places", () => {
    expect(formatMoment(BASE, { id: "solarSystem", u: 0.123412 })).toBe(`${BASE}?x=solarSystem&u=0.1235`);
    expect(formatMoment(BASE, { id: "solarSystem", u: 0.3 })).toBe(`${BASE}?x=solarSystem&u=0.3`);
    expect(formatMoment(BASE, { id: "solarSystem", u: 0.00004 })).toBe(`${BASE}?x=solarSystem&u=0.0001`);
    expect(formatMoment(BASE, { id: "iphone", u: 1 })).toBe(`${BASE}?x=iphone&u=1`);
  });

  it("never lands before the moment, so a link made on an event flag opens on that event", () => {
    const eventU = 0.33111061330234265;
    const href = formatMoment(BASE, { id: "solarSystem", u: eventU });
    expect(href).toBe(`${BASE}?x=solarSystem&u=0.3312`);
    expect(parseMoment(new URL(href).search, IDS, "iphone").u).toBeGreaterThanOrEqual(eventU);
  });

  it("leaves u out at 0 and drops a stale one", () => {
    expect(formatMoment(`${BASE}?x=solarSystem&u=0.5`, { id: "iphone", u: 0 })).toBe(`${BASE}?x=iphone`);
  });

  it("keeps other params and the hash", () => {
    expect(formatMoment(`${BASE}?debug=1&x=iphone#notes`, { id: "solarSystem", u: 0.75 })).toBe(
      `${BASE}?debug=1&x=solarSystem&u=0.75#notes`,
    );
  });

  it("round-trips through parseMoment", () => {
    for (const u of [0, 0.0001, 0.3, 0.3333, 0.5, 0.7, 0.9999, 1]) {
      const href = formatMoment(BASE, { id: "solarSystem", u });
      expect(parseMoment(new URL(href).search, IDS, "iphone")).toEqual({ id: "solarSystem", u });
    }
  });
});
