// src/experiences/index.ts
//
// Registry of every FourDExperience. Each lane adds one import and one line
// to the array below. The nav switches by disposing the previous experience,
// mounting the next, and resetting u to 0.

import type { ExperienceId, FourDExperience } from "../core/types";
import { mockExperience } from "./mock/mockExperience";

export const experiences: FourDExperience[] = [
  mockExperience,
  // iPhoneExperience,   // added by the iPhone lane
  // galaxyExperience,   // added by the Cosmos lane
  // universeExperience, // added by the Cosmos lane
];

export function getExperience(id: ExperienceId): FourDExperience | undefined {
  return experiences.find((e) => e.id === id);
}
