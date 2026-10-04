// src/experiences/tree/treeData.ts
//
// The oak's story and hover text. Event times come from STORY in
// treeModel, so the cards and the visuals line up. Figures are for an
// open-grown English oak (Quercus robur) in Britain.

import type { ObjectMetadata, TimelineEvent } from "../../core/types";
import { STORY, formatAge, girthAt, heightAt, ringCount, trunkRadiusAt } from "./treeModel";
import { treeStateAt } from "./treeState";

export const EVENTS: TimelineEvent[] = [
  {
    id: "acorn",
    time: 0,
    title: "A jay buries an acorn",
    when: "Year 0 · October",
    description:
      "A jay carries an acorn away from its parent oak and pushes it into the soil to eat in winter. It never comes back for this one.",
    keyPoints: [
      "One jay can bury several thousand acorns in an autumn.",
      "Forgotten acorns are how oaks spread far from the parent tree.",
      "English oak acorns hang on long stalks, a mark of the species.",
    ],
    category: "seed",
  },
  {
    id: "radicle",
    time: STORY.radicle,
    title: "Root first",
    when: "A few weeks later",
    description:
      "Oak acorns do not wait for spring. Within weeks a root, the radicle, splits the shell and grows down into the soil.",
    keyPoints: [
      "The food store stays inside the shell, underground.",
      "An acorn that dries out dies, so being buried helps.",
    ],
    category: "seed",
  },
  {
    id: "first-leaves",
    time: STORY.shoot,
    title: "Shoot up, first true leaves",
    when: "Year 1 · April and May",
    description:
      "In spring a shoot pushes up out of the buried acorn and unfolds the first lobed leaves. From now on the seedling feeds itself on sunlight.",
    keyPoints: [
      "The acorn stays below ground, still feeding the seedling.",
      "English oak leaves have four or five pairs of rounded lobes and almost no stalk.",
      "A first-year seedling is usually 10 to 20 cm tall.",
    ],
    category: "seedling",
  },
  {
    id: "marcescence",
    time: 1.2,
    title: "Brown leaves in winter",
    when: "Year 1 · December",
    description: "The leaves die in autumn but a young oak often keeps them, dry and brown, until new buds push them off in spring.",
    keyPoints: ["Holding dead leaves is called marcescence. Young beech trees do it too."],
    category: "seedling",
  },
  {
    id: "sapling",
    time: STORY.sapling,
    title: "Sapling",
    when: `Year ${Math.floor(STORY.sapling)}`,
    description: `About ${heightAt(STORY.sapling).toFixed(1)} m tall, with leafy branches all the way down the stem.`,
    keyPoints: [
      "Rabbits and deer nibbling shoots and bark are the big danger now.",
      "In good light it grows 30 to 50 cm a year.",
      "Oak needs light: seedlings in deep shade rarely make it.",
    ],
    category: "growth",
  },
  {
    id: "crown-lift",
    time: STORY.crownLift,
    title: "The crown lifts",
    when: `Year ${Math.floor(STORY.crownLift)}`,
    description: "The lowest branches are now shaded by the crown above. They die and drop off, leaving a clean trunk.",
    keyPoints: ["Foresters call this self-pruning.", `The tree is about ${Math.round(heightAt(STORY.crownLift))} m tall.`],
    category: "growth",
  },
  {
    id: "first-acorns",
    time: STORY.firstAcorns,
    title: "First acorns",
    when: `Year ${Math.floor(STORY.firstAcorns)}`,
    description: "At around 40 years old an English oak starts to make acorns of its own.",
    keyPoints: [
      "Acorns ripen in September and October and fall soon after.",
      "Crops grow with age and peak at around 80 to 120 years.",
    ],
    category: "acorns",
  },
  {
    id: "mast",
    time: STORY.mast,
    title: "A mast year",
    when: `Year ${Math.floor(STORY.mast)}`,
    description:
      "Every so often oaks across a whole region make a huge crop at once. In a mast year one big oak can drop thousands of acorns.",
    keyPoints: [
      "Jays, squirrels and mice cannot eat them all, so some survive to grow.",
      "In between, most years bring only a light crop.",
    ],
    category: "acorns",
  },
  {
    id: "storm",
    time: STORY.storm,
    title: "A storm tears off a limb",
    when: `Year ${Math.floor(STORY.storm)}`,
    description:
      "A gale snaps one of the great lower limbs. More than a tonne of wood crashes down and rips a long strip of bark from the trunk.",
    keyPoints: [
      "The tree walls off the wound inside so rot cannot spread far.",
      "Its growth rings are narrow for a few years while it recovers.",
    ],
    category: "storm",
  },
  {
    id: "healing",
    time: 90,
    title: "Growing around the scar",
    when: "Year 90",
    description: "Rolls of new wood and bark creep in from the edges of the wound, a centimetre or two a year.",
    keyPoints: [
      "A wound this big may never close completely.",
      "The fallen limb is left to rot: dead wood feeds fungi and beetles.",
    ],
    category: "storm",
  },
  {
    id: "woodpecker",
    time: STORY.woodpecker,
    title: "A woodpecker moves in",
    when: "Year 101",
    description: "A great spotted woodpecker chisels a nest hole into the trunk where heart rot has softened the wood.",
    keyPoints: [
      "Woodpeckers dig a fresh hole most years.",
      "Old holes become homes for blue tits, starlings and bats.",
    ],
    category: "wildlife",
  },
  {
    id: "owl",
    time: STORY.owl,
    title: "An owl in the hollow",
    when: "Year 124",
    description: "Rot behind the old storm scar has opened a hollow. A tawny owl raises its chicks inside.",
    keyPoints: [
      "A hollow does not kill an oak. The living part of a trunk is its outer few centimetres.",
      "Hollow trees can even stand up to wind better.",
    ],
    category: "wildlife",
  },
  {
    id: "veteran",
    time: STORY.end,
    title: "A veteran in the making",
    when: "Year 150",
    description:
      "With a scar, a hollow and dead wood, this oak is already a veteran tree and a home for hundreds of species. Yet it is only middle-aged: English oaks can live for more than 1,000 years.",
    keyPoints: [
      "About 2,300 species live on or with oaks in the UK, more than any other native tree.",
      `About ${Math.round(heightAt(STORY.end))} m tall, with a girth of about ${girthAt(STORY.end).toFixed(1)} m.`,
      "The saying goes: 300 years growing, 300 years living, 300 years dying.",
    ],
    category: "veteran",
  },
];

