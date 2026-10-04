// scripts/gen-city.ts
//
// Writes src/experiences/city/city.scene.json: a fictional river city
// growing from a farming village in 1700 to today. Buildings are produced
// from a small kit (cottage, townhouse, warehouse, factory, skyscraper,
// glass tower, ...) placed on plots; each plot holds a sequence of
// occupants that rise out of the ground and are later knocked down and
// replaced. Moving things (trains, trams, cars, boats) are keyed trips.
// Events and hover text live in cityStory.ts.
//
//   node scripts/gen-city.ts           # rewrite the JSON
//   node scripts/gen-city.ts --check   # fail if the JSON is stale
//
// Axes: x runs west to east along the river, z runs north (negative) to
// south (positive), y is up. One unit is roughly 10 metres.

import { END, START, cityStory } from "./cityStory.ts";
import { key, mixHex, rng, round, v3, writeScene, type Key, type Vec3 } from "./sceneKit.ts";

const C = {
  grass: "#C9D49B",
  soil: "#B9A07A",
  water: "#8DBFCF",
  dirt: "#D8C49C",
  cobble: "#CDB794",
  asphalt: "#B9B1A4",
  park: "#A8C98A",
  field1: "#E6D27F",
  field2: "#BFCB7F",
  wall: "#F4E6CC",
  stone: "#E3D3B4",
  brick: "#C0694F",
  brickDark: "#8E4A3A",
  roof: "#C8664B",
  roofDark: "#7C6577",
  timber: "#9A7552",
  glass: "#9CC3D2",
  glassDeep: "#7FA9BC",
  steel: "#D4573C",
  rail: "#6E625A",
  smoke: "#E6E0D6",
  leaf: "#7FB08A",
  leafDark: "#5E9472",
  trunk: "#8A6A4F",
  lampGas: "#F2CC8F",
  lampElectric: "#FFF6DC",
  ink: "#3B2F2A",
};

const PASTELS = ["#F2CC8F", "#E9B8A0", "#BFD6C0", "#F4E6CC", "#D9C2D8", "#E8C9A0"];
const rand = rng(1700);
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

/** River centre line (z) at x, and half width. */
const riverZ = (x: number) => 0.5 + 1.2 * Math.sin(x / 8);
const RIVER_HALF = 1.6;
/** North bank z at x: the waterfront where the quay, the lamps and later the highway run. */
const bankZ = (x: number) => riverZ(x) - RIVER_HALF;
/** Centre line of the elevated highway, one lane's width back from the water. */
const highwayZ = (x: number) => bankZ(x) - 1.15;
/** Hand-placed landmark plots; generated plots keep clear of them. */
const LANDMARK_SPOTS: [number, number][] = [[-6.5, -4.6], [4.6, -8.2], [-10.2, -5.3], [-13.4, -5.4]];
const clearOfLandmarks = (x: number, z: number) => LANDMARK_SPOTS.every(([lx, lz]) => Math.hypot(x - lx, z - lz) > 2);

const objects: Record<string, unknown>[] = [];
const add = (o: Record<string, unknown>) => objects.push(o);

interface Life {
  /** Year it starts rising; omit for things already standing in 1700. */
  from?: number;
  /** Year it starts coming down; omit for things still standing today. */
  to?: number;
  rise?: number;
  fall?: number;
}

/** Scale keys that grow a thing up out of the ground and later sink it. */
function lifeScale(life: Life, full: Vec3 = [1, 1, 1]): Key<Vec3>[] | Vec3 {
  if (life.from === undefined && life.to === undefined) return full;
  const flat = v3(full[0], 0, full[2]);
  const keys: Key<Vec3>[] = [];
  if (life.from !== undefined) {
    keys.push(key(life.from, flat), key(life.from + (life.rise ?? 3), full, "backOut"));
  } else {
    keys.push(key(START, full));
  }
  if (life.to !== undefined) {
    keys.push(key(life.to, full), key(life.to + (life.fall ?? 2), flat, "easeIn"));
  }
  return keys;
}

interface Part {
  primitive: string;
  params?: Record<string, number>;
  color: unknown;
  position?: unknown;
  rotation?: unknown;
  scale?: unknown;
  outline?: number | boolean;
  shading?: "flat" | "toon";
  visible?: unknown;
}

/** A group at `at` (fixed or keyed) turned `turn` degrees, with parts as children, living for `life`. */
function thing(id: string, at: Vec3 | Key<Vec3>[], turn: number, life: Life, parts: Part[], hover?: string): void {
  add({ id, primitive: "group", position: at, rotation: [0, turn, 0], scale: lifeScale(life) });
  parts.forEach((p, i) => add({ id: `${id}-${i + 1}`, parent: id, ...p, ...(hover ? { hover } : {}) }));
}

const box = (w: number, h: number, d: number, color: unknown, y = 0, extra: Partial<Part> = {}): Part => ({
  primitive: "box",
  params: { width: round(w), height: round(h), depth: round(d), bottom: 1 },
  color,
  position: v3(0, y, 0),
  ...extra,
});

/** Four-sided pyramid roof over a w x d footprint sitting at height y. */
const pyramid = (w: number, d: number, h: number, color: string, y: number): Part => ({
  primitive: "cone",
  params: { radius: 0.75, height: 1, radialSegments: 4, bottom: 1 },
  color,
  position: v3(0, y, 0),
  rotation: [0, 45, 0],
  scale: v3(round(w * 0.98), round(h), round(d * 0.98)),
});

