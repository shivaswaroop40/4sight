// src/experiences/universe/universeData.ts
//
// Everything the universe experience knows about cosmic history, as plain
// data. Times are years after the Big Bang. The numbers follow the standard
// cosmological model and are approximate; the text says so where it matters.

import type { SliderKnot } from "../../core/mappings";
import type { TimelineEvent } from "../../core/types";

const SECONDS_PER_YEAR = 3.156e7;

/** Years in `s` seconds. */
export function seconds(s: number): number {
  return s / SECONDS_PER_YEAR;
}

export const PLANCK_TIME = seconds(5.39e-44);
export const TODAY = 1.38e10;

// The tiny second knot keeps the first log segment from starting at 0:
// knotMapping is linear in a segment that starts at time 0, which would
// squash everything before one second against the left edge.
export const KNOTS: SliderKnot[] = [
  { u: 0, time: 0, label: "Big Bang" },
  { u: 0.02, time: PLANCK_TIME, label: "" },
  { u: 0.15, time: seconds(1), label: "1 s" },
  { u: 0.24, time: seconds(180), label: "3 min" },
  { u: 0.4, time: 3.8e5, label: "380k yrs" },
  { u: 0.53, time: 2e8, label: "200M yrs" },
  { u: 0.65, time: 1e9, label: "1B yrs" },
  { u: 0.86, time: 9.2e9, label: "9.2B yrs" },
  { u: 1, time: TODAY, label: "Today" },
];

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

function powerOfTen(x: number): string {
  const exponent = Math.floor(Math.log10(x));
  const mantissa = Math.round(x / 10 ** exponent);
  const power = `10${String(exponent).replace(/./g, (c) => SUPERSCRIPT[c])}`;
  return mantissa === 1 ? power : mantissa === 10 ? `10${String(exponent + 1).replace(/./g, (c) => SUPERSCRIPT[c])}` : `${mantissa} × ${power}`;
}

function count(x: number, unit: string): string {
  const n = x < 10 ? Number(x.toFixed(1)) : Math.round(x);
  return `${n.toLocaleString("en-US")} ${unit}${n === 1 ? "" : "s"}`;
}

/** Readout for the HUD: seconds while they matter, then years. */
export function formatCosmicTime(t: number): string {
  if (t <= 0) return "Time zero";
  const s = t * SECONDS_PER_YEAR;
  if (s < 1e-3) return `${powerOfTen(s)} seconds`;
  if (s < 1) return `${Number(s.toPrecision(2))} seconds`;
  if (s < 120) return count(s, "second");
  if (s < 7200) return count(s / 60, "minute");
  if (s < 2 * 86400) return count(s / 3600, "hour");
  if (t < 1) return count(s / 86400, "day");
  if (t < 1e3) return count(t, "year");
  if (t < 1e6) return `${count(t / 1e3, "thousand")} years`.replace("thousands", "thousand");
  if (t < 1e9) return `${count(t / 1e6, "million")} years`.replace("millions", "million");
  return `${(t / 1e9).toFixed(t < 1e10 ? 2 : 1)} billion years`;
}

