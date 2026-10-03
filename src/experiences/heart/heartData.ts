// src/experiences/heart/heartData.ts
//
// What the heartbeat experience says: timeline events, hover cards, camera
// views, and the slider mapping. Times are milliseconds into one beat at 75
// beats per minute; heartCycle owns the numbers the scene moves by.

import { linearMapping } from "../../core/mappings";
import type { CameraPreset, TimelineEvent } from "../../core/types";
import {
  BEAT_MS,
  chamberVolume,
  pressure,
  valveIsOpen,
  type ChamberId,
  type PressureSite,
  type ValveId,
} from "./heartCycle";

export function formatMs(t: number): string {
  return `${Math.round(t)} ms`;
}

export const HEART_MAPPING = linearMapping(0, BEAT_MS, formatMs, [
  { u: 0, label: "0 ms" },
  { u: 0.25, label: "200 ms" },
  { u: 0.5, label: "400 ms" },
  { u: 0.75, label: "600 ms" },
  { u: 1, label: "800 ms" },
]);

export const EVENTS: TimelineEvent[] = [
  {
    id: "sa-fires",
    time: 0,
    title: "SA node fires",
    when: "0 ms · P wave begins",
    description:
      "The heart's own pacemaker, the SA node, sends out an electrical spark. A wave of signal spreads across both atria.",
    keyPoints: [
      "At 75 beats a minute this happens every 0.8 seconds",
      "The spreading signal draws the P wave on the ECG",
      "The heart sets its own rhythm; nerves only speed it up or slow it down",
    ],
    category: "electrical",
  },
  {
    id: "atrial-systole",
    time: 50,
    title: "Atria squeeze",
    when: "50 ms · atrial systole",
    description:
      "Just after the signal passes, the two top chambers contract. They give the ventricles below a last push of blood.",
    keyPoints: [
      "This atrial kick adds about a fifth of the ventricles' blood at rest",
      "The tricuspid and mitral valves are wide open",
      "Blue blood stays on the right, red on the left; they never mix",
    ],
    category: "mechanical",
  },
  {
    id: "av-delay",
    time: 90,
    title: "AV node holds the signal",
    when: "90 to 160 ms · the flat line after P",
    description:
      "The signal reaches the AV node and waits there for about a tenth of a second. The pause lets the atria finish emptying before the ventricles squeeze.",
    keyPoints: [
      "The pause is the flat stretch between P and QRS on the ECG",
      "The AV node is the only electrical bridge from atria to ventricles",
      "From P to QRS normally takes 120 to 200 ms",
    ],
    category: "electrical",
  },
  {
    id: "qrs",
    time: 160,
    title: "Ventricles fire",
    when: "160 ms · QRS complex",
    description:
      "The signal races down the bundle of His and out through the Purkinje fibres. Both ventricles switch on in under a tenth of a second.",
    keyPoints: [
      "So much muscle firing at once makes the tall QRS spike",
      "Purkinje fibres carry the signal at up to 4 metres per second",
      "The atria reset at the same moment, hidden under the QRS",
    ],
    category: "electrical",
  },
  {
    id: "lub",
    time: 210,
    title: "Lub: inflow valves snap shut",
    when: "210 ms · first heart sound",
    description:
      "The ventricles start to squeeze. Their pressure jumps above the atria and the tricuspid and mitral valves slam shut. That snap is the lub.",
    keyPoints: [
      "All four valves are shut, so the ventricles tense up without changing volume",
      "Doctors call this isovolumetric contraction",
      "Cords called chordae tendineae stop the flaps flipping back into the atria",
    ],
    category: "sound",
  },
  {
    id: "ejection",
    time: 260,
    title: "Blood shoots out",
    when: "260 ms · aortic and pulmonary valves open",
    description:
      "Left ventricle pressure passes the 80 mmHg in the aorta and the outflow valves pop open. Each ventricle pushes out about 70 mL: red blood to the body, blue blood to the lungs.",
    keyPoints: [
      "The left ventricle peaks near 120 mmHg, the right near 25 mmHg",
      "Both sides pump the same 70 mL, so the two loops stay balanced",
      "The left ventricle shrinks from about 120 mL to 50 mL",
    ],
    category: "mechanical",
  },
  {
    id: "t-wave",
    time: 380,
    title: "T wave: electrical reset",
    when: "380 ms · repolarization",
    description:
      "The ventricle muscle recharges so it can fire again. Blood is still flowing out while the reset happens.",
    keyPoints: [
      "The T wave is the muscle resetting, not squeezing",
      "Muscle cannot fire again until it has reset",
      "This long reset stops heart muscle locking into a cramp",
    ],
    category: "electrical",
  },
  {
    id: "dub",
    time: 540,
    title: "Dub: outflow valves snap shut",
    when: "540 ms · second heart sound",
    description:
      "The ventricles relax and their pressure drops below the arteries. Blood starts to fall back, fills the valve cups, and snaps the aortic and pulmonary valves shut. That is the dub.",
    keyPoints: [
      "All four valves are shut again while the muscle relaxes",
      "The small bump in aortic pressure here is the dicrotic notch",
      "Lub-dub is what a stethoscope hears",
    ],
    category: "sound",
  },
  {
    id: "filling",
    time: 620,
    title: "Ventricles fill",
    when: "620 ms · rapid filling",
    description:
      "Ventricle pressure falls below the atria, so the tricuspid and mitral valves swing open. Blood that piled up in the atria rushes down.",
    keyPoints: [
      "Most filling happens now, with no push from the atria",
      "The relaxing ventricle springs open and draws blood in",
      "Veins keep pouring blood into the atria all through the beat",
    ],
    category: "mechanical",
  },
  {
    id: "diastasis",
    time: 720,
    title: "Resting fill",
    when: "720 ms · diastasis",
    description: "Filling slows to a trickle. The heart rests for a moment before the SA node fires again.",
    keyPoints: [
      "At 75 bpm the heart spends about 60% of each beat relaxed",
      "When the heart speeds up, it is mostly this rest that gets shorter",
      "At 800 ms the next beat begins",
    ],
    category: "mechanical",
  },
];