/** Gable roof (a triangular prism) whose ridge runs along z. */
const gable = (w: number, d: number, h: number, color: string, y: number, x = 0): Part => ({
  primitive: "cylinder",
  params: { radiusTop: 0.5774, radiusBottom: 0.5774, height: 1, radialSegments: 3 },
  color,
  position: v3(x, y + h * 0.2887 / 0.866, 0),
  rotation: [-90, 0, 0],
  scale: v3(round(w * 1.08), round(d * 1.04), round(h / 0.866)),
});

// ---------------------------------------------------------------- kit

const WINDOW = "#6E7B83";
const DOOR = "#6B4A3A";
/** A flat dark pane on the front (+z) face of a building `depth` deep. */
const pane = (x: number, y: number, w: number, h: number, depth: number, color = WINDOW): Part => ({
  primitive: "box",
  params: { width: round(w), height: round(h), depth: 0.03, bottom: 1 },
  color,
  shading: "flat",
  outline: false,
  position: v3(x, y, depth / 2 + 0.01),
});

const KIT = {
  cottage: (): Part[] => {
    const w = 0.75 + rand() * 0.2;
    const h = 0.5 + rand() * 0.1;
    return [
      box(w, h, w * 0.9, pick([C.wall, "#EADBC0", "#F1E2C6"])),
      pyramid(w, w * 0.9, 0.42, pick([C.roof, C.timber, "#B88A5A"]), h),
      pane(0, 0, 0.16, 0.3, w * 0.9, DOOR),
    ];
  },
  farm: (): Part[] => [
    box(1.2, 0.6, 0.8, C.wall),
    gable(0.8, 1.2, 0.5, C.timber, 0.6),
    { ...box(0.8, 0.7, 1.0, "#B5654A"), position: v3(1.2, 0, 0.2) },
    gable(0.8, 1.0, 0.5, C.roofDark, 0.7, 1.2),
  ],
  townhouse: (): Part[] => {
    const h = 1.1 + rand() * 0.7;
    const parts = [box(0.95, h, 0.95, pick(PASTELS)), pyramid(0.95, 0.95, 0.5, pick([C.roof, C.roofDark, "#A65A45"]), h), pane(-0.2, 0, 0.18, 0.34, 0.95, DOOR)];
    for (let y = 0.5; y < h - 0.3; y += 0.45) parts.push(pane(-0.2, y, 0.17, 0.24, 0.95), pane(0.2, y, 0.17, 0.24, 0.95));
    parts.push(pane(0.2, 0.08, 0.17, 0.24, 0.95));
    return parts;
  },
  apartment: (): Part[] => {
    const h = 2 + rand() * 0.8;
    const parts = [box(1.35, h, 1.35, pick(["#D9B48F", "#C9A27E", "#E1C7A0"])), box(1.45, 0.15, 1.45, C.brickDark, h, { outline: 0.02 })];
    for (let y = 0.35; y < h - 0.3; y += 0.5) parts.push(pane(0, y, 1.05, 0.2, 1.35));
    return parts;
  },
  terrace: (): Part[] => [box(0.9, 0.85, 3.6, pick(["#C98A6A", "#B97A5E", "#D49A78"])), gable(0.9, 3.6, 0.45, C.roofDark, 0.85)],
  deco: (height: number, color: string): Part[] => [
    box(1.6, height * 0.55, 1.6, color),
    ...[-0.45, 0, 0.45].map((x) => pane(x, 0.5, 0.16, height * 0.55 - 0.8, 1.6)),
    ...[-0.25, 0.25].map((x) => pane(x, height * 0.55 + 0.3, 0.14, height * 0.27 - 0.6, 1.15)),
    box(1.15, height * 0.27, 1.15, color, height * 0.55),
    box(0.75, height * 0.13, 0.75, color, height * 0.82),
    { primitive: "cone", params: { radius: 0.16, height: 1.3, radialSegments: 8, bottom: 1 }, color: C.ink, position: v3(0, height * 0.95, 0) },
  ],
  glass: (height: number, color: string): Part[] => {
    const parts: Part[] = [box(1.7, height, 1.7, color)];
    for (let y = 1; y < height - 0.4; y += 1.1) {
      parts.push(box(1.74, 0.07, 1.74, mixHex(color, "#FFFFFF", 0.45), y, { outline: false, shading: "flat" }));
    }
    parts.push(box(1.2, 0.35, 1.2, "#7A6A5F", height));
    return parts;
  },
  warehouse: (): Part[] => [box(1.3, 1.25, 2.4, C.brick), gable(1.3, 2.4, 0.55, C.roofDark, 1.25)],
};

// ---------------------------------------------------------------- land

add({
  id: "land",
  primitive: "box",
  params: { width: 54, height: 1.2, depth: 38 },
  color: C.grass,
  outline: 0.08,
  position: [0, -0.6, 0],
});

for (let i = 0, x = -27; x < 27; i++, x += 2) {
  const x2 = x + 2;
  const z1 = riverZ(x);
  const z2 = riverZ(x2);
  const len = Math.hypot(2, z2 - z1) + 0.6;
  add({
    id: `river-${i + 1}`,
    primitive: "plane",
    params: { width: round(len), depth: RIVER_HALF * 2 },
    color: C.water,
    outline: false,
    hover: "river",
    position: v3((x + x2) / 2, 0.02 + (i % 2) * 0.004, (z1 + z2) / 2),
    rotation: [0, round((-Math.atan2(z2 - z1, 2) * 180) / Math.PI, 2), 0],
  });
}

