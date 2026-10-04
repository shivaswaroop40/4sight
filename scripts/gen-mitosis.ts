// scripts/gen-mitosis.ts
//
// Writes src/experiences/mitosis/mitosis.scene.json: one animal cell
// dividing, from late G2 to two daughter cells, in minutes. The story text
// lives here as data; the motion is a few positions per phase, plus curves
// sampled every half minute where one easing cannot follow (the cell
// pinching in two, the ring that does the pinching, organelles riding along).
//
//   node scripts/gen-mitosis.ts           # rewrite the JSON
//   node scripts/gen-mitosis.ts --check   # fail if the JSON is stale
//
// Axes: x runs pole to pole, y is up, z faces the default camera. The cell
// radius is 3 units, roughly 20 micrometres in a real cell.

import { key, lerp, mixHex, rng, round, sampled, smoothWindow, v3, writeScene, type Key, type Vec3 } from "./sceneKit.ts";

/** Phase boundaries in minutes. Shared by events, motion and hover text. */
const T = {
  start: 0,
  prophase: 5,
  condensed: 18,
  prometaphase: 20,
  envelopeGone: 23,
  metaphase: 30,
  anaphase: 45,
  anaphaseEnd: 50,
  telophase: 50,
  cytokinesis: 52,
  daughters: 62,
  end: 65,
} as const;

const COLORS = {
  membrane: "#F6C9AE",
  nucleus: "#C9A4CC",
  nucleolus: "#8E5F8A",
  centrosome: "#F2CC8F",
  centriole: "#7A6A5F",
  fibre: "#8C7B70",
  ring: "#D4573C",
  mitochondrion: "#E39A6B",
};

const PALE = "#FBF5EA";

/** Distance of each daughter half from the middle, and its radius. Volume stays close to constant. */
function halfOffset(t: number): number {
  return lerp(0, 0.8, smoothWindow(t, 46, T.cytokinesis)) + lerp(0, 1.58, smoothWindow(t, T.cytokinesis, T.daughters));
}
function halfRadius(t: number): number {
  return lerp(3, 2.4, smoothWindow(t, T.cytokinesis, T.daughters));
}
/** Radius of the waist where the two halves meet: where the contractile ring sits. */
function waist(t: number): number {
  const r = halfRadius(t);
  const d = halfOffset(t);
  return Math.sqrt(Math.max(r * r - d * d, 0));
}

const HALF_STEP = 0.5;
const objects: Record<string, unknown>[] = [];
const add = (o: Record<string, unknown>) => objects.push(o);

// The cell: two overlapping halves that read as one sphere until anaphase,
// then slide apart into two cells. Half B stays hidden while they coincide
// exactly, so the two shells never fight for the same pixels.
for (const side of [-1, 1]) {
  add({
    id: side < 0 ? "cell-a" : "cell-b",
    primitive: "sphere",
    params: { radius: 1, widthSegments: 48, heightSegments: 32 },
    color: COLORS.membrane,
    opacity: 0.3,
    renderOrder: 3,
    outline: 0.025,
    hover: "membrane",
    visible: side < 0 ? true : [key(0, false), key(46.2, true, "step")],
    position: [key(0, v3(0, 0, 0)), ...sampled(46, T.daughters, HALF_STEP, (t) => v3(side * halfOffset(t), 0, 0))],
    scale: [key(0, 3), ...sampled(T.cytokinesis, T.daughters, HALF_STEP, (t) => round(halfRadius(t)))],
  });
}

add({
  id: "contractile-ring",
  primitive: "torus",
  params: { radius: 1, tube: 0.03, radialSegments: 10, tubularSegments: 64 },
  color: COLORS.ring,
  outline: 0.02,
  hover: "ring",
  rotation: [0, 90, 0],
  visible: [key(0, false), key(T.anaphaseEnd, true, "step")],
  scale: sampled(T.anaphaseEnd, T.end, HALF_STEP, (t) => round(Math.max(waist(t) - 0.04, 0.22))),
});

