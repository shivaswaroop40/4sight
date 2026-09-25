// src/experiences/solar-system/solarData.ts
//
// Everything the solar system experience knows about the world, as plain
// data. Times are years after the solar nebula began to collapse. Formation
// and cooling windows are in slider units p in [0, 1] so the visual pacing
// lines up with the knots below. Sizes and orbit radii are display units,
// not to scale.

import type { TimelineEvent } from "../../core/types";
import type { SliderKnot } from "./solarMapping";

export const KNOTS: SliderKnot[] = [
  { u: 0.0, time: 0, label: "Nebula" },
  { u: 0.12, time: 1e5, label: "Protosun" },
  { u: 0.25, time: 1e6, label: "Disk" },
  { u: 0.42, time: 1e7, label: "Giants" },
  { u: 0.55, time: 5e7, label: "Sun ignites" },
  { u: 0.7, time: 1e8, label: "Earth & Moon" },
  { u: 0.82, time: 7e8, label: "Bombardment" },
  { u: 1.0, time: 4.6e9, label: "Today" },
];

export type BodyKind = "star" | "planet" | "moon";

export interface BodyDef {
  id: string;
  name: string;
  kind: BodyKind;
  description: string;
  /** Parent body id for moons. */
  parent?: string;
  /** Orbit radius around the sun (planets) or around the parent (moons). */
  orbit: number;
  size: number;
  /** Starting orbital angle in radians. */
  phase: number;
  /** Slider window over which the body's particles gather into a ball. */
  form: [number, number];
  /** Heat keyframes [p, heat]. 1 is molten, 0 is fully cooled. */
  heat: [number, number][];
  color: string;
  /** Procedural surface: bands for gas giants, blotches for Earth. */
  surface?: "bands" | "earth";
  bandColors?: string[];
  /** Axial tilt in radians. */
  tilt?: number;
  /** Moons only: orbits against the parent's spin. */
  retrograde?: boolean;
  /** Self-rotation rate relative to the orbital clock. */
  spin?: number;
  /** Number of particles that accrete into this body. */
  particles: number;
  /** Half-width of the feeding zone in the disk (planets only). */
  feed?: number;
  properties?: Record<string, string | number>;
}