interface District {
  id: string;
  at: [number, number];
  size: [number, number];
  colors: Key<string>[];
  from?: number;
}
const DISTRICTS: District[] = [
  { id: "old-town", at: [-3, -8.6], size: [14, 7.8], colors: [key(START, C.dirt), key(1800, C.cobble), key(1925, C.asphalt)] },
  { id: "docklands", at: [11, -5.4], size: [12, 4.6], colors: [key(START, C.dirt), key(1925, C.asphalt)], from: 1758 },
  { id: "financial", at: [-16, -8.6], size: [9, 7.8], colors: [key(START, C.cobble), key(1925, C.asphalt)], from: 1880 },
  { id: "station-quarter", at: [-13, 8.4], size: [14, 7.4], colors: [key(START, C.cobble), key(1925, C.asphalt)], from: 1836 },
  { id: "works", at: [10, 8.4], size: [14, 7.4], colors: [key(START, C.soil), key(1984, C.soil), key(1990, C.park, "smooth")], from: 1843 },
];
for (const d of DISTRICTS) {
  add({
    id: `district-${d.id}`,
    primitive: "plane",
    params: { width: d.size[0], depth: d.size[1] },
    color: d.colors,
    outline: false,
    hover: d.id,
    position: v3(d.at[0], 0.01, d.at[1]),
    scale: d.from === undefined ? 1 : [key(d.from, v3(0, 1, 0)), key(d.from + 6, v3(1, 1, 1), "smooth")],
  });
}

// Fields on the south bank until the railway and the works take the land.
[
  [-16, 8, 1836], [-10, 7, 1836], [-5, 10, 1840], [6, 7, 1843], [12, 10, 1843], [17, 6.5, 1843],
].forEach(([x, z, until], i) => {
  add({
    id: `field-${i + 1}`,
    primitive: "plane",
    params: { width: 4.2, depth: 2.6 },
    color: i % 2 ? C.field1 : C.field2,
    outline: false,
    position: v3(x, 0.015, z),
    rotation: [0, (i * 17) % 30 - 15, 0],
    scale: [key(until, v3(1, 1, 1)), key(until + 4, v3(0, 1, 0), "easeIn")],
  });
});

thing("farm-west", v3(-12.5, 0, 9.6), 20, { to: 1836 }, KIT.farm(), "farm");
thing("farm-east", v3(11, 0, 9.2), -15, { to: 1843 }, KIT.farm(), "farm");

// ---------------------------------------------------------------- trees

function tree(id: string, x: number, z: number, life: Life, size = 1, hover?: string): void {
  const s = size * (0.85 + rand() * 0.3);
  thing(id, v3(x, 0, z), 0, life, [
    { primitive: "cylinder", params: { radiusTop: 0.06, radiusBottom: 0.09, height: 0.5, radialSegments: 8, bottom: 1 }, color: C.trunk, outline: 0.015, scale: s },
    { primitive: "sphere", params: { radius: 0.42, widthSegments: 16, heightSegments: 12 }, color: rand() < 0.5 ? C.leaf : C.leafDark, position: v3(0, 0.75 * s, 0), scale: s, outline: 0.025 },
  ], hover);
}

const villageTrees: [number, number, number?][] = [
  [-20, -6, 1885], [-18, -10, 1885], [-14, -12, 1885], [-21, -13], [8, -12, 1900], [12, -11, 1900], [16, -12.5],
  [20, -9], [22, -13], [-23, 5], [-20, 13, 1840], [-2, 13], [2, 14], [18, 14], [22, 9], [23, 3.5, 1843], [-24, 14],
  [-6, 14.5], [10, 15], [14, 13, 1843], [-12, 14],
];
villageTrees.forEach(([x, z, until], i) => tree(`tree-${i + 1}`, x, z, until ? { to: until } : {}));

// ---------------------------------------------------------------- old town

thing("church", v3(-3, 0, -10), 0, {}, [
  box(1.3, 1.1, 2.6, C.stone),
  gable(1.3, 2.6, 0.75, C.roofDark, 1.1),
  { ...box(0.85, 2.3, 0.85, C.stone), position: v3(0, 0, 1.55) },
  { primitive: "cone", params: { radius: 0.62, height: 1.7, radialSegments: 4, bottom: 1 }, color: C.roofDark, position: v3(0, 2.3, 1.55), rotation: [0, 45, 0] },
  { primitive: "sphere", params: { radius: 0.12 }, color: C.lampGas, position: v3(0, 4.05, 1.55) },
], "church");

// Plots around the church. Each lists its occupants in order.
type Occupant = { kit: () => Part[]; from?: number; to?: number; hover?: string };
const plots: { at: [number, number]; turn: number; occupants: Occupant[] }[] = [];

const landmark = (x: number, z: number, occupants: Occupant[]) => plots.push({ at: [x, z], turn: 0, occupants });

for (let gx = -9; gx <= 3; gx += 2) {
  for (let gz = -12; gz <= -6; gz += 2) {
    if (Math.abs(gx + 3) < 2 && gz <= -8) continue; // church grounds
    if (gx === 1 && gz === -6) continue; // market square
    if (!clearOfLandmarks(gx, gz)) continue;
    const x = gx + (rand() - 0.5) * 0.4;
    const z = gz + (rand() - 0.5) * 0.4;
    const near = Math.hypot(gx + 3, gz + 9);
    const first = near < 5 ? undefined : Math.round(1705 + near * 6 + rand() * 25);
    const rebuilt = Math.round(1785 + rand() * 50);
    const occ: Occupant[] = [{ kit: KIT.cottage, from: first, to: rebuilt - 2 }];
    if (gx >= 1 && gz <= -10) {
      // The east edge becomes the business core: stone towers, then glass.
      const tower = Math.round(1898 + rand() * 30);
      occ.push({ kit: KIT.townhouse, from: rebuilt, to: tower - 3 });
      const glassYear = Math.round(1965 + rand() * 45);
      occ.push({ kit: () => KIT.deco(4.5 + rand() * 2.5, pick(["#D8C3A0", "#E2D1B0", "#CDB89A"])), from: tower, to: glassYear - 3 });
      occ.push({ kit: () => KIT.glass(5.5 + rand() * 3, pick([C.glass, C.glassDeep])), from: glassYear });
    } else if (rand() < 0.35) {
      const apt = Math.round(1880 + rand() * 50);
      occ.push({ kit: KIT.townhouse, from: rebuilt, to: apt - 3 }, { kit: KIT.apartment, from: apt });
    } else {
      occ.push({ kit: KIT.townhouse, from: rebuilt });
    }
    plots.push({ at: [x, z], turn: Math.round((rand() - 0.5) * 12), occupants: occ });
  }
}