// Mitochondria ride along with whichever half they sit in.
const rand = rng(7);
for (let i = 0; i < 10; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const angle = ((i * 0.37 + rand() * 0.2) % 1) * Math.PI * 2;
  const spread = 1.9 + rand() * 0.6;
  const local: Vec3 = [side * Math.abs(Math.cos(angle)) * spread * 0.9, Math.sin(angle) * spread * 0.85, (rand() - 0.5) * 1.6];
  const spin = rand() * 180;
  add({
    id: `mitochondrion-${i + 1}`,
    primitive: "capsule",
    params: { radius: 0.11, length: 0.34, capSegments: 4, radialSegments: 10 },
    color: COLORS.mitochondrion,
    outline: 0.02,
    hover: "mitochondrion",
    position: sampled(T.start, T.end, 1, (t) => {
      const k = halfRadius(t) / 3;
      const wobble = 0.08 * Math.sin(t * 0.6 + i);
      return v3(side * halfOffset(t) + local[0] * k, local[1] * k + wobble, local[2] * k);
    }),
    rotation: [key(0, v3(20, spin, 70)), key(T.end, v3(60, spin + 140, 110))],
  });
}

// Nucleus, nucleolus and the envelope that breaks into fragments.
add({
  id: "nucleus",
  primitive: "sphere",
  params: { radius: 1.55, widthSegments: 40, heightSegments: 28 },
  color: COLORS.nucleus,
  opacity: [key(0, 0.4), key(T.prometaphase, 0.4), key(22.5, 0, "easeIn")],
  renderOrder: 1,
  outline: 0.025,
  hover: "envelope",
});
add({
  id: "nucleolus",
  primitive: "sphere",
  params: { radius: 0.32 },
  color: COLORS.nucleolus,
  hover: "nucleolus",
  position: [0.55, -0.15, -0.5],
  scale: [key(0, 1), key(8, 1), key(15, 0, "easeIn")],
});
const fragmentTurns: Vec3[] = [
  [0, 0, 10], [0, 0, 100], [0, 0, 190], [0, 0, 280], [90, 0, 40], [90, 0, 220], [0, 90, 80], [0, 90, 260],
  [45, 45, 160], [-45, 30, 320], [30, -60, 20], [-30, 60, 200],
];
fragmentTurns.forEach((rotation, i) => {
  add({
    id: `envelope-fragment-${i + 1}`,
    primitive: "torus",
    params: { radius: 1.55, tube: 0.04, radialSegments: 8, tubularSegments: 12, arc: 30 },
    color: COLORS.nucleus,
    outline: 0.02,
    hover: "envelope",
    rotation,
    visible: [key(0, false), key(T.prometaphase, true, "step")],
    scale: [key(0, 1), key(T.prometaphase, 1), key(T.envelopeGone, 1.12, "easeOut"), key(26 + i * 0.15, 0, "easeIn")],
  });
});