export const BODIES: BodyDef[] = [
  {
    id: "sun",
    name: "Sun",
    kind: "star",
    description: "Formed from 99.8% of the nebula's mass. Hydrogen fusion ignited about 50 million years in.",
    orbit: 0,
    size: 1.1,
    phase: 0,
    form: [0.03, 0.16],
    heat: [[0, 1]],
    color: "#ffd98a",
    particles: 9000,
    properties: { Type: "G2V star", Diameter: "1.39 million km", Age: "4.6 billion years" },
  },
  {
    id: "mercury",
    name: "Mercury",
    kind: "planet",
    description: "The smallest planet. A dense iron core left behind after violent early impacts.",
    orbit: 2.0,
    size: 0.11,
    phase: 0.4,
    form: [0.46, 0.62],
    heat: [[0.62, 1], [0.78, 0]],
    color: "#9c9590",
    spin: 0.3,
    particles: 1100,
    feed: 0.25,
    properties: { Distance: "0.39 AU", Diameter: "4,879 km", Moons: 0 },
  },
  {
    id: "venus",
    name: "Venus",
    kind: "planet",
    description: "Earth's near twin in size, smothered by a runaway greenhouse atmosphere.",
    orbit: 2.7,
    size: 0.19,
    phase: 2.1,
    form: [0.47, 0.64],
    heat: [[0.64, 1], [0.8, 0]],
    color: "#e3c68c",
    spin: -0.1,
    particles: 1500,
    feed: 0.3,
    properties: { Distance: "0.72 AU", Diameter: "12,104 km", Moons: 0 },
  },
  {
    id: "earth",
    name: "Earth",
    kind: "planet",
    description: "Assembled from colliding planetesimals, reheated by the Moon-forming impact, then cooled into oceans.",
    orbit: 3.5,
    size: 0.2,
    phase: 4.0,
    form: [0.48, 0.63],
    // Cools, is melted again by the Theia impact, then cools for good.
    heat: [[0.63, 1], [0.67, 0.5], [0.685, 1], [0.74, 0.7], [0.88, 0]],
    color: "#ffffff",
    surface: "earth",
    tilt: 0.41,
    spin: 1.2,
    particles: 1600,
    feed: 0.32,
    properties: { Distance: "1 AU", Diameter: "12,742 km", Moons: 1 },
  },
  {
    id: "mars",
    name: "Mars",
    kind: "planet",
    description: "Stunted by Jupiter stealing its building material. Once wet, now a cold red desert.",
    orbit: 4.4,
    size: 0.14,
    phase: 5.3,
    form: [0.44, 0.58],
    heat: [[0.58, 1], [0.72, 0]],
    color: "#c1502e",
    tilt: 0.44,
    spin: 1.1,
    particles: 1100,
    feed: 0.3,
    properties: { Distance: "1.52 AU", Diameter: "6,779 km", Moons: 2 },
  },
  {
    id: "jupiter",
    name: "Jupiter",
    kind: "planet",
    description: "The first planet to form. Its core grew fast enough to capture a massive envelope of gas.",
    orbit: 7.0,
    size: 0.6,
    phase: 1.0,
    form: [0.26, 0.4],
    heat: [[0.4, 1], [0.6, 0]],
    color: "#ffffff",
    surface: "bands",
    bandColors: ["#d9b38c", "#b07f56", "#efe0c8", "#c79a6b", "#8f6444", "#e8d2b0"],
    tilt: 0.05,
    spin: 2.5,
    particles: 6500,
    feed: 0.9,
    properties: { Distance: "5.2 AU", Diameter: "139,820 km", Moons: 95 },
  },
  {
    id: "saturn",
    name: "Saturn",
    kind: "planet",
    description: "A gas giant light enough to float on water, circled by rings of ice.",
    orbit: 9.0,
    size: 0.5,
    phase: 3.3,
    form: [0.28, 0.43],
    heat: [[0.43, 1], [0.62, 0]],
    color: "#ffffff",
    surface: "bands",
    bandColors: ["#e8d4a2", "#d1b47c", "#f2e6c4", "#bfa06a", "#e0c88f"],
    tilt: 0.47,
    spin: 2.3,
    particles: 5500,
    feed: 0.9,
    properties: { Distance: "9.5 AU", Diameter: "116,460 km", Moons: 146 },
  },
  {
    id: "uranus",
    name: "Uranus",
    kind: "planet",
    description: "An ice giant knocked onto its side, probably by a giant impact early on.",
    orbit: 11.0,
    size: 0.33,
    phase: 5.9,
    form: [0.32, 0.5],
    heat: [[0.5, 1], [0.66, 0]],
    color: "#9fdbe3",
    tilt: 1.71,
    spin: 1.4,
    particles: 3200,
    feed: 0.8,
    properties: { Distance: "19.2 AU", Diameter: "50,724 km", Moons: 28 },
  },
  {
    id: "neptune",
    name: "Neptune",
    kind: "planet",
    description: "The outermost planet. Formed from ice and gas in the cold outer disk.",
    orbit: 12.8,
    size: 0.32,
    phase: 2.6,
    form: [0.34, 0.52],
    heat: [[0.52, 1], [0.68, 0]],
    color: "#4a6fe0",
    tilt: 0.49,
    spin: 1.5,
    particles: 3200,
    feed: 0.8,
    properties: { Distance: "30.1 AU", Diameter: "49,244 km", Moons: 16 },
  },
  // Moons. Orbit is the local radius around the parent.
  {
    id: "moon",
    name: "The Moon",
    kind: "moon",
    parent: "earth",
    description: "Formed from debris thrown off when a Mars-sized body, Theia, struck the young Earth.",
    orbit: 0.45,
    size: 0.06,
    phase: 0.5,
    form: [0.685, 0.77],
    heat: [[0.77, 1], [0.88, 0]],
    color: "#bdbab4",
    particles: 500,
    properties: { Diameter: "3,474 km", "Distance from Earth": "384,400 km" },
  },
  {
    id: "io",
    name: "Io",
    kind: "moon",
    parent: "jupiter",
    description: "The most volcanic world in the solar system, kneaded by Jupiter's tides.",
    orbit: 0.95,
    size: 0.05,
    phase: 0,
    form: [0.4, 0.52],
    heat: [[0.52, 1], [0.66, 0.15]],
    color: "#e6d36a",
    particles: 300,
    properties: { Diameter: "3,643 km", Parent: "Jupiter" },
  },
  {
    id: "europa",
    name: "Europa",
    kind: "moon",
    parent: "jupiter",
    description: "An icy shell over a global ocean of liquid water.",
    orbit: 1.15,
    size: 0.045,
    phase: 1.7,
    form: [0.41, 0.53],
    heat: [[0.53, 1], [0.66, 0]],
    color: "#e8e1d4",
    particles: 280,
    properties: { Diameter: "3,122 km", Parent: "Jupiter" },
  },
  {
    id: "ganymede",
    name: "Ganymede",
    kind: "moon",
    parent: "jupiter",
    description: "The largest moon in the solar system, bigger than Mercury.",
    orbit: 1.4,
    size: 0.07,
    phase: 3.4,
    form: [0.41, 0.54],
    heat: [[0.54, 1], [0.67, 0]],
    color: "#a89f93",
    particles: 380,
    properties: { Diameter: "5,268 km", Parent: "Jupiter" },
  },
  {
    id: "callisto",
    name: "Callisto",
    kind: "moon",
    parent: "jupiter",
    description: "An ancient, heavily cratered ball of ice and rock.",
    orbit: 1.7,
    size: 0.065,
    phase: 5.0,
    form: [0.42, 0.55],
    heat: [[0.55, 1], [0.68, 0]],
    color: "#6e655c",
    particles: 360,
    properties: { Diameter: "4,821 km", Parent: "Jupiter" },
  },
  {
    id: "titan",
    name: "Titan",
    kind: "moon",
    parent: "saturn",
    description: "Wrapped in a thick orange haze, with lakes of liquid methane.",
    orbit: 1.4,
    size: 0.07,
    phase: 2.0,
    form: [0.44, 0.56],
    heat: [[0.56, 1], [0.7, 0]],
    color: "#d9a150",
    particles: 380,
    properties: { Diameter: "5,150 km", Parent: "Saturn" },
  },
  {
    id: "titania",
    name: "Titania",
    kind: "moon",
    parent: "uranus",
    description: "The largest moon of Uranus, scarred by huge canyons.",
    orbit: 0.62,
    size: 0.04,
    phase: 1.1,
    form: [0.5, 0.61],
    heat: [[0.61, 1], [0.72, 0]],
    color: "#b3a99e",
    particles: 220,
    properties: { Diameter: "1,578 km", Parent: "Uranus" },
  },
  {
    id: "oberon",
    name: "Oberon",
    kind: "moon",
    parent: "uranus",
    description: "The outermost major moon of Uranus, old and dark.",
    orbit: 0.78,
    size: 0.04,
    phase: 4.2,
    form: [0.51, 0.62],
    heat: [[0.62, 1], [0.73, 0]],
    color: "#8f857b",
    particles: 220,
    properties: { Diameter: "1,523 km", Parent: "Uranus" },
  },
  {
    id: "triton",
    name: "Triton",
    kind: "moon",
    parent: "neptune",
    description: "Orbits backwards. Likely a Kuiper Belt object Neptune captured.",
    orbit: 0.62,
    size: 0.05,
    phase: 3.0,
    retrograde: true,
    form: [0.72, 0.8],
    heat: [[0.8, 0.6], [0.88, 0]],
    color: "#d4c8c4",
    particles: 260,
    properties: { Diameter: "2,707 km", Parent: "Neptune" },
  },
];