// Financial district: farmland until the 1880s, apartment blocks, then glass.
for (let gx = -20; gx <= -12; gx += 2.2) {
  for (let gz = -12; gz <= -5.5; gz += 2.2) {
    if (!clearOfLandmarks(gx, gz)) continue;
    const apt = Math.round(1882 + rand() * 30);
    const glassYear = Math.round(1962 + rand() * 55);
    plots.push({
      at: [gx + rand() * 0.3, gz + rand() * 0.3],
      turn: 0,
      occupants: [
        { kit: KIT.apartment, from: apt, to: glassYear - 3 },
        { kit: () => KIT.glass(3.5 + rand() * 4, pick([C.glass, C.glassDeep, "#B4D0D6"])), from: glassYear },
      ],
    });
  }
}

// Named landmarks with their own hover text.
landmark(-6.5, -4.6, [
  { kit: KIT.townhouse, to: 1896 },
  { kit: () => KIT.deco(5.2, "#E6D3B0"), from: 1899, hover: "exchange" },
]);
landmark(4.6, -8.2, [
  { kit: KIT.cottage, to: 1798 },
  { kit: KIT.warehouse, from: 1800, to: 1925 },
  { kit: () => KIT.deco(9, "#D6BC92"), from: 1928, hover: "meridian" },
]);
landmark(-10.2, -5.3, [
  { kit: KIT.apartment, from: 1890, to: 1962 },
  { kit: () => KIT.glass(8.5, C.glassDeep), from: 1965, hover: "glass-tower" },
]);
landmark(-13.4, -5.4, [{ kit: () => [...KIT.glass(10.5, "#A9CCD8"), { primitive: "sphere", params: { radius: 0.5 }, color: C.leaf, position: v3(0, 10.85, 0) }], from: 2011, hover: "river-spire" }]);

plots.forEach((plot, i) => {
  plot.occupants.forEach((o, j) => {
    thing(`plot-${i + 1}-${j + 1}`, v3(plot.at[0], 0, plot.at[1]), plot.turn, { from: o.from, to: o.to }, o.kit(), o.hover);
  });
});

// ---------------------------------------------------------------- the mill

thing("mill", v3(-12, 0, bankZ(-12) + 0.25), 0, {}, [
  box(1.3, 1.1, 1.1, C.stone),
  pyramid(1.3, 1.1, 0.6, C.roof, 1.1),
], "mill");
add({ id: "mill-wheel", primitive: "group", position: v3(-12, 0.55, bankZ(-12) + 0.95), rotation: [key(START, v3(0, 0, 0)), key(1890, v3(0, 0, -190 * 220)), key(END, v3(0, 0, -190 * 220))] });
add({ id: "mill-wheel-rim", parent: "mill-wheel", primitive: "torus", params: { radius: 0.62, tube: 0.07, radialSegments: 8, tubularSegments: 32 }, color: C.timber, hover: "mill" });
for (let s = 0; s < 4; s++) {
  add({ id: `mill-wheel-spoke-${s + 1}`, parent: "mill-wheel", primitive: "box", params: { width: 1.2, height: 0.08, depth: 0.12 }, color: C.timber, outline: 0.015, rotation: [0, 0, s * 45], hover: "mill" });
}

// ---------------------------------------------------------------- port

// Stone quay along the north bank from the port years on.
for (let i = 0; i < 6; i++) {
  const x = 6 + i * 2;
  add({
    id: `quay-${i + 1}`,
    primitive: "box",
    params: { width: 2.05, height: 0.35, depth: 0.7, bottom: 1 },
    color: C.stone,
    outline: 0.02,
    hover: "docklands",
    position: v3(x, 0, riverZ(x) - RIVER_HALF - 0.1),
    rotation: [0, round((-Math.atan2(riverZ(x + 1) - riverZ(x - 1), 2) * 180) / Math.PI, 2), 0],
    scale: lifeScale({ from: 1758 + i }),
  });
}
for (let i = 0; i < 4; i++) {
  const x = 7 + i * 2.8;
  thing(`warehouse-${i + 1}`, v3(x, 0, bankZ(x) - 2.6), 90, { from: 1760 + i * 6 }, [
    box(1.3, 1.3, 2.4, [key(START, C.brick), key(1992, C.brick), key(1996, pick(["#E9B8A0", "#F2CC8F", "#BFD6C0"]), "smooth")]),
    gable(1.3, 2.4, 0.55, C.roofDark, 1.3),
  ], "warehouses");
}