export const EVENTS: TimelineEvent[] = [
  {
    id: "big-bang",
    time: 0,
    title: "The Big Bang",
    when: "Time zero · 13.8 billion years ago",
    description:
      "All of space is unimaginably hot and dense, and it starts to expand. It is not an explosion at one spot: every place moves away from every other place at once.",
    keyPoints: ["There is no centre and no edge", "Time, as we can measure it, starts here", "Physics this early is still not understood"],
    category: "origin",
  },
  {
    id: "inflation",
    time: seconds(1e-36),
    title: "Inflation",
    when: "About 10⁻³⁶ to 10⁻³² seconds",
    description:
      "In far less than a blink, space stretches by a factor of at least 10²⁶. Tiny quantum ripples get blown up to cosmic size. They are the seeds of every galaxy that will ever form.",
    keyPoints: ["Faster than any expansion since", "Smooths the universe out", "Leaves the ripples that grow into galaxies"],
    category: "origin",
  },
  {
    id: "protons",
    time: seconds(1e-6),
    title: "Quarks become protons",
    when: "About a millionth of a second",
    description:
      "Until now space was a soup of free quarks and gluons. As it cools below about two trillion degrees, quarks lock together in threes to make protons and neutrons.",
    keyPoints: ["Quark-gluon plasma cools", "Protons and neutrons appear", "Matter outnumbers antimatter by about one part in a billion"],
    category: "particles",
  },
  {
    id: "nucleosynthesis",
    time: seconds(180),
    title: "The first nuclei",
    when: "About 10 seconds to 20 minutes",
    description:
      "The whole universe works like a star's core for a few minutes. Protons and neutrons fuse into helium and a little lithium. Then it cools too much and fusion stops.",
    keyPoints: ["About 75% hydrogen, 25% helium by mass", "A trace of lithium", "Everything heavier must wait for stars"],
    category: "particles",
  },
  {
    id: "recombination",
    time: 3.8e5,
    title: "First atoms, first light",
    when: "380,000 years",
    description:
      "At about 3,000 degrees electrons settle onto nuclei and the first atoms form. The glowing fog clears and light travels freely for the first time. We still see that flash today as the cosmic microwave background.",
    keyPoints: ["Neutral hydrogen and helium", "The universe turns transparent", "The oldest light we can see"],
    category: "light",
  },
  {
    id: "dark-ages",
    time: 2e6,
    title: "The dark ages",
    when: "From about 380,000 to 100 million years",
    description:
      "No stars shine yet. The afterglow cools and dims into the infrared. In the dark, gravity pulls gas into the clumps and threads of dark matter, building a web.",
    keyPoints: ["No stars, no galaxies", "Dark matter clumps first", "Gas falls into the clumps"],
    category: "structure",
  },
  {
    id: "first-stars",
    time: 1e8,
    title: "The first stars",
    when: "About 100 to 200 million years",
    description:
      "Gas in the densest clumps gets hot enough to fuse hydrogen. The first stars are huge, blue and short-lived. When they explode they make the first carbon, oxygen and iron.",
    keyPoints: ["Possibly hundreds of times the Sun's mass", "Live only a few million years", "Seed space with heavy elements"],
    category: "stars",
  },
  {
    id: "first-galaxies",
    time: 3e8,
    title: "The first galaxies",
    when: "About 300 million years",
    description:
      "Small clumps of stars, gas and dark matter merge into the first galaxies. The James Webb Space Telescope has seen galaxies from less than 300 million years after the Big Bang.",
    keyPoints: ["Galaxies grow by merging", "Small, bright and messy at first", "JWST sees them as they were"],
    category: "galaxies",
  },
  {
    id: "reionization",
    time: 5e8,
    title: "Reionization",
    when: "About 150 million to 1 billion years",
    description:
      "Ultraviolet light from the young stars and galaxies splits hydrogen atoms apart again. Bubbles of clear space grow and merge until the whole universe is see-through.",
    keyPoints: ["Starlight reshapes the gas between galaxies", "Finished by about 1 billion years", "Space stays transparent from now on"],
    category: "light",
  },
  {
    id: "cosmic-noon",
    time: 3.3e9,
    title: "Peak star birth",
    when: "About 2 to 4 billion years",
    description:
      "Galaxies make stars faster than at any time before or since, about ten times today's rate. The cosmic web is now lined with galaxies, and the biggest clumps grow into clusters.",
    keyPoints: ["Called \"cosmic noon\"", "Galaxy clusters assemble", "Roughly half of all stars form by 5 billion years"],
    category: "galaxies",
  },
  {
    id: "milky-way",
    time: 5e9,
    title: "The Milky Way's disk",
    when: "About 5 billion years",
    description:
      "Our galaxy has been growing by swallowing smaller ones since its oldest stars formed over 13 billion years ago. Now its thin spinning disk settles, with the spiral arms we know.",
    keyPoints: ["Oldest stars: over 13 billion years old", "Grew by mergers", "About 100,000 light-years across"],
    category: "galaxies",
  },
  {
    id: "dark-energy",
    time: 9e9,
    title: "Dark energy takes over",
    when: "About 9 billion years",
    description:
      "For billions of years gravity slowed the expansion down. As matter thinned out, dark energy won. The expansion is now speeding up, and it still is.",
    keyPoints: ["Expansion started speeding up 5 to 6 billion years ago", "Dark energy is about 68% of everything", "Nobody yet knows what it is"],
    category: "expansion",
  },
  {
    id: "sun",
    time: 9.2e9,
    title: "The Sun forms",
    when: "9.2 billion years · 4.6 billion years ago",
    description:
      "In one arm of the Milky Way a cloud of gas, enriched by generations of earlier stars, collapses into the Sun and its planets. Open the Solar System experience to watch it happen.",
    keyPoints: ["Made from recycled star dust", "Earth forms soon after", "See it in the Solar System experience"],
    category: "home",
  },
  {
    id: "today",
    time: TODAY,
    title: "Today",
    when: "13.8 billion years",
    description:
      "Hundreds of billions of galaxies line a cosmic web. Ordinary matter is just 5% of it all. Dark matter is about 27% and dark energy about 68%.",
    keyPoints: ["Observable universe: about 93 billion light-years across", "Still expanding, and faster", "The afterglow is now 2.7 K"],
    category: "today",
  },
];
