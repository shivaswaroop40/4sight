// src/experiences/continents/reconstruction.ts
//
// Where every block sat at each key age, as a rotation of the globe that
// carries its present-day outline to its position back then. The table is
// authored as a plate circuit, the way published reconstructions are built:
// Africa moves in a paleomagnetic frame, and every other block rides on a
// parent with its own finite rotation (an Euler pole and an opening angle
// that shrinks to 0 today). Composing the circuit once here leaves the
// runtime a flat table: one quaternion per block per age, slerped.
//
// Sources for the shapes of the motions: the Bullard (1965) Atlantic fits,
// Klitgord & Schouten (1986) for the Central Atlantic, Roest & Srivastava
// (1989) for the Labrador Sea, and the Scotese PALEOMAP and Müller et al.
// (2016) reconstructions for paleolatitudes and timing. The angles are
// rounded and tuned so the cartoon outlines fit.

import type * as THREE from "three";
import { ANCHORS } from "./continentsData";
import type { BlockId } from "./outlines";
import { compose, euler, place, type LonLat } from "./sphere";

/** Key ages in millions of years ago, oldest first. */
export const AGES = [250, 200, 170, 150, 130, 120, 90, 66, 50, 40, 20, 0] as const;
export type Age = (typeof AGES)[number];

type Keys = Record<Age, THREE.Quaternion>;
type Angles = Record<Age, number>;

function keys(f: (age: Age) => THREE.Quaternion): Keys {
  return Object.fromEntries(AGES.map((a) => [a, f(a)])) as Keys;
}

/** A child riding on a parent: parent motion after the child's own. */
function on(parent: Keys, child: Keys): Keys {
  return keys((a) => compose(parent[a], child[a]));
}

/** One Euler pole with an angle per age. */
function opening(pole: LonLat, angles: Angles): Keys {
  return keys((a) => euler(pole, angles[a]));
}

/** Absolute placements of a block's anchor: [lon, lat, turn] per age. */
function placements(id: BlockId, table: Record<Age, readonly [number, number, number]>): Keys {
  return keys((a) => place(ANCHORS[id], [table[a][0], table[a][1]], table[a][2]));
}

const africa = placements("africa", {
  250: [8, -22, -28],
  200: [10, -13, -26],
  170: [11, -12, -24],
  150: [12, -12, -22],
  130: [13, -13, -19],
  120: [13.5, -13, -17],
  90: [15, -10, -12],
  66: [17, -8, -8],
  50: [18, -5, -5],
  40: [18.5, -3, -3.5],
  20: [19.5, 2, -1],
  0: [20, 5, 0],
});

const southAmerica = on(
  africa,
  opening([-30.6, 44], { 250: 57, 200: 57, 170: 57, 150: 57, 130: 56.5, 120: 52, 90: 40, 66: 27, 50: 21, 40: 16.5, 20: 8.5, 0: 0 }),
);

const northAmerica = on(
  africa,
  opening([-15, 67], { 250: 76, 200: 76, 170: 70, 150: 62, 130: 57, 120: 54, 90: 40, 66: 29, 50: 22, 40: 17, 20: 8, 0: 0 }),
);

const greenland = on(
  northAmerica,
  opening([-95, 70], { 250: -14, 200: -14, 170: -14, 150: -14, 130: -14, 120: -14, 90: -14, 66: -12, 50: -7, 40: -3, 20: -1, 0: 0 }),
);

const eurasia = on(
  northAmerica,
  opening([27.7, 88.5], { 250: -38, 200: -38, 170: -38, 150: -38, 130: -37, 120: -36, 90: -31, 66: -26, 50: -21, 40: -16, 20: -8, 0: 0 }),
);

const arabia = on(
  africa,
  opening([23, 31.5], { 250: -7, 200: -7, 170: -7, 150: -7, 130: -7, 120: -7, 90: -7, 66: -7, 50: -7, 40: -7, 20: -3, 0: 0 }),
);

/** Madagascar slid south along the Davie Ridge between about 165 and 120 million years ago. */
const madagascar = on(
  africa,
  keys((a) => {
    const at: Record<Age, readonly [number, number, number]> = {
      250: [44, -6, -15], 200: [44, -6, -15], 170: [44, -6, -15], 150: [45, -12, -8], 130: [46, -17, -2],
      120: [46.5, -19, 0], 90: [46.5, -19, 0], 66: [46.5, -19, 0], 50: [46.5, -19, 0], 40: [46.5, -19, 0],
      20: [46.5, -19, 0], 0: [46.5, -19, 0],
    };
    return place(ANCHORS.madagascar, [at[a][0], at[a][1]], at[a][2]);
  }),
);

/** India against Madagascar's east coast, as part of Gondwana. */
const INDIA_FIT = place(ANCHORS.india, [56, -22], -43);

const india = keys((a) => {
  if (a >= 90) return compose(madagascar[a], INDIA_FIT);
  if (a === 66) return compose(africa[66], place(ANCHORS.india, [67, -12], -18));
  // After about 50 million years ago India is jammed against Asia, still
  // pushing north as Greater India slides under Tibet. Degrees of latitude
  // still to go in Eurasia's frame: about 2,400 km of convergence since the
  // collision, slowing from roughly 7 cm a year to 4 to 5 today (Molnar &
  // Stock 2009; GPS across the Himalaya gives 3.5 to 5, DeMets & Merkouriev
  // 2021).
  const behind: Partial<Record<Age, number>> = { 50: 22, 40: 16, 20: 8, 0: 0 };
  const [lon, lat] = ANCHORS.india;
  return compose(eurasia[a], place(ANCHORS.india, [lon, lat - behind[a]!], 0));
});

const antarctica = on(
  africa,
  keys((a) => {
    const at: Record<Age, readonly [number, number, number]> = {
      250: [42, -35, 45], 200: [42, -35, 45], 170: [42.5, -36, 44], 150: [43, -40, 43], 130: [43, -44, 40],
      120: [42, -48, 37], 90: [38, -57, 28], 66: [34, -67, 22], 50: [30, -70, 16], 40: [28, -73, 12],
      20: [24, -77, 6], 0: [20, -80, 0],
    };
    return place(ANCHORS.antarctica, [at[a][0], at[a][1]], at[a][2]);
  }),
);

const australia = on(
  antarctica,
  opening([38, 13], { 250: -31, 200: -31, 170: -31, 150: -31, 130: -31, 120: -31, 90: -30, 66: -28.5, 50: -27, 40: -23, 20: -12, 0: 0 }),
);

/** Zealandia rifted off Australia as the Tasman Sea opened, 85 to 52 million years ago. */
const ZEALANDIA_FIT = place(ANCHORS.zealandia, [162, -36], -20);
const zealandia = on(
  australia,
  keys((a) => {
    if (a >= 90) return ZEALANDIA_FIT;
    if (a === 66) return place(ANCHORS.zealandia, [168, -38.5], -10);
    return place(ANCHORS.zealandia, ANCHORS.zealandia, 0);
  }),
);

const flat = (k: Keys): readonly THREE.Quaternion[] => AGES.map((a) => k[a].normalize());

/** One rotation per entry in AGES, oldest first. The last is always identity. */
export const ROTATIONS: Record<BlockId, readonly THREE.Quaternion[]> = {
  northAmerica: flat(northAmerica),
  greenland: flat(greenland),
  southAmerica: flat(southAmerica),
  eurasia: flat(eurasia),
  africa: flat(africa),
  arabia: flat(arabia),
  india: flat(india),
  madagascar: flat(madagascar),
  antarctica: flat(antarctica),
  australia: flat(australia),
  zealandia: flat(zealandia),
};