export type HoverId =
  | ChamberId
  | ValveId
  | "saNode"
  | "avNode"
  | "aorta"
  | "pulmonaryArtery"
  | "venaCava"
  | "pulmonaryVeins"
  | "heartWall"
  | "ecg";

interface HoverCard {
  name: string;
  description: string;
  category: string;
  properties: Record<string, string | number>;
  /** Live readouts at time t, merged after the fixed properties. */
  live?: (t: number) => Record<string, string>;
}

const mL = (c: ChamberId) => (t: number) => ({ "Volume now": `${Math.round(chamberVolume(c, t))} mL` });
const mmHg = (s: PressureSite) => (t: number) => ({ "Pressure now": `${Math.round(pressure(s, t))} mmHg` });
const both = (c: ChamberId) => (t: number) => ({ ...mL(c)(t), ...mmHg(c)(t) });
const state = (v: ValveId) => (t: number) => ({ "Right now": valveIsOpen(v, t) ? "Open" : "Shut" });

export const HOVER: Record<HoverId, HoverCard> = {
  rightAtrium: {
    name: "Right atrium",
    category: "chamber",
    description: "Collects blue, oxygen-poor blood coming back from the body through the vena cava.",
    properties: { Pressure: "2 to 6 mmHg", Volume: "about 25 to 70 mL" },
    live: both("rightAtrium"),
  },
  rightVentricle: {
    name: "Right ventricle",
    category: "chamber",
    description: "Pumps blood to the lungs. The lungs need only gentle pressure, so its wall is thin.",
    properties: { Pressure: "25 / 4 mmHg", "Full / squeezed": "130 / 60 mL", Wall: "3 to 5 mm" },
    live: both("rightVentricle"),
  },
  leftAtrium: {
    name: "Left atrium",
    category: "chamber",
    description: "Receives red, oxygen-rich blood from the lungs through the pulmonary veins.",
    properties: { Pressure: "6 to 15 mmHg", Volume: "about 20 to 70 mL" },
    live: both("leftAtrium"),
  },
  leftVentricle: {
    name: "Left ventricle",
    category: "chamber",
    description:
      "The strongest chamber. It pumps blood around the whole body, so its wall is about three times thicker than the right's.",
    properties: { Pressure: "120 / 8 mmHg", "Full / squeezed": "120 / 50 mL", "Pumped out": "58% each beat" },
    live: both("leftVentricle"),
  },
  tricuspid: {
    name: "Tricuspid valve",
    category: "valve",
    description: "Three flaps between the right atrium and right ventricle. It snaps shut at the lub.",
    properties: { Flaps: 3, Opening: "about 7 cm²", Shuts: "210 ms (lub)", Opens: "620 ms" },
    live: state("tricuspid"),
  },
  mitral: {
    name: "Mitral valve",
    category: "valve",
    description: "Two flaps between the left atrium and left ventricle, also called the bicuspid valve. It snaps shut at the lub.",
    properties: { Flaps: 2, Opening: "4 to 6 cm²", Shuts: "210 ms (lub)", Opens: "620 ms" },
    live: state("mitral"),
  },
  pulmonary: {
    name: "Pulmonary valve",
    category: "valve",
    description: "Three pocket-shaped cusps at the exit of the right ventricle. It snaps shut at the dub.",
    properties: { Cusps: 3, Opening: "about 2 cm²", Opens: "260 ms", Shuts: "540 ms (dub)" },
    live: state("pulmonary"),
  },
  aortic: {
    name: "Aortic valve",
    category: "valve",
    description: "Three pocket-shaped cusps at the exit of the left ventricle. It snaps shut at the dub.",
    properties: { Cusps: 3, Opening: "3 to 4 cm²", Opens: "260 ms", Shuts: "540 ms (dub)" },
    live: state("aortic"),
  },
  saNode: {
    name: "SA node",
    category: "electrical",
    description: "The sinoatrial node, the heart's natural pacemaker: a small patch of special cells in the right atrium wall.",
    properties: { "Resting rate": "60 to 100 per minute", "Here": "every 800 ms (75 bpm)", Length: "about 15 mm" },
  },
  avNode: {
    name: "AV node",
    category: "electrical",
    description:
      "The atrioventricular node, the gatekeeper between atria and ventricles. It slows the signal so the atria can finish emptying.",
    properties: { Delay: "about 0.1 s", "Then": "bundle of His, then Purkinje fibres" },
  },
  aorta: {
    name: "Aorta",
    category: "vessel",
    description: "The body's main artery. It carries red, oxygen-rich blood from the left ventricle to everywhere but the lungs.",
    properties: { Pressure: "120 / 80 mmHg", Width: "about 2.5 to 3 cm" },
    live: mmHg("aorta"),
  },
  pulmonaryArtery: {
    name: "Pulmonary artery",
    category: "vessel",
    description:
      "Carries blue, oxygen-poor blood from the right ventricle to both lungs. It is the only artery that carries oxygen-poor blood.",
    properties: { Pressure: "25 / 10 mmHg", Branches: "one to each lung" },
    live: mmHg("pulmonaryArtery"),
  },
  venaCava: {
    name: "Vena cava",
    category: "vessel",
    description: "The superior and inferior vena cava: two big veins bringing oxygen-poor blood back from the upper and lower body.",
    properties: { Pressure: "about 3 mmHg", "Blood returned": "about 5 litres a minute at rest" },
  },
  pulmonaryVeins: {
    name: "Pulmonary veins",
    category: "vessel",
    description: "Bring oxygen-rich blood from the lungs to the left atrium. They are the only veins that carry oxygen-rich blood.",
    properties: { Count: "4 (2 drawn)", Pressure: "about 8 mmHg" },
  },
  heartWall: {
    name: "Heart muscle",
    category: "tissue",
    description:
      "The myocardium. Each cell squeezes when the electrical wave reaches it. Drawn as if facing the person, so the heart's right side is on your left.",
    properties: { "Left wall": "about 1 cm thick", "Right wall": "3 to 5 mm thick", "Pumped per minute": "about 5 litres" },
  },
  ecg: {
    name: "ECG trace",
    category: "electrical",
    description:
      "An electrocardiogram: the heart's electrical activity measured from the skin. P is the atria firing, QRS the ventricles firing, T the ventricles resetting.",
    properties: { "P wave": "0 to 90 ms", "QRS": "160 to 240 ms", "T wave": "380 to 540 ms", "Paper squares": "40 ms each" },
  },
};

export function hoverCard(id: string, t: number) {
  const card = HOVER[id as HoverId];
  if (!card) return null;
  return {
    id,
    name: card.name,
    description: card.description,
    category: card.category,
    properties: { ...card.properties, ...card.live?.(t) },
  };
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "front", name: "Front cutaway", position: [0.25, -1.2, 19.2], target: [0.25, -1.6, 0] },
  { id: "side", name: "Side", position: [12.4, 0.1, 14], target: [0.25, -1.6, 0] },
  { id: "valves", name: "Valves", position: [0.3, 0.55, 9.6], target: [0.3, 0.2, 0.4] },
];