function sailingShip(id: string, x: number, life: Life): void {
  const z = riverZ(x) - 0.4;
  thing(id, v3(x, 0.05, z), -4, life, [
    { primitive: "roundedBox", params: { width: 1.6, height: 0.35, depth: 0.55, radius: 0.12, segments: 2, bottom: 1 }, color: C.timber },
    { primitive: "cylinder", params: { radiusTop: 0.03, radiusBottom: 0.04, height: 1.5, radialSegments: 6, bottom: 1 }, color: C.trunk, position: v3(0.1, 0.35, 0), outline: 0.012 },
    { primitive: "box", params: { width: 0.8, height: 0.9, depth: 0.04 }, color: C.wall, position: v3(0.1, 1.15, 0), rotation: [0, 12, 0], outline: 0.015 },
  ], "ships");
}
sailingShip("sailing-ship-1", 9, { from: 1762, to: 1875 });
sailingShip("sailing-ship-2", 14, { from: 1770, to: 1860 });
thing("steamship", v3(12, 0.05, riverZ(12) - 0.3), 3, { from: 1862, to: 1962 }, [
  { primitive: "roundedBox", params: { width: 2.2, height: 0.4, depth: 0.7, radius: 0.15, segments: 2, bottom: 1 }, color: "#5E5A66" },
  { ...box(1, 0.35, 0.5, C.wall, 0.4), position: v3(-0.2, 0.4, 0) },
  { primitive: "cylinder", params: { radiusTop: 0.12, radiusBottom: 0.14, height: 0.6, radialSegments: 10, bottom: 1 }, color: C.steel, position: v3(0.2, 0.75, 0) },
], "ships");

/** Keys for something shuttling from a to b and back, every `period` years from `from` to `to`. */
function shuttle(from: number, to: number, period: number, a: Vec3, b: Vec3, dwell = 0.25): Key<Vec3>[] {
  const keys: Key<Vec3>[] = [key(from, a)];
  const travel = (period * (1 - 2 * dwell)) / 2;
  for (let t = from; t + period <= to; t += period) {
    keys.push(key(t + period * dwell, a), key(t + period * dwell + travel, b, "easeInOut"));
    keys.push(key(t + period * dwell * 2 + travel, b), key(t + period, a, "easeInOut"));
  }
  return keys;
}
/** Keys for something crossing from a to b repeatedly, jumping back to a out of sight. */
function loop(from: number, to: number, period: number, phase: number, a: Vec3, b: Vec3): Key<Vec3>[] {
  const start = from + phase * period;
  const keys: Key<Vec3>[] = [key(start, a)];
  for (let t = start; t + period <= to; t += period) keys.push(key(t + period * 0.999, b), key(t + period, a, "step"));
  return keys;
}

thing("tour-boat", shuttle(1998, END, 5, v3(-14, 0.05, riverZ(-14)), v3(16, 0.05, riverZ(16))), 0, { from: 1998 }, [
  { primitive: "roundedBox", params: { width: 1.5, height: 0.3, depth: 0.55, radius: 0.12, segments: 2, bottom: 1 }, color: C.wall },
  { ...box(0.9, 0.3, 0.45, C.glass, 0.3), position: v3(0, 0.3, 0) },
], "ships");

// ---------------------------------------------------------------- canal

add({ id: "canal", primitive: "plane", params: { width: 1.3, depth: 10.4 }, color: C.water, outline: false, hover: "canal", position: v3(-2, 0.018, 6.9), scale: lifeScale({ from: 1792, rise: 5 }, [1, 1, 1]) });
for (const side of [-1, 1]) {
  add({ id: `canal-wall-${side < 0 ? "w" : "e"}`, primitive: "box", params: { width: 0.2, height: 0.18, depth: 9.6, bottom: 1 }, color: C.stone, outline: 0.015, hover: "canal", position: v3(-2 + side * 0.75, 0, 7.3), scale: lifeScale({ from: 1793, rise: 4 }) });
}
thing("narrowboat", v3(-2, 0.03, 9), 0, { from: 1796, to: 1900 }, [
  { primitive: "roundedBox", params: { width: 0.4, height: 0.22, depth: 1.5, radius: 0.08, segments: 2, bottom: 1 }, color: "#81B29A" },
  { ...box(0.3, 0.2, 0.7, C.roof, 0.22), position: v3(0, 0.22, -0.2) },
], "canal");

// ---------------------------------------------------------------- railway

const TRACK_Z = 5.2;
add({ id: "railway", primitive: "box", params: { width: 22, height: 0.08, depth: 0.7, bottom: 1 }, color: "#8A7766", outline: 0.015, hover: "railway", position: v3(-17, 0, TRACK_Z), scale: lifeScale({ from: 1836, rise: 2 }) });
for (const dz of [-0.18, 0.18]) {
  add({ id: `rail-${dz < 0 ? "n" : "s"}`, primitive: "box", params: { width: 22, height: 0.06, depth: 0.05, bottom: 1 }, color: C.rail, outline: false, position: v3(-17, 0.08, TRACK_Z + dz), scale: lifeScale({ from: 1836.5, rise: 1.5 }) });
}
thing("station", v3(-9.5, 0, 7.4), 0, { from: 1836, rise: 4 }, [
  box(3.2, 1.3, 1.3, C.stone),
  gable(1.3, 3.2, 0.5, C.roofDark, 1.3),
  { primitive: "cylinder", params: { radiusTop: 0.9, radiusBottom: 0.9, height: 4.4, radialSegments: 20 }, color: [key(START, "#B8C9C6"), key(1990, "#B8C9C6"), key(1995, C.glass, "smooth")], position: v3(-1.4, 0, -2.2), rotation: [0, 0, 90], outline: 0.025 },
  { primitive: "cylinder", params: { radiusTop: 0.25, radiusBottom: 0.25, height: 0.08, radialSegments: 16 }, color: C.wall, position: v3(0, 1.0, 0.68), rotation: [90, 0, 0], outline: 0.015 },
], "station");
thing("station-tower", v3(-8.2, 0, 7.4), 0, { from: 1836, rise: 4 }, [
  box(0.7, 2.4, 0.7, C.stone),
  pyramid(0.7, 0.7, 0.6, C.roofDark, 2.4),
], "station");