export const EVENTS: TimelineEvent[] = [
  {
    id: "nebula",
    time: 0,
    title: "The solar nebula",
    when: "4.6 billion years ago",
    description:
      "A cold, slowly turning cloud of hydrogen, helium, and dust, light-years across. A nearby supernova may have given it the push to collapse.",
    keyPoints: ["98% hydrogen and helium", "2% dust and ice from older stars", "Collapse starts under its own gravity"],
    category: "cloud",
  },
  {
    id: "protosun",
    time: 1e5,
    title: "The protosun",
    when: "~100,000 years in",
    description:
      "Most of the mass falls to the centre and heats up. The cloud spins faster as it shrinks, like a skater pulling in their arms.",
    keyPoints: ["Gravity heats the core", "Spin flattens the cloud", "No fusion yet"],
    category: "star",
  },
  {
    id: "disk",
    time: 1e6,
    title: "Protoplanetary disk",
    when: "~1 million years in",
    description:
      "The leftover gas and dust settles into a flat, spinning disk. Dust grains stick together into pebbles, then kilometre-sized planetesimals.",
    keyPoints: ["Hot and rocky near the Sun", "Icy beyond the frost line", "Planetesimals begin to collide and merge"],
    category: "disk",
  },
  {
    id: "gas-giants",
    time: 3e6,
    title: "The giants form",
    when: "~3 million years in",
    description:
      "Beyond the frost line, ice lets cores grow quickly. Jupiter gets big enough to pull in gas first, then Saturn, Uranus, and Neptune.",
    keyPoints: ["Jupiter forms first", "Cores sweep clear gaps in the disk", "Hot balls of gas glow as they contract"],
    category: "planets",
  },
  {
    id: "giant-moons",
    time: 1e7,
    title: "Moons of the giants",
    when: "~10 million years in",
    description:
      "Each giant has its own mini disk of gas and dust. Io, Europa, Ganymede, Callisto, and Titan condense in them, like tiny solar systems.",
    keyPoints: ["Circumplanetary disks", "The Galilean moons form around Jupiter", "Titan forms around Saturn"],
    category: "moons",
  },
  {
    id: "rocky-planets",
    time: 2e7,
    title: "Rocky planets assemble",
    when: "~20 million years in",
    description:
      "Near the Sun only rock and metal can survive the heat. Planetesimals smash together into molten protoplanets: Mercury, Venus, Earth, and Mars.",
    keyPoints: ["Collisions melt the young planets", "Iron sinks to form cores", "Mars stays small"],
    category: "planets",
  },
  {
    id: "ignition",
    time: 5e7,
    title: "The Sun ignites",
    when: "~50 million years in",
    description:
      "The core reaches about 15 million Â°C and hydrogen fusion begins. A strong solar wind blows the remaining gas out of the solar system.",
    keyPoints: ["Hydrogen fuses into helium", "The solar wind clears the disk", "Planet formation from gas ends"],
    category: "star",
  },
  {
    id: "moon-impact",
    time: 9e7,
    title: "The Moon-forming impact",
    when: "~90 million years in",
    description:
      "A Mars-sized body, Theia, strikes the young Earth. The debris ring quickly collects into the Moon.",
    keyPoints: ["Earth is melted again", "Debris orbits and clumps together", "The Moon forms in a few years to centuries"],
    category: "moons",
  },
  {
    id: "bombardment",
    time: 7e8,
    title: "Heavy bombardment",
    when: "~700 million years in",
    description:
      "The giant planets shift their orbits and scatter leftover planetesimals. Impacts crater every surface. The planets cool, and Earth gets oceans.",
    keyPoints: ["The asteroid and Kuiper belts are what's left", "Craters on the Moon date from this era", "Earth's crust and oceans settle"],
    category: "planets",
  },
  {
    id: "today",
    time: 4.6e9,
    title: "The solar system today",
    when: "4.6 billion years in",
    description:
      "Eight planets, hundreds of moons, and belts of leftover rubble circle a middle-aged star. The Sun has about 5 billion years left.",
    keyPoints: ["8 planets, 2 debris belts", "Earth is the only known world with life", "Orbits have been stable for billions of years"],
    category: "today",
  },
];