function metres(m: number): string {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  return `${m.toFixed(m < 10 ? 1 : 0)} m`;
}

const SEASON_TEXT: Record<string, string> = {
  winter: "Winter: bare twigs, buds waiting.",
  spring: "Spring: fresh leaves unfold in late April and May.",
  summer: "Summer: the crown in full leaf, making sugar all day.",
  autumn: "Autumn: leaves turn gold and brown and fall.",
};

/** Hover text at time t. Values that change with time are read from the state at t. */
export function hoverInfo(id: string, t: number): ObjectMetadata | null {
  const s = treeStateAt(t);
  const age = formatAge(t);
  switch (id) {
    case "trunk": {
      if (t < STORY.shoot) return null;
      const rings = ringCount(t);
      return {
        id,
        name: "Trunk",
        description:
          rings === 0
            ? "A green stem no thicker than a pencil lead. Its first growth ring is forming."
            : `${rings} growth ${rings === 1 ? "ring" : "rings"} at the base, one for every year. Oak adds about 2.5 cm of girth a year in the open.`,
        category: "tree",
        properties: {
          Age: age,
          Height: metres(s.heightM),
          Girth: s.girthM > 0 ? `${metres(s.girthM)} at 1.3 m` : `${Math.max(1, Math.round(trunkRadiusAt(0, t) * 2000))} mm thick`,
        },
      };
    }
    case "canopy":
      return {
        id,
        name: t < 3 ? "Leaves" : "Canopy",
        description: SEASON_TEXT[s.season] + (t < 25 ? " Young oaks often keep dead leaves through winter." : ""),
        category: "tree",
        properties: {
          Season: s.season,
          "Crown width": metres(s.crownWidthM),
          "Leaf cover": `${Math.round(s.leafCover * 100)}%`,
        },
      };
    case "roots":
      return {
        id,
        name: t < 1 ? "Radicle" : "Roots",
        description:
          t < 3
            ? "The first root dives straight down as a taproot, anchoring the seedling and finding water."
            : "Most oak roots lie in the top 60 cm of soil and spread well past the crown. Fungi wrapped around the fine roots trade water and minerals for sugar.",
        category: "tree",
        properties: { Age: age, "Root spread": t < 3 ? "a few cm" : `about ${metres(1.6 * s.crownWidthM)} across` },
      };
    case "hill":
      return {
        id,
        name: "Soil",
        description: "Dark topsoil full of roots, worms and fungi, over paler subsoil and clay.",
        category: "ground",
      };
    case "seed":
      if (t < STORY.radicle) {
        return {
          id,
          name: "Acorn",
          description: "This acorn is about 2.5 cm long. It holds enough food to start a tree.",
          category: "seed",
          properties: { Length: "about 2.5 cm" },
        };
      }
      if (t < STORY.shoot) {
        return {
          id,
          name: "Acorn",
          description: "The root has split the shell and the food store inside still feeds it. The acorn itself stays underground.",
          category: "seed",
        };
      }
      return {
        id,
        name: "Spent shell",
        description: "The seedling has drawn down the food store that was packed inside the acorn. The empty shell rots away in the soil within a couple of years.",
        category: "seed",
      };
    case "acorns":
      return {
        id,
        name: "Acorns",
        description: s.acorns.mast
          ? "A mast year: a huge crop, far more than jays, squirrels and mice can eat."
          : "Acorns ripen from green to brown in September and October, then fall.",
        category: "seed",
        properties: { "Acorns from": "about 40 years", "Peak crop": "80 to 120 years" },
      };
    case "rings":
      return {
        id,
        name: "Growth rings",
        description:
          "A slice through the trunk near the ground, magnified. Each ring is one year: pale spring wood with big pores, then dense summer wood." +
          (t >= STORY.storm ? " Narrow rings after year 84 mark the storm." : ""),
        category: "tree",
        properties: { Rings: ringCount(t), Age: age, "Pale sapwood": "outer 20 to 30 rings" },
      };
    case "scar":
      return {
        id,
        name: t < 110 ? "Storm scar" : "Storm scar and hollow",
        description:
          t < 110
            ? "Where the limb tore away. New wood rolls in from the edges and the tree seals off rot inside."
            : "Rot got in behind the scar and hollowed it out. A hollow oak can live for centuries.",
        category: "tree",
        properties: { Since: `${Math.floor(t - STORY.storm)} years ago` },
      };
    case "storm-limb":
      return t < STORY.storm
        ? {
            id,
            name: "Great limb",
            description: "One of the big lower limbs, reaching out sideways to catch light. It carries a heavy load of leaves in summer.",
            category: "tree",
          }
        : {
            id,
            name: "Fallen limb",
            description: "Left where it fell. Rotting wood feeds fungi, beetle grubs and the birds that eat them.",
            category: "tree",
            properties: { "On the ground": `${Math.floor(t - STORY.storm)} years` },
          };
    case "woodpecker-hole":
      return {
        id,
        name: "Woodpecker hole",
        description: "A round hole about 5 cm across, chiselled into soft wood. Once the woodpeckers leave, tits, starlings or bats move in.",
        category: "wildlife",
      };
    case "storm":
      return { id, name: "Gale", description: "Winds strong enough to snap a limb as thick as a person.", category: "weather" };
    case "jay":
      return {
        id,
        name: "Eurasian jay",
        description: "A shy, colourful crow. Jays bury thousands of acorns each autumn and plant more oaks than anyone.",
        category: "wildlife",
        properties: { Length: "34 cm" },
      };
    case "rabbit":
      return {
        id,
        name: "Rabbit",
        description: "Rabbits nibble young bark and shoots. Many saplings never get past this stage.",
        category: "wildlife",
      };
    case "squirrel":
      return {
        id,
        name: "Grey squirrel",
        description: "Gathers and buries acorns in autumn. Some forgotten ones grow into oaks.",
        category: "wildlife",
      };
    case "woodpecker":
      return {
        id,
        name: "Great spotted woodpecker",
        description: "Drums on dead branches in spring and digs a new nest hole most years.",
        category: "wildlife",
        properties: { Length: "23 cm" },
      };
    case "owl":
      return {
        id,
        name: "Tawny owl",
        description: "The 'twit-twoo' owl. It nests in hollow trees and hunts mice and voles at night.",
        category: "wildlife",
        properties: { Length: "38 cm" },
      };
    default:
      return null;
  }
}