// Centrosomes: each a blob of pericentriolar material with two centrioles
// at right angles and a starburst of astral microtubules.
const centrosomePath = (side: number): Key<Vec3>[] => [
  key(0, v3(side * 0.3, 1.85, 0.25)),
  key(T.prophase + 1, v3(side * 0.3, 1.85, 0.25)),
  key(11, v3(side * 1.3, 1.6, 0.2), "smooth"),
  key(16, v3(side * 2.05, 0.85, 0.1), "smooth"),
  key(21, v3(side * 2.3, 0, 0), "smooth"),
  key(46, v3(side * 2.3, 0, 0)),
  key(T.cytokinesis, v3(side * 3.0, 0, 0), "smooth"),
  key(T.daughters, v3(side * 3.05, 1.3, 0.3), "smooth"),
];
for (const side of [-1, 1]) {
  const id = side < 0 ? "centrosome-l" : "centrosome-r";
  add({ id, primitive: "group", position: centrosomePath(side) });
  add({
    id: `${id}-pcm`,
    parent: id,
    primitive: "sphere",
    params: { radius: 0.24 },
    color: COLORS.centrosome,
    hover: "centrosome",
  });
  for (const [n, rotation] of [[1, [0, 0, 0]], [2, [90, 0, 0]]] as const) {
    add({
      id: `${id}-centriole-${n}`,
      parent: id,
      primitive: "cylinder",
      params: { radiusTop: 0.055, radiusBottom: 0.055, height: 0.26, radialSegments: 12 },
      color: COLORS.centriole,
      outline: 0.015,
      hover: "centrosome",
      position: n === 1 ? [0.06, 0.04, 0.16] : [-0.05, -0.05, 0.19],
      rotation: [...rotation],
    });
  }
  for (let r = 0; r < 9; r++) {
    // Rays fan out over the side facing away from the spindle.
    const phi = side < 0 ? 95 + r * 21 : 85 - r * 21;
    add({
      id: `${id}-aster-${r + 1}`,
      parent: id,
      primitive: "cylinder",
      params: { radiusTop: 0.012, radiusBottom: 0.02, height: 0.85, radialSegments: 6, bottom: 1 },
      color: COLORS.fibre,
      shading: "flat",
      outline: false,
      hover: "spindle",
      rotation: [((r * 37) % 50) - 25, 0, phi - 90],
      scale: [key(0, v3(1, 0.35, 1)), key(T.prophase, v3(1, 0.35, 1)), key(14, v3(1, 1, 1), "smooth"),
        key(T.telophase + 2, v3(1, 1, 1)), key(58, v3(1, 0.4, 1), "smooth")],
    });
  }
}

// Polar microtubules reach from each pole past the middle and overlap; they
// slide apart in anaphase B and are what the ring closes around.
const polarOffsets: [number, number][] = [[0.0, 0.0], [0.35, 0.15], [-0.35, -0.1], [0.12, -0.38], [-0.15, 0.36]];
for (const side of [-1, 1]) {
  polarOffsets.forEach(([oy, oz], i) => {
    add({
      id: `polar-${side < 0 ? "l" : "r"}-${i + 1}`,
      primitive: "cylinder",
      params: { radiusTop: 0.022, radiusBottom: 0.022, height: 1, radialSegments: 6 },
      color: COLORS.fibre,
      shading: "flat",
      outline: false,
      hover: "spindle",
      between: {
        from: side < 0 ? "centrosome-l" : "centrosome-r",
        to: side < 0 ? "centrosome-r" : "centrosome-l",
        toOffset: [0, oy * (side < 0 ? 1 : -1), oz],
      },
      scale: [key(0, v3(1, 0, 1)), key(20.5 + i * 0.3, v3(1, 0, 1)), key(25 + i * 0.3, v3(1, 0.58, 1), "easeOut"),
        key(56, v3(1, 0.58, 1)), key(61, v3(0, 0.58, 0), "easeIn")],
    });
  });
}

// Chromosomes. Each is a pair of sister chromatids; each chromatid is a
// group pivoting at its centromere with two arms that can bend.
interface Chromosome {
  id: string;
  name: string;
  color: string;
  arm: number;
  plate: Vec3;
  inNucleus: Vec3;
  tilt: number;
  capture: number;
  wiggle: number;
}
const CHROMOSOMES: Chromosome[] = [
  { id: "c1", name: "1", color: "#E07A5F", arm: 0.62, plate: [0, 1.25, 0.55], inNucleus: [-0.6, 0.55, 0.3], tilt: 35, capture: 22.5, wiggle: 0.07 },
  { id: "c2", name: "2", color: "#6FA58A", arm: 0.6, plate: [0, 0.4, -0.95], inNucleus: [0.5, 0.6, -0.25], tilt: -50, capture: 24, wiggle: -0.06 },
  { id: "c3", name: "3", color: "#9C6B98", arm: 0.44, plate: [0, -0.4, 0.95], inNucleus: [-0.5, -0.55, 0.15], tilt: 70, capture: 23.2, wiggle: 0.05 },
  { id: "c4", name: "4", color: "#E3A33C", arm: 0.44, plate: [0, -1.25, -0.5], inNucleus: [0.45, -0.6, 0.35], tilt: -20, capture: 25, wiggle: -0.08 },
];
const SISTER_GAP = 0.06;
const X_TILT = 24;

