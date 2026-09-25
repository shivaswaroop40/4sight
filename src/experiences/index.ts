// src/experiences/index.ts
//
// Registry of every FourDExperience. Each lane adds one import and one line
// to the `real` array below. The nav switches by disposing the previous
// experience, mounting the next, and resetting u to 0.
//
// The mocks are shown only while no real experience is registered, so the
// shell is always testable and the demo never shows them once a lane lands.

import type { ExperienceId, FourDExperience } from "../core/types";
import { mockExperience } from "./mock/mockExperience";
import { mockLogExperience } from "./mock/mockLogExperience";
import { iphoneExperience } from "./iphone/IPhoneExperience";

const real: FourDExperience[] = [
  iphoneExperience,
  // solarSystemExperience, // added by the Cosmos lane (src/experiences/solar-system/)
];

const mocks: FourDExperience[] = [mockExperience, mockLogExperience];

export const experiences: FourDExperience[] = real.length > 0 ? real : mocks;

export function getExperience(id: ExperienceId): FourDExperience | undefined {
  return experiences.find((e) => e.id === id);
}
