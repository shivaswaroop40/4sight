// src/experiences/iphone/iphoneData.ts
//
// Data shapes for the iPhone assembly experience, plus an embedded fallback
// so the experience can mount synchronously without waiting on a fetch.
// The fallback is kept identical to public/data/iphone.json; the fetch is
// treated as a best-effort validation rather than something setTime depends on.

export interface IPhoneComponentPose {
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface IPhoneComponentAssembledPose extends IPhoneComponentPose {
  size: [number, number, number];
  color: string;
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
  assembled: IPhoneComponentAssembledPose;
  exploded: IPhoneComponentPose;
  stage: IPhoneComponentStage;
}

export interface IPhoneData {
  components: IPhoneComponent[];
}

/**
 * Embedded copy of public/data/iphone.json. Used immediately at mount so the
 * scene never depends on network timing. Kept in sync with the JSON file by
 * hand; loadIPhoneData() fetches the JSON mainly so the public file stays
 * validated and available for tooling/tests.
 */
export const IPHONE_DATA_FALLBACK: IPhoneData = {
  components: [
    {
      id: "frame",
      name: "Frame",
      description:
        "The aluminium and stainless-steel chassis that forms the phone's structural skeleton, housing every other component and defining its exterior dimensions.",
      properties: {
        material: "aluminium / stainless steel",
        weight: "42 g",
      },
      assembled: {
        position: [0, 0, -0.066],
        rotation: [0, 0, 0],
        size: [1.65, 3.3, 0.0825],
        color: "#9aa0a8",
      },
      exploded: {
        position: [0, 0, -1.02],
        rotation: [0.15, -0.2, 0.1],
      },
      stage: { start: 0.0, end: 0.2 },
    },
    {
      id: "logic-board",
      name: "Logic Board",
      description:
        "The main logic board carries the system-on-chip, memory, and RF modules that run the entire device.",
      properties: {
        chip: "A-series SoC",
        ram: "6 GB",
      },
      assembled: {
        position: [0, 0.715, -0.011],
        rotation: [0, 0, 0],
        size: [0.88, 0.99, 0.033],
        color: "#2f8f5b",
      },
      exploded: {
        position: [1.36, 0, 0.68],
        rotation: [0.3, 0.4, -0.2],
      },
      stage: { start: 0.15, end: 0.4 },
    },
    {
      id: "battery",
      name: "Battery",
      description:
        "A lithium-ion pouch cell that stores the energy needed to power the phone through a full day of use.",
      properties: {
        capacity: "3,200 mAh",
        chemistry: "Li-ion",
      },
      assembled: {
        position: [0, -0.66, -0.011],
        rotation: [0, 0, 0],
        size: [1.21, 1.43, 0.044],
        color: "#4a4d55",
      },
      exploded: {
        position: [-1.36, 0, 0.68],
        rotation: [-0.25, 0.35, 0.15],
      },
      stage: { start: 0.3, end: 0.55 },
    },
    {
      id: "main-camera",
      name: "Main Camera",
      description:
        "The primary rear camera module, combining a wide-angle lens with an optically stabilized sensor for photos and video.",
      properties: {
        resolution: "48 MP",
        aperture: "f/1.6",
      },
      assembled: {
        position: [-0.495, 1.32, -0.0825],
        rotation: [0, 0, 0],
        size: [0.385, 0.385, 0.1375],
        color: "#2b3a5c",
      },
      exploded: {
        position: [0, 1.7, 0.51],
        rotation: [0.5, -0.3, 0.4],
      },
      stage: { start: 0.45, end: 0.65 },
    },
    {
      id: "speaker",
      name: "Speaker",
      description:
        "The bottom-firing loudspeaker used for ringtones, media playback, and speakerphone calls.",
      properties: {
        type: "dynamic driver",
        impedance: "8 ohm",
      },
      assembled: {
        position: [0, -1.43, -0.0275],
        rotation: [0, 0, 0],
        size: [0.66, 0.1375, 0.0825],
        color: "#6b6f78",
      },
      exploded: {
        position: [0, -1.7, 0.51],
        rotation: [-0.4, 0.2, -0.3],
      },
      stage: { start: 0.55, end: 0.75 },
    },
    {
      id: "display",
      name: "Display",
      description:
        "The OLED display assembly bonded to the front glass, providing the touch surface and visual output for the device.",
      properties: {
        type: "OLED",
        resolution: "2556x1179",
      },
      assembled: {
        position: [0, 0, 0.066],
        rotation: [0, 0, 0],
        size: [1.595, 3.245, 0.033],
        color: "#101a2e",
      },
      exploded: {
        position: [0, 0, 1.7],
        rotation: [0.2, -0.15, 0.35],
      },
      stage: { start: 0.7, end: 1.0 },
    },
  ],
};

/**
 * Fetches public/data/iphone.json. Never uses a leading slash — the Vite
 * base is "/4sight/" and BASE_URL already carries that prefix.
 */
export async function loadIPhoneData(): Promise<IPhoneData> {
  const url = `${import.meta.env.BASE_URL}data/iphone.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load iPhone data from ${url}: ${response.status}`);
  }
  return (await response.json()) as IPhoneData;
}