for (const c of CHROMOSOMES) {
  for (const side of [-1, 1]) {
    const id = `${c.id}${side < 0 ? "a" : "b"}`;
    const pole = side < 0 ? "centrosome-l" : "centrosome-r";
    const at = (base: Vec3, dx: number) => v3(base[0] + dx, base[1], base[2]);
    const pulled = v3(side * 1.95, c.plate[1] * 0.5, c.plate[2] * 0.5);
    // Loosely spread through the new nucleus, not stacked as on the plate.
    const spread = c.inNucleus.map((x) => x * 0.75);
    const settled = (t: number) => {
      const s = smoothWindow(t, T.anaphaseEnd, 60);
      return v3(
        side * (halfOffset(t) + 0.02) + lerp(0, spread[0], s),
        lerp(c.plate[1] * 0.5, spread[1], s),
        lerp(c.plate[2] * 0.5, spread[2], s),
      );
    };
    const arrive = c.capture + 4.5;
    add({
      id,
      primitive: "group",
      position: [
        key(0, at(c.inNucleus, side * 0.12)),
        key(T.condensed, at(c.inNucleus, side * SISTER_GAP), "smooth"),
        key(c.capture, at(c.inNucleus, side * SISTER_GAP)),
        key(arrive, at(c.plate, side * SISTER_GAP), "backOut"),
        key(34, at(c.plate, side * SISTER_GAP + c.wiggle)),
        key(38, at(c.plate, side * SISTER_GAP - c.wiggle), "smooth"),
        key(42, at(c.plate, side * SISTER_GAP + c.wiggle * 0.5), "smooth"),
        key(T.anaphase, at(c.plate, side * SISTER_GAP), "smooth"),
        key(T.anaphaseEnd, pulled, "easeInOut"),
        ...sampled(T.anaphaseEnd + 1, T.daughters, 1, settled),
      ],
      rotation: [
        key(0, v3(0, 0, c.tilt + side * 4)),
        key(T.condensed, v3(0, 0, c.tilt - side * X_TILT), "smooth"),
        key(c.capture, v3(0, 0, c.tilt - side * X_TILT)),
        key(arrive, v3(0, 0, -side * X_TILT), "smooth"),
        key(T.anaphase, v3(0, 0, -side * X_TILT)),
        key(T.anaphase + 1.5, v3(0, 0, 0), "smooth"),
        key(T.daughters, v3(0, 0, c.tilt * 1.5 + side * 20), "smooth"),
      ],
    });
    // Arms: loose and pale in interphase, short and bold once condensed,
    // trailing behind the centromere as it is reeled in, loose again in the
    // new nucleus.
    for (const arm of ["p", "q"] as const) {
      const up = arm === "p";
      const base = up ? 0 : 180;
      const trail = up ? side * 55 : -side * 55;
      const loose = up ? 40 * side : -48 * side;
      add({
        id: `${id}-${arm}`,
        parent: id,
        primitive: "capsule",
        params: { radius: 0.1, length: round(c.arm - 0.2), capSegments: 5, radialSegments: 12, bottom: 1 },
        color: [key(0, mixHex(c.color, PALE, 0.55)), key(T.prophase, mixHex(c.color, PALE, 0.55)), key(14, c.color, "smooth"),
          key(T.telophase + 2, c.color), key(60, mixHex(c.color, PALE, 0.5), "smooth")],
        outline: 0.022,
        hover: "chromosome",
        position: [0, up ? -0.05 : 0.05, 0],
        rotation: [
          key(0, v3(0, 0, base + loose)),
          key(T.prophase, v3(0, 0, base + loose)),
          key(T.condensed, v3(0, 0, base), "smooth"),
          key(T.anaphase, v3(0, 0, base)),
          key(T.anaphase + 2, v3(0, 0, base + trail), "easeOut"),
          key(T.telophase + 1, v3(0, 0, base + trail)),
          key(59, v3(0, 0, base + loose * 0.8), "smooth"),
        ],
        scale: [key(0, v3(0.4, 1.6, 0.4)), key(T.prophase, v3(0.4, 1.6, 0.4)), key(15, v3(1, 1, 1), "smooth"),
          key(T.telophase + 2, v3(1, 1, 1)), key(60, v3(0.45, 1.3, 0.45), "smooth")],
      });
    }
    add({
      id: `kfibre-${id}`,
      primitive: "cylinder",
      params: { radiusTop: 0.024, radiusBottom: 0.024, height: 1, radialSegments: 6 },
      color: COLORS.fibre,
      shading: "flat",
      outline: false,
      hover: "spindle",
      between: { from: pole, to: id },
      scale: [key(0, v3(1, 0, 1)), key(c.capture - 1.5, v3(1, 0, 1)), key(c.capture, v3(1, 1, 1), "easeOut"),
        key(T.anaphaseEnd, v3(1, 1, 1)), key(54, v3(0, 1, 0), "easeIn")],
    });
  }
}

