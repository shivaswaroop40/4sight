// src/experiences/continents/continentsData.ts
//
// Content for the continental drift globe: the blocks with their colours
// and stories, the mountain ranges, the ocean labels, and the timeline
// events. Times are in millions of years ago (Ma); the experience's time
// axis is -Ma so it runs forward from 250 million years ago to today.

import type { TimelineEvent } from "../../core/types";
import type { BlockId } from "./outlines";
import type { LonLat } from "./sphere";

/** A present-day reference point inside each block, used for "centre" readouts and for placing it. */
export const ANCHORS: Record<BlockId, LonLat> = {
  northAmerica: [-100, 48],
  greenland: [-42, 72],
  southAmerica: [-60, -12],
  eurasia: [80, 50],
  africa: [20, 5],
  arabia: [46, 23],
  india: [78, 21],
  madagascar: [46.5, -19],
  antarctica: [20, -80],
  australia: [134, -25],
  zealandia: [174, -41],
};

/** A value that changes with age: [Ma, value] pairs, oldest first, linear in between and flat outside. */
export type Profile = readonly (readonly [number, number])[];

export interface BlockDef {
  id: BlockId;
  name: string;
  color: string;
  /**
   * Height of the land above the ocean, in globe radii. Where two blocks
   * overlap the higher one covers the lower: Asia sits highest so Greater
   * India can slide under it.
   */
  height: number;
  /** What the block is up to, [from Ma, text], oldest first. */
  story: readonly (readonly [number, string])[];
  /** 0 = bare land, 1 = under an ice sheet. */
  ice?: Profile;
}

export const BLOCKS: BlockDef[] = [
  {
    id: "eurasia",
    name: "Eurasia",
    color: "#B5C47A",
    height: 0.028,
    story: [
      [250, "The northern half of Pangaea. Much of eastern Asia was still a scatter of smaller blocks."],
      [175, "Part of Laurasia, the northern supercontinent, with the Tethys Ocean on its southern shore."],
      [50, "India rams into its southern edge and starts to lift the Himalaya and Tibet."],
      [30, "Africa and Arabia push in from the south, raising the Alps and the Zagros."],
      [5, "Still squeezed by India, Arabia and Africa. Mountain building has not stopped."],
    ],
  },
  {
    id: "northAmerica",
    name: "North America",
    color: "#81B29A",
    height: 0.024,
    story: [
      [250, "Locked between Africa and Europe in the middle of Pangaea."],
      [195, "Pulling away from Africa as the Central Atlantic opens."],
      [80, "The Rocky Mountains begin to rise as Pacific ocean floor pushes under the west coast."],
      [55, "Europe and Greenland drift off to the east as the North Atlantic opens."],
      [5, "Still moving away from Europe, about as fast as your fingernails grow."],
    ],
  },
  {
    id: "greenland",
    name: "Greenland",
    color: "#9CC3A6",
    height: 0.026,
    ice: [[3.5, 0], [2.5, 1]],
    story: [
      [250, "Wedged between North America and Scandinavia, far from any ice."],
      [62, "The Labrador Sea opens and Greenland swings away from Canada."],
      [55, "The North Atlantic unzips along its east coast as Europe pulls away."],
      [3, "Ice sheets bury it as the northern ice ages begin."],
    ],
  },
  {
    id: "southAmerica",
    name: "South America",
    color: "#F2CC8F",
    height: 0.022,
    story: [
      [250, "Part of Gondwana, its bulge tucked into the Gulf of Guinea in Africa."],
      [135, "The South Atlantic unzips from the south as it splits from Africa."],
      [90, "The Andes grow as the Pacific seafloor dives under its west coast."],
      [34, "The Drake Passage opens and it finally lets go of Antarctica."],
      [3, "Panama closes the gap to North America and animals walk between them."],
    ],
  },
  {
    id: "africa",
    name: "Africa",
    color: "#E07A5F",
    height: 0.022,
    story: [
      [250, "The heart of Pangaea, with most of the other continents pressed against it."],
      [180, "The rest of Gondwana starts to peel away from its eastern side."],
      [130, "South America splits off to the west."],
      [35, "Crawling north into Europe, closing the old Tethys Ocean."],
      [5, "Still pushing into Europe, and slowly tearing apart along the East African Rift."],
    ],
  },
  {
    id: "arabia",
    name: "Arabia",
    color: "#F0A868",
    height: 0.024,
    story: [
      [250, "The northeast corner of Africa, facing the Tethys Ocean."],
      [30, "The Red Sea opens and Arabia breaks away from Africa."],
      [20, "Arabia hits Asia and folds up the Zagros Mountains in Iran."],
    ],
  },
  {
    id: "india",
    name: "India",
    color: "#9C6B98",
    height: 0.018,
    story: [
      [250, "Deep in Gondwana, between Africa, Antarctica and Australia. Its northern edge, Greater India, reached far beyond today's coast."],
      [130, "Breaks from Antarctica and Australia, still joined to Madagascar."],
      [88, "Leaves Madagascar behind and races north, among the fastest plates ever measured."],
      [66, "Crosses a hot spot that floods it with lava, the Deccan Traps."],
      [50, "Rams into Asia. Its northern edge slides under Tibet and the Himalaya rise."],
      [20, "Still pushing north, crumpling Asia. Mount Everest grows a few millimetres each year."],
    ],
  },
  {
    id: "madagascar",
    name: "Madagascar",
    color: "#C98BB0",
    height: 0.024,
    story: [
      [250, "Pressed against the coast of East Africa, next to Somalia and Kenya."],
      [165, "Slides south along a giant fault to where it sits today."],
      [88, "India breaks away from its east coast. It has been an island ever since."],
    ],
  },
  {
    id: "antarctica",
    name: "Antarctica",
    color: "#A9C4C7",
    height: 0.022,
    ice: [[36, 0], [32, 1]],
    story: [
      [250, "At the southern end of Gondwana, but green and forested, with no ice."],
      [180, "Gondwana starts to break apart around it."],
      [85, "Settles over the South Pole while Australia slowly rifts away."],
      [34, "As carbon dioxide falls and a cold current starts to circle it, it freezes over."],
    ],
  },
  {
    id: "australia",
    name: "Australia",
    color: "#E9B44C",
    height: 0.026,
    story: [
      [250, "Its southern coast is glued to Antarctica, deep in Gondwana."],
      [85, "Starts to rift from Antarctica, very slowly."],
      [45, "Speeds north, opening the Southern Ocean behind it."],
      [5, "Still heading north toward Asia at about 7 cm a year."],
    ],
  },
  {
    id: "zealandia",
    name: "Zealandia",
    color: "#6FA287",
    height: 0.024,
    story: [
      [250, "Part of Gondwana, beside Australia and Antarctica. Most of Zealandia is now under the sea; New Zealand is its highest part."],
      [85, "Splits from Australia as the Tasman Sea opens."],
      [25, "A plate boundary now runs right through it."],
      [5, "Squeezing along that boundary lifts the Southern Alps."],
    ],
  },
];