// The train: steam until the 1960s, then a sleek electric one.
// The line comes out of a tunnel in a hill at the west edge.
add({ id: "hill", primitive: "sphere", params: { radius: 4, widthSegments: 40, heightSegments: 24 }, color: "#B5C98A", outline: 0.05, position: [-25.2, -2, TRACK_Z] });
thing("tunnel", v3(-22.7, 0, TRACK_Z), 0, { from: 1836, rise: 2 }, [
  box(0.5, 1.05, 1.25, C.stone),
  { ...box(0.52, 0.72, 0.8, C.ink, 0, { outline: false, shading: "flat" }), position: v3(0.02, 0, 0) },
], "railway");
add({ id: "train", primitive: "group", position: loop(1838, END, 7, 0, v3(-24.3, 0.14, TRACK_Z), v3(-8, 0.14, TRACK_Z)), scale: lifeScale({ from: 1838, rise: 0.5 }) });
const trainParts: [string, Part][] = [
  ["boiler", { primitive: "cylinder", params: { radiusTop: 0.22, radiusBottom: 0.22, height: 1.0, radialSegments: 14 }, color: [key(START, "#4F6B5A"), key(1962, "#4F6B5A"), key(1966, "#E2E0D8", "step")], position: v3(0.3, 0.32, 0), rotation: [0, 0, 90] }],
  ["cab", { ...box(0.5, 0.6, 0.5, [key(START, "#7A3B30"), key(1962, "#7A3B30"), key(1966, C.steel, "step")]), position: v3(-0.4, 0.1, 0) }],
  ["chimney", { primitive: "cylinder", params: { radiusTop: 0.09, radiusBottom: 0.06, height: 0.3, radialSegments: 8, bottom: 1 }, color: C.ink, position: v3(0.65, 0.5, 0), scale: [key(1962, v3(1, 1, 1)), key(1966, v3(1, 0, 1), "step")] }],
  ["car-1", { primitive: "roundedBox", params: { width: 1.1, height: 0.5, depth: 0.5, radius: 0.08, segments: 2, bottom: 1 }, color: [key(START, "#8A5A44"), key(1962, "#8A5A44"), key(1966, "#E2E0D8", "step")], position: v3(-1.35, 0.1, 0) }],
  ["car-2", { primitive: "roundedBox", params: { width: 1.1, height: 0.5, depth: 0.5, radius: 0.08, segments: 2, bottom: 1 }, color: [key(START, "#8A5A44"), key(1962, "#8A5A44"), key(1966, "#E2E0D8", "step")], position: v3(-2.6, 0.1, 0) }],
];
for (const [name, part] of trainParts) add({ id: `train-${name}`, parent: "train", ...part, hover: "train" });

// ---------------------------------------------------------------- works

const factories: { x: number; z: number; from: number; to: number; keepChimney?: boolean }[] = [
  { x: 7, z: 7.5, from: 1846, to: 1978, keepChimney: true },
  { x: 12.5, z: 6.8, from: 1855, to: 1981 },
  { x: 15.5, z: 10.5, from: 1868, to: 1976 },
  { x: 9, z: 11.2, from: 1874, to: 1983 },
];
factories.forEach((f, i) => {
  const id = `factory-${i + 1}`;
  const hover = i === 0 ? "riverside-works" : "factories";
  thing(id, v3(f.x, 0, f.z), 0, { from: f.from, to: f.to, rise: 4, fall: 3 }, [
    box(3.2, 1.5, 2.2, C.brick),
    gable(1.07, 2.2, 0.5, C.roofDark, 1.5, -1.07),
    gable(1.07, 2.2, 0.5, C.roofDark, 1.5, 0),
    gable(1.07, 2.2, 0.5, C.roofDark, 1.5, 1.07),
  ], hover);
  const chimney = `${id}-chimney`;
  thing(chimney, v3(f.x + 1.9, 0, f.z - 0.6), 0, { from: f.from + 1, to: f.keepChimney ? undefined : f.to, rise: 5, fall: 3 }, [
    { primitive: "cylinder", params: { radiusTop: 0.22, radiusBottom: 0.32, height: 4.2, radialSegments: 14, bottom: 1 }, color: C.brickDark },
    { primitive: "torus", params: { radius: 0.24, tube: 0.06, radialSegments: 6, tubularSegments: 16 }, color: C.ink, position: v3(0, 4.15, 0), rotation: [90, 0, 0], outline: false },
  ], f.keepChimney ? "chimney" : hover);
  for (let p = 0; p < 3; p++) {
    const puffs: Key<Vec3>[] = [key(f.from + 5, v3(0, 0, 0))];
    for (let t = f.from + 6; t <= f.to; t += 2) puffs.push(key(t, v3(1, 1, 1).map((s) => round(s * (0.8 + 0.3 * Math.sin(t * 1.3 + p * 2)))) as Vec3, "smooth"));
    puffs.push(key(f.to + 1, v3(0, 0, 0), "easeIn"));
    add({
      id: `${id}-smoke-${p + 1}`,
      primitive: "sphere",
      params: { radius: 0.32 + p * 0.12, widthSegments: 14, heightSegments: 10 },
      color: C.smoke,
      outline: 0.02,
      hover: "smoke",
      position: v3(f.x + 1.9 + p * 0.45, 4.6 + p * 0.55, f.z - 0.6 - p * 0.2),
      scale: puffs,
    });
  }
});

