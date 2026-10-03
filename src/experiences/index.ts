// src/experiences/index.ts
//
// Registry of every experience. An entry is light metadata plus a dynamic
// import, so each experience is its own chunk and downloads only when the
// viewer picks it. To add one, append an entry to the `real` array:
//
//   {
//     id: "galaxy",
//     name: "Galaxy",
//     tagline: "A spiral galaxy winds itself up",
//     spanSeconds: 13.6e9 * YEAR_SECONDS,
//     load: () => import("./galaxy/GalaxyExperience").then((m) => m.galaxyExperience),
//   },
//
// The gallery orders entries by spanSeconds, shortest first, so it reads as
// a ladder of timescales whatever the order here.
//
// The mocks are shown only while no real experience is registered, so the
// shell is always testable and the demo never shows them once a lane lands.

import { memoizeLoad } from "../core/memoizeLoad";
import { byTimescale, YEAR_SECONDS } from "../core/timescale";
import type { ExperienceId, FourDExperience } from "../core/types";

export interface ExperienceEntry {
  id: ExperienceId;
  name: string;
  /** One line for the gallery card, under ~60 characters. */
  tagline: string;
  /** Length of the span of time the experience shows, in real seconds. */
  spanSeconds: number;
  /** Dynamic import, so each experience is its own chunk. */
  load: () => Promise<FourDExperience>;
}

const real: ExperienceEntry[] = [
  {
    id: "iphone",
    name: "iPhone",
    tagline: "A phone builds itself, then wakes up",
    spanSeconds: 10,
    load: () => import("./iphone/IPhoneExperience").then((m) => m.iphoneExperience),
  },
  {
    id: "solarSystem",
    name: "Solar System",
    tagline: "A cloud of dust becomes the Sun and eight planets",
    spanSeconds: 4.6e9 * YEAR_SECONDS,
    load: () => import("./solar-system/SolarSystemExperience").then((m) => m.solarSystemExperience),
  },
  {
    id: "heart",
    name: "Heartbeat",
    tagline: "One beat of a human heart, in slow motion",
    spanSeconds: 0.8,
    load: () => import("./heart/HeartExperience").then((m) => m.heartExperience),
  },
  {
    id: "mitosis",
    name: "Mitosis",
    tagline: "One cell splits into two",
    spanSeconds: 65 * 60,
    load: () => import("./mitosis/MitosisExperience").then((m) => m.mitosisExperience),
  },
  {
    id: "tree",
    name: "Oak tree",
    tagline: "An acorn grows into a grand old oak",
    spanSeconds: 150 * YEAR_SECONDS,
    load: () => import("./tree/TreeExperience").then((m) => m.treeExperience),
  },
  {
    id: "city",
    name: "River City",
    tagline: "A village by a river becomes a city",
    spanSeconds: 325 * YEAR_SECONDS,
    load: () => import("./city/CityExperience").then((m) => m.cityExperience),
  },
  {
    id: "continents",
    name: "Continental drift",
    tagline: "Pangaea breaks apart into today's continents",
    spanSeconds: 250e6 * YEAR_SECONDS,
    load: () => import("./continents/ContinentsExperience").then((m) => m.continentsExperience),
  },
  {
    id: "universe",
    name: "Universe",
    tagline: "From the Big Bang to today",
    spanSeconds: 13.8e9 * YEAR_SECONDS,
    load: () => import("./universe/UniverseExperience").then((m) => m.universeExperience),
  },
];

const mocks: ExperienceEntry[] = [
  {
    id: "mock",
    name: "Linear mock",
    tagline: "A cube hops from A to C",
    spanSeconds: 1,
    load: () => import("./mock/mockExperience").then((m) => m.mockExperience),
  },
  {
    id: "mockLog",
    name: "Log mock",
    tagline: "A toy solar system on a log timeline",
    spanSeconds: 4.6e9 * YEAR_SECONDS,
    load: () => import("./mock/mockLogExperience").then((m) => m.mockLogExperience),
  },
];

/** Shortest timescale first. */
export const experiences: ExperienceEntry[] = byTimescale(real.length > 0 ? real : mocks);

export function entryFor(id: ExperienceId): ExperienceEntry | undefined {
  return experiences.find((e) => e.id === id);
}

export const loadExperience = memoizeLoad((id: ExperienceId) => {
  const entry = entryFor(id);
  return entry ? entry.load() : Promise.reject(new Error(`No experience "${id}"`));
});