export interface RangeDef {
  id: string;
  name: string;
  block: BlockId;
  /** Ridge line in present-day coordinates. */
  path: LonLat[];
  /** Peak height at full growth, in globe radii. Cartoon scale, not true scale. */
  height: number;
  /** Growth, 0 to 1, by age. */
  growth: Profile;
}

export const RANGES: RangeDef[] = [
  {
    id: "himalaya",
    name: "Himalaya",
    block: "eurasia",
    path: [[74.5, 35.6], [77, 34.2], [79.5, 32], [81.5, 30.4], [84, 29], [86.9, 28.4], [89.5, 28.2], [92, 28.3], [94.5, 29]],
    height: 0.075,
    growth: [[50, 0], [40, 0.35], [20, 0.75], [0, 1]],
  },
  {
    id: "tibet",
    name: "Tibetan Plateau",
    block: "eurasia",
    path: [[80, 34.5], [84, 33], [88, 33.5], [92, 32.5], [96, 33.5]],
    height: 0.045,
    growth: [[48, 0], [30, 0.5], [10, 0.9], [0, 1]],
  },
  {
    id: "alps",
    name: "Alps",
    block: "eurasia",
    path: [[6.5, 44.6], [7.2, 46.1], [9, 46.5], [11.5, 47], [14, 47.3]],
    height: 0.04,
    growth: [[45, 0], [30, 0.4], [10, 0.9], [0, 1]],
  },
  {
    id: "zagros",
    name: "Zagros",
    block: "eurasia",
    path: [[45.6, 35.5], [47.8, 33.4], [50.2, 31], [52.6, 29.6], [55.2, 28]],
    height: 0.035,
    growth: [[25, 0], [12, 0.6], [0, 1]],
  },
  {
    id: "urals",
    name: "Urals",
    block: "eurasia",
    path: [[58.5, 51.5], [59, 55], [59.3, 58.5], [59.8, 62], [62, 65.5]],
    height: 0.04,
    growth: [[250, 1], [0, 0.5]],
  },
  {
    id: "andes",
    name: "Andes",
    block: "southAmerica",
    path: [
      [-74.5, 7], [-76, 3], [-78.3, -1], [-77.5, -6], [-75.5, -11], [-72, -15], [-68.8, -18], [-67.8, -22],
      [-68.6, -26.5], [-70, -32.7], [-70.8, -37], [-71.6, -41.5], [-72.6, -46], [-73, -50.5],
    ],
    height: 0.06,
    growth: [[150, 0.1], [90, 0.3], [40, 0.5], [10, 0.9], [0, 1]],
  },
  {
    id: "rockies",
    name: "Rocky Mountains",
    block: "northAmerica",
    path: [[-106, 35.8], [-106, 39.2], [-108.5, 42.8], [-111.5, 45.5], [-114.5, 48.5], [-117.5, 51.8], [-121.5, 54.8], [-126.5, 58.5]],
    height: 0.045,
    growth: [[85, 0], [70, 0.6], [55, 1], [0, 0.85]],
  },
  {
    id: "appalachians",
    name: "Appalachians",
    block: "northAmerica",
    path: [[-85, 34.3], [-82.5, 35.8], [-80, 37.6], [-77.5, 40.3], [-74.5, 42.2], [-71.8, 44.2], [-69, 45.8]],
    height: 0.045,
    growth: [[250, 1], [0, 0.4]],
  },
];