// Worker terraces: built with the works, partly replaced by flats in the 1960s.
for (let i = 0; i < 5; i++) {
  const x = 2.2 + i * 1.35;
  const late = i % 2 === 0;
  thing(`terrace-${i + 1}`, v3(x, 0, 12.2), 0, { from: 1850 + i * 4, to: late ? 1963 : undefined }, KIT.terrace(), "terraces");
  if (late) thing(`flats-${i + 1}`, v3(x, 0, 12.2), 0, { from: 1966 + i }, [box(1.1, 2.6, 3.4, "#E1D6C4"), box(1.2, 0.12, 3.5, "#7A6A5F", 2.6)], "terraces");
}
for (let i = 0; i < 6; i++) {
  const x = -15.5 + i * 1.35;
  thing(`station-terrace-${i + 1}`, v3(x, 0, 10.6), 0, { from: 1845 + i * 3 }, KIT.terrace(), "station-quarter");
}

// The park that replaces the works, with a pond and trees.
add({ id: "pond", primitive: "cylinder", params: { radiusTop: 1.6, radiusBottom: 1.6, height: 0.04, radialSegments: 28 }, color: C.water, outline: 0.02, hover: "park", position: v3(12, 0.03, 8.5), scale: [key(1988, v3(0, 1, 0)), key(1992, v3(1, 1, 1.3), "backOut")] });
[[9, 6.5], [10.5, 10.5], [14.5, 6.2], [15.5, 9.5], [16.8, 11.6], [8, 10], [6, 11], [13.5, 11.6], [5.5, 6.2], [17.2, 7.2], [11, 6]].forEach(([x, z], i) =>
  tree(`park-tree-${i + 1}`, x, z, { from: 1987 + i * 0.8 }, 1.2, "park"),
);

// ---------------------------------------------------------------- bridges

const BRIDGE_X = 2;
const bz = riverZ(BRIDGE_X);
thing("wooden-bridge", v3(BRIDGE_X, 0, bz), 0, { from: 1762, to: 1886, rise: 3 }, [
  box(1.0, 0.12, 6.2, C.timber, 0.4),
  ...[-1.4, 0, 1.4].map((dz) => ({ primitive: "cylinder", params: { radiusTop: 0.08, radiusBottom: 0.08, height: 0.45, radialSegments: 6, bottom: 1 }, color: C.trunk, position: v3(0, 0, dz), outline: 0.012 })),
], "wooden-bridge");
thing("bridge", v3(BRIDGE_X, 0, bz), 0, { from: 1887, rise: 3 }, [
  box(1.5, 0.2, 7.6, "#B9A994", 0.8),
  ...[-0.72, 0.72].map((dx) => ({ primitive: "torus", params: { radius: 3.4, tube: 0.1, radialSegments: 8, tubularSegments: 40, arc: 180 }, color: C.steel, position: v3(dx, -0.9, 0), rotation: [0, 90, 0], outline: 0.025 })),
  ...[-2.4, -1.2, 0, 1.2, 2.4].flatMap((dz) => [-0.72, 0.72].map((dx) => ({ primitive: "box", params: { width: 0.04, height: 1, depth: 0.04, bottom: 1 }, color: C.steel, position: v3(dx, 1.0, dz), scale: v3(1, round(Math.sqrt(3.4 * 3.4 - dz * dz) - 1.9), 1), outline: false }))),
], "bridge");

// Trams cross the bridge from the 1890s, vanish in the 1950s and come back.
function tram(id: string, from: number, to: number | undefined, body: string, roof: string, hover: string): void {
  add({ id, primitive: "group", position: shuttle(from, to ?? END, 4, v3(BRIDGE_X, 1.0, bz - 3.2), v3(BRIDGE_X, 1.0, bz + 3.2)), scale: lifeScale({ from, to, rise: 1, fall: 1 }) });
  add({ id: `${id}-body`, parent: id, primitive: "roundedBox", params: { width: 0.55, height: 0.5, depth: 1.3, radius: 0.1, segments: 2, bottom: 1 }, color: body, hover });
  add({ id: `${id}-roof`, parent: id, primitive: "roundedBox", params: { width: 0.6, height: 0.08, depth: 1.35, radius: 0.03, segments: 1, bottom: 1 }, color: roof, position: v3(0, 0.5, 0), outline: 0.015, hover });
  add({ id: `${id}-pole`, parent: id, primitive: "cylinder", params: { radiusTop: 0.015, radiusBottom: 0.015, height: 0.45, radialSegments: 4, bottom: 1 }, color: C.ink, position: v3(0, 0.58, 0), rotation: [-30, 0, 0], outline: false, hover });
}
tram("tram", 1895, 1957, "#7FA37F", C.wall, "tram");
tram("light-rail", 2012, undefined, C.wall, C.steel, "light-rail");

// ---------------------------------------------------------------- streetlights

for (let i = 0; i < 8; i++) {
  const x = -9 + i * 3;
  const z = bankZ(x) - 0.2;
  thing(`gas-lamp-${i + 1}`, v3(x, 0, z), 0, { from: 1818 + i * 0.6, to: 1882 + i * 0.5, rise: 1, fall: 1 }, [
    { primitive: "cylinder", params: { radiusTop: 0.035, radiusBottom: 0.05, height: 0.8, radialSegments: 6, bottom: 1 }, color: C.ink, outline: false },
    { primitive: "box", params: { width: 0.18, height: 0.22, depth: 0.18, bottom: 1 }, color: C.lampGas, shading: "flat", position: v3(0, 0.8, 0), outline: 0.015 },
  ], "gas-lamps");
  thing(`electric-lamp-${i + 1}`, v3(x, 0, z), 0, { from: 1883 + i * 0.5, rise: 1.5 }, [
    { primitive: "cylinder", params: { radiusTop: 0.03, radiusBottom: 0.05, height: 1.3, radialSegments: 6, bottom: 1 }, color: "#4C5A55", outline: false },
    { primitive: "sphere", params: { radius: 0.13, widthSegments: 12, heightSegments: 8 }, color: C.lampElectric, shading: "flat", position: v3(0, 1.38, 0), outline: 0.015 },
  ], "electric-lamps");
}