// The two new nuclei gather around each set of chromosomes.
for (const side of [-1, 1]) {
  const id = side < 0 ? "daughter-nucleus-a" : "daughter-nucleus-b";
  add({
    id,
    primitive: "sphere",
    params: { radius: 1, widthSegments: 40, heightSegments: 28 },
    color: COLORS.nucleus,
    opacity: [key(0, 0), key(51, 0), key(56, 0.4, "smooth")],
    renderOrder: 1,
    outline: 0.02,
    hover: "envelope",
    position: sampled(51, T.end, 1, (t) => v3(side * (halfOffset(t) + 0.02), 0, 0)),
    scale: [key(0, 0.5), key(51, 0.5), key(57, 1.05, "backOut")],
  });
  add({
    id: `${id}-nucleolus`,
    parent: id,
    primitive: "sphere",
    params: { radius: 0.2 },
    color: COLORS.nucleolus,
    hover: "nucleolus",
    position: [side * 0.3, -0.35, -0.3],
    scale: [key(0, 0), key(57, 0), key(61, 1, "backOut")],
  });
}

const minutes = (m: number) => `${m} min`;

export const mitosisScene = {
  id: "mitosis",
  name: "Mitosis",
  minTime: T.start,
  maxTime: T.end,
  mapping: {
    kind: "linear",
    ticks: [
      { u: 0, label: "G2" },
      { u: T.prophase / T.end, label: "" },
      { u: T.prometaphase / T.end, label: "" },
      { u: T.metaphase / T.end, label: "30 min" },
      { u: T.anaphase / T.end, label: "" },
      { u: T.cytokinesis / T.end, label: "" },
      { u: 1, label: "Two cells" },
    ],
  },
  timeFormat: "minutes",
  secondsPerUnit: 60,
  labels: { start: "One cell", end: "Two cells" },
  baseDurationSeconds: 45,
  warpPresets: [0.25, 0.5, 1, 2, 4],
  events: [
    {
      id: "interphase",
      time: T.start,
      title: "Late interphase (G2)",
      when: `${minutes(T.start)} · getting ready`,
      description:
        "The cell has already copied all of its DNA. Each chromosome is now two identical sister chromatids, still loose and tangled inside the nucleus. The centrosome has copied itself too, so two sit side by side.",
      keyPoints: ["DNA was copied earlier, in S phase", "Two centrosomes wait beside the nucleus", "A human cell has 46 chromosomes; 4 are shown"],
      category: "interphase",
    },
    {
      id: "prophase",
      time: T.prophase,
      title: "Prophase",
      when: `${minutes(T.prophase)} · lasts about 15 minutes`,
      description:
        "The loose chromatin coils up into short, thick chromosomes. Each one now looks like an X: two sister chromatids joined at a pinch called the centromere. The two centrosomes slide around the nucleus toward opposite sides, growing microtubules as they go.",
      keyPoints: ["DNA ends up about 10,000 times shorter than its stretched length", "The nucleolus fades away", "Centrosomes head for opposite poles"],
      category: "mitosis",
    },
    {
      id: "prometaphase",
      time: T.prometaphase,
      title: "Prometaphase",
      when: `${minutes(T.prometaphase)} · the nucleus opens`,
      description:
        "The nuclear envelope breaks into small pieces, so the spindle can reach the chromosomes. Microtubules grow and shrink at random until they catch a kinetochore, a protein patch on each chromatid's centromere, and start hauling the chromosome toward the middle.",
      keyPoints: ["Nuclear envelope breaks down", "Kinetochores capture microtubules", "Each sister gets tied to a different pole"],
      category: "mitosis",
    },
    {
      id: "metaphase",
      time: T.metaphase,
      title: "Metaphase",
      when: `${minutes(T.metaphase)} · waiting for the all-clear`,
      description:
        "Every chromosome lines up on the cell's equator, the metaphase plate, with its two sisters attached to opposite poles. They jiggle back and forth under the tug of war. A safety system, the spindle assembly checkpoint, holds the cell here until every kinetochore is attached.",
      keyPoints: ["Chromosomes sit on the equator", "Sisters face opposite poles", "One unattached kinetochore is enough to hold everything up"],
      category: "mitosis",
    },
    {
      id: "anaphase",
      time: T.anaphase,
      title: "Anaphase",
      when: `${minutes(T.anaphase)} · over in about 5 minutes`,
      description:
        "An enzyme called separase cuts cohesin, the protein rings holding the sisters together. Each sister is now its own chromosome and is reeled in to its pole as its microtubules shorten. The poles also push apart, stretching the cell.",
      keyPoints: ["The shortest phase of mitosis", "Chromosomes move about 1 micrometre per minute", "Each side gets one copy of every chromosome"],
      category: "mitosis",
    },
    {
      id: "telophase",
      time: T.telophase,
      title: "Telophase",
      when: `${minutes(T.telophase)} · rebuilding`,
      description:
        "The chromosomes reach the poles and start to unwind. A new nuclear envelope forms around each set, and the spindle comes apart.",
      keyPoints: ["Two new nuclei form", "Nucleoli reappear", "Chromosomes loosen back into chromatin"],
      category: "mitosis",
    },
    {
      id: "cytokinesis",
      time: T.cytokinesis,
      title: "Cytokinesis",
      when: `${minutes(T.cytokinesis)} · overlaps telophase`,
      description:
        "A ring of actin and myosin just under the membrane tightens like a drawstring. It forms where the middle of the spindle was, and pinches the cell in two along a groove called the cleavage furrow.",
      keyPoints: ["The ring starts closing in late anaphase", "Myosin II is the same kind of motor that contracts muscle", "Organelles are shared between the halves"],
      category: "cytokinesis",
    },
    {
      id: "daughters",
      time: T.daughters,
      title: "Two daughter cells",
      when: `${minutes(T.daughters)} · about an hour since prophase began`,
      description:
        "Two cells, each with a full set of 46 chromosomes and its own centrosome. A thin bridge, the midbody, still joins them. It is cut later, often an hour or more after the furrow closes.",
      keyPoints: ["The daughters are genetically identical", "Mitosis took about an hour", "Each daughter enters G1 and starts to grow"],
      category: "interphase",
    },
  ],
  cameraPresets: [
    { id: "front", name: "Front", position: [0.4, 2.6, 13.5], target: [0.4, -0.7, 0] },
    { id: "three-quarter", name: "Three-quarter", position: [8.4, 5, 10.5], target: [0.4, -0.7, 0] },
    { id: "pole", name: "Down the spindle", position: [13.5, 3.2, 4.2], target: [0, -0.6, 0] },
  ],
  cameraDistanceScale: [key(0, 1), key(48, 1), key(T.daughters, 1.25, "smooth")],
  hover: {
    membrane: {
      name: "Cell membrane",
      category: "membrane",
      properties: { Thickness: "about 5 nm", "Cell size": "about 20 µm across" },
      descriptions: [
        { from: 0, text: "A thin, oily skin around the whole cell. Before dividing, the cell rounds up into a ball." },
        { from: 46, text: "The cell stretches as the spindle poles push apart." },
        { from: T.cytokinesis, text: "The membrane is being pulled in at the middle by the contractile ring, forming the cleavage furrow." },
        { from: T.daughters, text: "Two cells now, each with its own membrane, joined only by a thin bridge." },
      ],
    },
    envelope: {
      name: "Nuclear envelope",
      category: "nucleus",
      properties: { Layers: "2 membranes", Pores: "thousands" },
      descriptions: [
        { from: 0, text: "A double membrane around the nucleus, dotted with pores. The chromosomes are inside." },
        { from: T.prometaphase, text: "Breaking into small pieces, so the spindle microtubules can reach the chromosomes." },
        { from: T.telophase, text: "Reassembling from the pieces around each new set of chromosomes: two new nuclei." },
      ],
    },
    nucleolus: {
      name: "Nucleolus",
      category: "nucleus",
      properties: { Job: "builds ribosomes" },
      descriptions: [
        { from: 0, text: "A dense spot inside the nucleus where ribosomes are built. It disperses during prophase." },
        { from: T.telophase, text: "Reforming in each new nucleus as ribosome genes switch back on." },
      ],
    },
    chromosome: {
      name: "Chromosome",
      category: "DNA",
      properties: { "In a human cell": 46, "Shown here": 4, "Each chromatid": "one DNA molecule" },
      descriptions: [
        { from: 0, text: "Copied but still loose: two sister chromatids of long, tangled chromatin." },
        { from: T.prophase, text: "Coiling up tight. The two sisters stay glued together by cohesin, making an X." },
        { from: T.prometaphase, text: "A microtubule has caught this chromosome's kinetochore and is towing it to the middle." },
        { from: T.metaphase, text: "Lined up on the equator, one sister tied to each pole, waiting for the checkpoint to clear." },
        { from: T.anaphase, text: "The sisters have split. Each is now a chromosome of its own, pulled centromere first toward a pole." },
        { from: T.telophase, text: "Arrived. Unwinding back into chromatin inside a new nucleus." },
      ],
    },
    centrosome: {
      name: "Centrosome",
      category: "spindle",
      properties: { Contains: "2 centrioles at right angles", "Centriole length": "about 0.5 µm" },
      descriptions: [
        { from: 0, text: "The cell's main microtubule organiser. It was copied in S phase, so there are two." },
        { from: T.prophase, text: "Moving to one side of the nucleus to become a pole of the spindle." },
        { from: T.prometaphase, text: "A spindle pole. Microtubules grow out of it in every direction." },
        { from: T.daughters, text: "Each daughter cell inherits one centrosome." },
      ],
    },
    spindle: {
      name: "Spindle microtubules",
      category: "spindle",
      properties: { "Made of": "tubulin", Width: "25 nm" },
      descriptions: [
        { from: 0, text: "Hollow protein tubes that radiate from the centrosomes." },
        { from: T.prometaphase, text: "Growing and shrinking, searching for kinetochores. Some reach past the middle and overlap with tubes from the other pole." },
        { from: T.anaphase, text: "Kinetochore tubes shorten to reel chromosomes in; overlapping tubes slide apart to push the poles away." },
        { from: T.telophase, text: "Coming apart. A bundle in the middle stays to guide the furrow." },
      ],
    },
    ring: {
      name: "Contractile ring",
      category: "cytokinesis",
      properties: { "Made of": "actin and myosin II" },
      descriptions: [
        { from: 0, text: "A belt of actin filaments and myosin motors just under the membrane, tightening like a drawstring." },
        { from: T.daughters, text: "Closed down to the midbody, the last thin bridge between the two cells." },
      ],
    },
    mitochondrion: {
      name: "Mitochondrion",
      category: "organelle",
      properties: { Job: "makes ATP, the cell's energy currency" },
      descriptions: [{ from: 0, text: "Mitochondria are not divided by the spindle. They are shared roughly evenly as the cell splits." }],
    },
  },
  objects,
};

export const MITOSIS_SCENE_PATH = "src/experiences/mitosis/mitosis.scene.json";

if (import.meta.main) writeScene(MITOSIS_SCENE_PATH, mitosisScene);