/** Where a map label sits: halfway between two points that ride on blocks, or at a fixed spot. */
export type LabelAnchor =
  | { kind: "between"; a: [BlockId, LonLat]; b: [BlockId, LonLat] }
  | { kind: "fixed"; at: LonLat };

export interface MapLabelDef {
  id: string;
  text: string;
  /** Oceans are lettered in italics, supercontinents in bold capitals. */
  kind: "ocean" | "land";
  anchor: LabelAnchor;
  opacity: Profile;
}

export const MAP_LABELS: MapLabelDef[] = [
  {
    id: "pangaea",
    text: "PANGAEA",
    kind: "land",
    anchor: { kind: "between", a: ["africa", [5, 12]], b: ["northAmerica", [-90, 38]] },
    opacity: [[205, 1], [185, 0]],
  },
  {
    id: "laurasia",
    text: "LAURASIA",
    kind: "land",
    anchor: { kind: "between", a: ["northAmerica", [-95, 52]], b: ["eurasia", [30, 56]] },
    opacity: [[185, 0], [170, 1], [135, 1], [120, 0]],
  },
  {
    id: "gondwana",
    text: "GONDWANA",
    kind: "land",
    anchor: { kind: "between", a: ["africa", [24, -12]], b: ["southAmerica", [-52, -12]] },
    opacity: [[185, 0], [170, 1], [140, 1], [128, 0]],
  },
  { id: "panthalassa", text: "Panthalassa", kind: "ocean", anchor: { kind: "fixed", at: [-150, 8] }, opacity: [[190, 1], [170, 0]] },
  { id: "pacific", text: "Pacific Ocean", kind: "ocean", anchor: { kind: "fixed", at: [-150, 8] }, opacity: [[170, 0], [150, 1]] },
  {
    id: "tethys",
    text: "Tethys Ocean",
    kind: "ocean",
    // Over the last stretch of the Tethys, between Arabia and Iran, so the name
    // survives India's arrival and goes only when Arabia closes it at 20 Ma.
    anchor: { kind: "between", a: ["arabia", [48, 27]], b: ["eurasia", [54, 33]] },
    opacity: [[30, 1], [20, 0]],
  },
  {
    id: "atlantic",
    text: "Atlantic Ocean",
    kind: "ocean",
    anchor: { kind: "between", a: ["northAmerica", [-72, 36]], b: ["africa", [-12, 18]] },
    opacity: [[160, 0], [130, 1]],
  },
  {
    id: "indian",
    text: "Indian Ocean",
    kind: "ocean",
    anchor: { kind: "between", a: ["africa", [40, -16]], b: ["australia", [115, -26]] },
    opacity: [[110, 0], [90, 1]],
  },
];

