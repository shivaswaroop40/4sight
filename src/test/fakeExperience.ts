// src/test/fakeExperience.ts
//
// A FourDExperience with no scene: time runs 0 to 1 over a 10 s pass, with
// events at 0, 0.5 and 1. Overrides replace any member, e.g. a mount that
// throws.

import { linearMapping } from "../core/mappings";
import type { ExperienceId, FourDExperience } from "../core/types";

export function fakeExperience(id: ExperienceId, overrides: Partial<FourDExperience> = {}): FourDExperience {
  return {
    id,
    name: `Fake ${id}`,
    minTime: 0,
    maxTime: 1,
    mapping: linearMapping(0, 1, (t) => t.toFixed(2)),
    baseDurationSeconds: 10,
    warpPresets: [1],
    labels: { start: "start", end: "end" },
    events: [
      { id: "a", time: 0, title: "A", when: "", description: "", keyPoints: [] },
      { id: "b", time: 0.5, title: "B", when: "", description: "", keyPoints: [] },
      { id: "c", time: 1, title: "C", when: "", description: "", keyPoints: [] },
    ],
    mount() {},
    setTime() {},
    getState: () => null,
    getCurrentEvent: () => null,
    getHoveredObject: () => null,
    getCameraPresets: () => [],
    reset() {},
    dispose() {},
    ...overrides,
  };
}
