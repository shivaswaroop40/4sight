// src/experiences/city/CityExperience.ts
//
// A fictional river city growing from a farming village in 1700 to today,
// built entirely from city.scene.json on the keyframe engine. Edit the
// scene through scripts/gen-city.ts, which writes that JSON.

import { keyframeExperience } from "../keyframe/KeyframeExperience";
import scene from "./city.scene.json";

export const cityExperience = keyframeExperience("city", scene);
