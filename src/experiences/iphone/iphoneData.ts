// src/experiences/iphone/iphoneData.ts
//
// Data shapes for the iPhone experience. The scene mounts synchronously from
// IPHONE_DATA_FALLBACK, which is generated from public/data/iphone.json and
// kept identical to it.

import type { TimelineEvent } from "../../core/types";

export interface IPhoneComponentPose {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface IPhoneComponentStage {
  start: number;
  end: number;
}

export interface IPhoneComponent {
  id: string;
  name: string;
  description: string;
  properties?: Record<string, string | number>;
  assembled: IPhoneComponentPose;
  exploded: IPhoneComponentPose;
  stage: IPhoneComponentStage;
}

export interface IPhoneData {
  components: IPhoneComponent[];
  events: TimelineEvent[];
}

export { IPHONE_DATA_FALLBACK } from "./iphoneDataFallback";