// ---------------------------------------------------------------- roads and cars

const HIGHWAY_Y = 1.5;
const HIGHWAY_XS = Array.from({ length: 14 }, (_, i) => -26 + i * 4);
thing("highway", v3(0, 0, 0), 0, { from: 1954, to: 2001, rise: 3, fall: 3 }, [
  ...HIGHWAY_XS.slice(1).map((x2, i) => {
    const x1 = HIGHWAY_XS[i];
    const dz = highwayZ(x2) - highwayZ(x1);
    return {
      ...box(Math.hypot(4, dz) + 0.3, 0.22, 1.5, "#A8A196", HIGHWAY_Y),
      position: v3((x1 + x2) / 2, HIGHWAY_Y, (highwayZ(x1) + highwayZ(x2)) / 2),
      rotation: [0, round((-Math.atan2(dz, 4) * 180) / Math.PI, 2), 0],
    };
  }),
  ...HIGHWAY_XS.slice(1, -1).map((x) => ({ primitive: "cylinder", params: { radiusTop: 0.15, radiusBottom: 0.18, height: HIGHWAY_Y, radialSegments: 8, bottom: 1 }, color: "#BDB5A8", position: v3(x, 0, highwayZ(x)), outline: 0.015 })),
], "highway");
const RING_Z = -15;
add({ id: "ring-road", primitive: "box", params: { width: 54, height: 0.06, depth: 1.3, bottom: 1 }, color: C.asphalt, outline: 0.015, hover: "ring-road", position: v3(0, 0, RING_Z), scale: lifeScale({ from: 1958, rise: 4 }) });

const CAR_COLORS = [C.steel, "#5E8FB0", C.lampGas, "#81B29A", "#E9B8A0", C.wall];
function car(id: string, keys: Key<Vec3>[], life: Life, turn: number): void {
  add({ id, primitive: "group", position: keys, rotation: [0, turn, 0], scale: lifeScale({ ...life, rise: 0.5, fall: 0.5 }) });
  const color = pick(CAR_COLORS);
  add({ id: `${id}-body`, parent: id, primitive: "roundedBox", params: { width: 0.6, height: 0.2, depth: 0.32, radius: 0.07, segments: 2, bottom: 1 }, color, outline: 0.015, hover: "cars" });
  add({ id: `${id}-top`, parent: id, primitive: "roundedBox", params: { width: 0.32, height: 0.15, depth: 0.28, radius: 0.06, segments: 2, bottom: 1 }, color: mixHex(color, "#FFFFFF", 0.4), position: v3(-0.04, 0.2, 0), outline: 0.015, hover: "cars" });
}
/** Like loop, but along a polyline: keys at every point, spaced evenly in time. */
function route(from: number, to: number, period: number, phase: number, points: Vec3[]): Key<Vec3>[] {
  const start = from + phase * period;
  const keys: Key<Vec3>[] = [key(start, points[0])];
  for (let t = start; t + period <= to; t += period) {
    points.slice(1).forEach((p, i) => keys.push(key(t + (period * 0.999 * (i + 1)) / (points.length - 1), p)));
    keys.push(key(t + period, points[0], "step"));
  }
  return keys;
}
for (let i = 0; i < 6; i++) {
  const east = i % 2 === 0;
  const lane = east ? 0.35 : -0.35;
  const xs = east ? HIGHWAY_XS : [...HIGHWAY_XS].reverse();
  const points = xs.map((x) => v3(x, HIGHWAY_Y + 0.22, highwayZ(x) + lane));
  car(`highway-car-${i + 1}`, route(1958, 2001, 2.4, i / 6, points), { from: 1958 + i * 0.3, to: 2000 }, east ? 0 : 180);
}
for (let i = 0; i < 7; i++) {
  const east = i % 2 === 0;
  const lane = east ? 0.3 : -0.3;
  const a = v3(east ? -26 : 26, 0.06, RING_Z + lane);
  const b = v3(east ? 26 : -26, 0.06, RING_Z + lane);
  car(`ring-car-${i + 1}`, loop(1965, END, 2.8, i / 7, a, b), { from: 1965 + i * 0.4 }, east ? 0 : 180);
}
for (let i = 0; i < 2; i++) {
  const a = v3(BRIDGE_X + (i ? 0.35 : -0.35), 1.0, bz + (i ? -3.6 : 3.6));
  const b = v3(BRIDGE_X + (i ? 0.35 : -0.35), 1.0, bz + (i ? 3.6 : -3.6));
  car(`bridge-car-${i + 1}`, loop(1925, END, 3, i * 0.5, a, b), { from: 1925 + i }, i ? -90 : 90);
}

// The waterfront promenade that replaces the elevated highway.
for (let i = 0; i < 10; i++) {
  const x = -14 + i * 3.2;
  tree(`promenade-tree-${i + 1}`, x, riverZ(x) - RIVER_HALF - 1.4, { from: 2003 + i * 0.5 }, 0.9, "promenade");
}

export const cityScene = { ...cityStory, objects };

export const CITY_SCENE_PATH = "src/experiences/city/city.scene.json";

if (import.meta.main) writeScene(CITY_SCENE_PATH, cityScene);