function ago(ma: number): string {
  return ma === 0 ? "Today" : `${ma} million years ago`;
}

function event(id: string, ma: number, title: string, description: string, keyPoints: string[], when = ago(ma)): TimelineEvent {
  // 0 - ma rather than -ma, so Today is 0 and not -0.
  return { id, time: 0 - ma, title, when, description, keyPoints };
}

export const EVENTS: TimelineEvent[] = [
  event(
    "pangaea",
    250,
    "Pangaea",
    "Almost all the land on Earth is one supercontinent, Pangaea, wrapped around the Tethys Ocean. A single world ocean, Panthalassa, covers the rest of the globe.",
    [
      "Life is recovering from the worst mass extinction ever, at the end of the Permian.",
      "You could walk from Antarctica to Siberia.",
      "The Appalachians and the Urals are young, tall mountains where continents collided.",
    ],
  ),
  event(
    "central-atlantic",
    200,
    "The Central Atlantic opens",
    "A rift splits North America from Africa. Huge lava floods pour out along the crack, and in time the sea floods in to start a new ocean.",
    [
      "The lava floods are linked to the end-Triassic mass extinction, 201 million years ago.",
      "After it, dinosaurs take over the land.",
      "The coasts of New England and Morocco were once side by side.",
    ],
  ),
  event(
    "laurasia-gondwana",
    175,
    "Pangaea splits in two",
    "The new seaway links up with the Tethys Ocean, cutting Pangaea into Laurasia in the north and Gondwana in the south.",
    [
      "Laurasia: North America, Greenland, Europe and Asia.",
      "Gondwana: South America, Africa, Antarctica, India, Madagascar, Australia and Zealandia.",
      "Gondwana starts to break up too, as Madagascar slides away from East Africa.",
    ],
    "~175 million years ago",
  ),
  event(
    "south-atlantic",
    130,
    "The South Atlantic opens",
    "South America tears away from Africa, starting at the southern end and unzipping northward.",
    [
      "Brazil's bulge fits into the Gulf of Guinea like a jigsaw piece.",
      "Matching rocks and fossils on both coasts were early evidence that continents move.",
      "The last link, near the equator, breaks around 100 million years ago.",
    ],
    "~130 million years ago",
  ),
  event(
    "india-races",
    88,
    "India races north",
    "India breaks away from Madagascar and heads north toward Asia, at its fastest 15 to 20 cm a year, several times faster than plates move today.",
    [
      "In about 40 million years it travels over 4,000 km.",
      "Madagascar stays behind. Isolated ever since, it grew plants and animals found nowhere else.",
      "The ocean ahead of India sinks under Asia as it goes.",
    ],
    "~88 million years ago",
  ),
  event(
    "k-pg",
    66,
    "The dinosaurs die out",
    "An asteroid about 10 km wide hits Mexico's Yucatán Peninsula. Three quarters of all species vanish, including every dinosaur except the birds.",
    [
      "At the same time, the Deccan Traps flood western India with lava.",
      "The crater, Chicxulub, is about 180 km across, buried under the Yucatán coast.",
      "Mammals take over the empty world.",
    ],
  ),
  event(
    "india-asia",
    50,
    "India hits Asia",
    "India collides with Asia. Its northern edge slides under Tibet, and the crust crumples up into the Himalaya and the Tibetan Plateau.",
    [
      "Fossils of sea creatures sit in limestone near the top of Mount Everest.",
      "India is still pushing north about 4 to 5 cm a year.",
      "Everest is 8,849 m tall and still growing.",
    ],
    "~50 million years ago",
  ),
  event(
    "antarctica-ice",
    34,
    "Antarctica freezes",
    "Carbon dioxide in the air has been falling for millions of years. Now Australia and South America pull away, a cold current starts to circle Antarctica, and it freezes over.",
    [
      "The ice sheet forms in a few hundred thousand years.",
      "Earth switches from a hothouse to an icehouse world.",
      "Today the ice is up to 4.8 km thick.",
    ],
    "~34 million years ago",
  ),
  event(
    "today",
    0,
    "Today",
    "The plates are still moving, 2 to 10 cm a year, about as fast as your fingernails grow.",
    [
      "The Atlantic grows about 2.5 cm wider every year.",
      "Australia is heading toward Asia at about 7 cm a year.",
      "In 200 to 250 million years the continents may merge into a new supercontinent.",
    ],
  ),
];
