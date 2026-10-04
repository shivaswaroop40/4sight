// src/experiences/universe/universeHover.ts
//
// What each hoverable says, as a pure function of time. The same object
// tells a different story in each era: the CMB is a fog, then a flash, then
// the oldest light we can see.

import type { ObjectMetadata } from "../../core/types";

export type HoverId = "cmb" | "first-stars" | "cluster" | "filament" | "milky-way" | "sun";

interface HoverDef {
  name: string;
  category: string;
  properties: Record<string, string>;
  /** [startTime, text] pairs, sorted; the last one at or before t applies. */
  story: [number, string][];
}

const HOVERS: Record<HoverId, HoverDef> = {
  cmb: {
    name: "CMB horizon",
    category: "light",
    properties: { Released: "380,000 years after the Big Bang", "Temperature then": "About 3,000 K", "Temperature today": "2.725 K" },
    story: [
      [0, "Not released yet. Space is a glowing fog of plasma, and light cannot travel far before bumping into a free electron."],
      [1e4, "Sound waves ripple through the hot plasma. Their pattern is about to be frozen into the sky."],
      [3.2e5, "Atoms are forming and the fog is lifting. This light is breaking free right now, and it will still be arriving 13.8 billion years later."],
      [4.5e5, "The edge of what we can see. Look this far away and you see the cosmic microwave background, the fog as it was at 380,000 years."],
    ],
  },
  "first-stars": {
    name: "First stars",
    category: "stars",
    properties: { Mass: "Maybe 100 or more Suns each", Lifetime: "A few million years", Made: "The first carbon, oxygen and iron" },
    story: [
      [0, "Huge, hot, blue stars made of pure hydrogen and helium, lighting up the end of the dark ages."],
      [3e8, "The first stars are burning out. Their explosions scatter heavy elements into the gas that makes the next generation."],
    ],
  },
  cluster: {
    name: "Galaxy cluster",
    category: "structure",
    properties: { Galaxies: "Hundreds to thousands", Mass: "10¹⁴ to 10¹⁵ Suns", "Mostly made of": "Dark matter" },
    story: [
      [0, "A dense knot of dark matter. It is pulling in gas from everywhere around it."],
      [2.5e8, "Young galaxies are falling into this knot. It is becoming a cluster."],
      [3e9, "A galaxy cluster: hundreds of galaxies held together by gravity, the biggest bound objects in the universe. Gravity holds it together against the expansion."],
    ],
  },
  filament: {
    name: "Cosmic web filament",
    category: "structure",
    properties: { Length: "Tens to hundreds of millions of light-years", "Made of": "Dark matter and thin gas" },
    story: [
      [0, "A thread of dark matter slowly gathering ordinary gas. This is the scaffolding galaxies will grow on."],
      [2.5e8, "Galaxies light up along this thread and flow along it toward the clusters at its ends."],
    ],
  },
  "milky-way": {
    name: "Milky Way",
    category: "home",
    properties: { Size: "About 100,000 light-years across", Stars: "100 to 400 billion", "Oldest stars": "Over 13 billion years old" },
    story: [
      [0, "The patch of gas that will become our galaxy. The observable universe is a ball centred on us, so we sit in the middle."],
      [6e8, "Our galaxy as a young clump, growing by swallowing smaller galaxies. Its oldest stars are already shining."],
      [5e9, "Our galaxy's thin, spinning disk has settled, with the spiral arms we know."],
      [9.2e9, "Our galaxy. The Sun formed in one of its arms, about halfway out from the centre, 4.6 billion years ago."],
    ],
  },
  sun: {
    name: "The Sun",
    category: "home",
    properties: { Formed: "4.6 billion years ago", "Born at": "9.2 billion years after the Big Bang", Type: "G2V star" },
    story: [
      [0, "A cloud of gas in one arm of the Milky Way, enriched by earlier generations of stars, is collapsing under its own gravity. The Sun is about to light up."],
      [9.2e9, "The Sun has just lit up, 4.6 billion years ago. The leftover disk of gas and dust around it is clumping into planets, Earth among them."],
      [9.7e9, "A steady yellow star with its planets settled. Earth already has oceans, and the first life is appearing on it."],
      [1.35e10, "The Sun is about halfway through its 10-billion-year life and slowly brightening. Open the Solar System experience to watch its story."],
    ],
  },
};

export function isHoverId(id: string): id is HoverId {
  return Object.hasOwn(HOVERS, id);
}

export function hoverInfo(id: string, t: number): ObjectMetadata | null {
  if (!isHoverId(id)) return null;
  const def = HOVERS[id];
  let description = def.story[0][1];
  for (const [start, text] of def.story) if (t >= start) description = text;
  return { id, name: def.name, description, category: def.category, properties: def.properties };
}
