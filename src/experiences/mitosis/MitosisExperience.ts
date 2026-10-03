// src/experiences/mitosis/MitosisExperience.ts
//
// One animal cell dividing in two over about an hour, built entirely from
// mitosis.scene.json on the keyframe engine. Edit the scene through
// scripts/gen-mitosis.ts, which writes that JSON.

import { keyframeExperience } from "../keyframe/KeyframeExperience";
import scene from "./mitosis.scene.json";

export const mitosisExperience = keyframeExperience("mitosis", scene);
