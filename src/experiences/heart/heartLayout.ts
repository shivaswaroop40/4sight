// src/experiences/heart/heartLayout.ts
//
// Where everything sits in the resting heart, in heart units, drawn as if
// facing the person: the heart's right side is on the viewer's left, apex
// at the lower right. The front face of the cutaway is the plane z = FRONT_Z.
//
// One deformation field moves every point of the heart from its resting
// place to where it is at time t: the ventricles squeeze toward the septum
// while the AV plane pulls down toward the apex, and the atria squeeze
// during the atrial kick. The same field runs in TypeScript (blood parcels,
// valves, nodes) and in GLSL (walls, cavities, vessels, wiring); both are
// generated from the constants below so they cannot drift apart.

import { atrialFill, atrialSqueeze, ventricularSqueeze, type ChamberId, type ConductionId, type Side, type ValveId } from "./heartCycle";

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export const FRONT_Z = 0.55;
export const POOL_Z = FRONT_Z + 0.012;
export const FLOW_Z = FRONT_Z + 0.05;
export const WIRE_Z = FRONT_Z + 0.07;
export const VALVE_Z = FRONT_Z + 0.09;
export const LABEL_Z = FRONT_Z + 0.16;

/** The AV plane (valve ring between atria and ventricles) at rest. */
export const AV_Y = 0.2;
const APEX_Y = -2.9;
/** Above this height the base descent has faded out, so vessel ends stay put. */
const TOP_Y = 3.6;
/** Septum line: x at the AV plane and drift toward the apex per unit down. */
const SEPT_X0 = 0.05;
const SEPT_SLOPE = 0.24;
const RA_X = -1.3;
const LA_X = 1.45;
const ATRIA_Y = 0.85;

const BASE_DESCENT = 0.3;
const VENT_K = 0.12;
const VENT_DEPTH_K = 0.1;
const ATRIAL_K = 0.11;

/** Extra shrink of a cavity over its wall, so the wall visibly thickens as it squeezes. */
const VENT_POOL_SHRINK = 0.2;
const ATRIAL_POOL_SHRINK = 0.16;

export interface DeformParams {
  baseShift: number;
  ventSqueeze: number;
  atrialSqueeze: number;
}

export function deformParams(t: number): DeformParams {
  const v = ventricularSqueeze(t);
  return { baseShift: BASE_DESCENT * v, ventSqueeze: v, atrialSqueeze: atrialSqueeze(t) };
}

function smoothstep(e0: number, e1: number, x: number): number {
  const s = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return s * s * (3 - 2 * s);
}

/** Moves a resting point to its place at the given squeeze. Mirrors heartDeform in DEFORM_GLSL. */
export function deform(x: number, y: number, z: number, p: DeformParams): [number, number, number] {
  const wv = 1 - smoothstep(AV_Y - 0.25, AV_Y + 0.25, y);
  const xs = SEPT_X0 + (AV_Y - y) * SEPT_SLOPE;
  const dxV = -(x - xs) * VENT_K * p.ventSqueeze;
  const dzV = -z * VENT_DEPTH_K * p.ventSqueeze;
  const wa = (1 - wv) * (1 - smoothstep(1.9, 2.6, y));
  const gr = Math.exp(-((x - RA_X) ** 2));
  const gl = Math.exp(-((x - LA_X) ** 2));
  const dxA = -ATRIAL_K * p.atrialSqueeze * ((x - RA_X) * gr + (x - LA_X) * gl);
  const dyA = -ATRIAL_K * p.atrialSqueeze * (y - ATRIA_Y) * (gr + gl);
  const ny =
    y < AV_Y
      ? APEX_Y + (y - APEX_Y) * (1 - p.baseShift / (AV_Y - APEX_Y))
      : y - p.baseShift * Math.min(1, Math.max(0, (TOP_Y - y) / (TOP_Y - AV_Y)));
  return [x + wv * dxV + wa * dxA, ny + wa * dyA, z + wv * dzV];
}

/** A GLSL float literal ("1.0", not "1"). */
function f(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

export const DEFORM_GLSL = /* glsl */ `
uniform float uBaseShift;
uniform float uVentSqueeze;
uniform float uAtrialSqueeze;
vec3 heartDeform(vec3 p) {
  float wv = 1.0 - smoothstep(${f(AV_Y - 0.25)}, ${f(AV_Y + 0.25)}, p.y);
  float xs = ${f(SEPT_X0)} + (${f(AV_Y)} - p.y) * ${f(SEPT_SLOPE)};
  float dxV = -(p.x - xs) * ${f(VENT_K)} * uVentSqueeze;
  float dzV = -p.z * ${f(VENT_DEPTH_K)} * uVentSqueeze;
  float wa = (1.0 - wv) * (1.0 - smoothstep(1.9, 2.6, p.y));
  float rx = p.x - (${f(RA_X)});
  float lx = p.x - (${f(LA_X)});
  float gr = exp(-rx * rx);
  float gl = exp(-lx * lx);
  float dxA = -${f(ATRIAL_K)} * uAtrialSqueeze * (rx * gr + lx * gl);
  float dyA = -${f(ATRIAL_K)} * uAtrialSqueeze * (p.y - ${f(ATRIA_Y)}) * (gr + gl);
  float ny = p.y < ${f(AV_Y)}
    ? ${f(APEX_Y)} + (p.y - (${f(APEX_Y)})) * (1.0 - uBaseShift / ${f(AV_Y - APEX_Y)})
    : p.y - uBaseShift * clamp((${f(TOP_Y)} - p.y) / ${f(TOP_Y - AV_Y)}, 0.0, 1.0);
  return vec3(p.x + wv * dxV + wa * dxA, ny + wa * dyA, p.z + wv * dzV);
}
`;

// ---------------------------------------------------------------------------
// Cavities ("pools"): the blood-filled inside of each chamber, seen through the cut.

export type PoolBand = "ventricle" | "atrium";

export interface PoolDef {
  outline: Vec2[];
  /** Where the chamber's name sits, and the name itself. */
  label: { at: Vec2; text: string };
  /** Point the cavity shrinks toward, on top of the wall's own squeeze. */
  center: Vec2;
  band: PoolBand;
  side: Side;
}

/** Cavity shrink amount at t: ventricles follow their volume, atria their fill. */
export function poolShrink(band: PoolBand, t: number): number {
  return band === "ventricle" ? VENT_POOL_SHRINK * ventricularSqueeze(t) : ATRIAL_POOL_SHRINK * (1 - atrialFill(t));
}

/**
 * Weight of the extra cavity shrink at height y. Ventricles shrink below the
 * valve ring (their outflow channels stay plugged into the arteries); atria
 * shrink above it (their floor stays on the valve).
 */
export function poolWeight(band: PoolBand, y: number): number {
  return band === "ventricle" ? 1 - smoothstep(AV_Y - 0.35, AV_Y + 0.05, y) : smoothstep(AV_Y + 0.05, AV_Y + 0.5, y);
}

export const POOL_GLSL = /* glsl */ `
uniform vec2 uPoolCenter;
uniform float uPoolShrink;
uniform float uPoolVentricle;
vec3 poolShrink(vec3 p) {
  float wv = 1.0 - smoothstep(${f(AV_Y - 0.35)}, ${f(AV_Y + 0.05)}, p.y);
  float wa = smoothstep(${f(AV_Y + 0.05)}, ${f(AV_Y + 0.5)}, p.y);
  float w = mix(wa, wv, uPoolVentricle);
  p.xy = uPoolCenter + (p.xy - uPoolCenter) * (1.0 - uPoolShrink * w);
  return p;
}
`;

export function shrinkPoint(x: number, y: number, pool: PoolDef, amount: number): [number, number] {
  const k = 1 - amount * poolWeight(pool.band, y);
  return [pool.center[0] + (x - pool.center[0]) * k, pool.center[1] + (y - pool.center[1]) * k];
}

export const BODY_OUTLINE: Vec2[] = [
  [-1.0, 1.8], [-0.3, 1.86], [0.35, 1.86], [1.0, 1.76], [1.7, 1.52], [2.25, 0.95], [2.38, 0.1],
  [2.28, -0.8], [1.88, -1.78], [1.25, -2.55], [0.78, -2.9], [0.35, -2.75], [-0.5, -2.2],
  [-1.4, -1.45], [-2.02, -0.55], [-2.26, 0.25], [-2.22, 1.0], [-1.78, 1.62],
];

export const POOLS: Record<ChamberId, PoolDef> = {
  rightAtrium: {
    side: "right",
    band: "atrium",
    center: [-1.3, 0.8],
    label: { at: [-1.33, 1.08], text: "right\natrium" },
    outline: [
      [-1.95, 0.45], [-2.0, 0.95], [-1.75, 1.36], [-1.3, 1.5], [-0.88, 1.36], [-0.68, 0.95],
      [-0.7, 0.5], [-0.82, 0.24], [-1.2, 0.2], [-1.6, 0.25],
    ],
  },
  rightVentricle: {
    side: "right",
    band: "ventricle",
    center: [-0.75, -0.9],
    label: { at: [-0.95, -0.82], text: "right\nventricle" },
    outline: [
      [-1.62, 0.18], [-1.86, -0.45], [-1.5, -1.22], [-0.85, -1.78], [-0.1, -2.12], [0.3, -2.1],
      [0.22, -1.3], [0.02, -0.45], [-0.1, 0.2], [-0.1, 0.95], [-0.12, 1.72], [-0.48, 1.72],
      [-0.5, 0.95], [-0.58, 0.32], [-0.85, 0.13], [-1.25, 0.1],
    ],
  },
  leftAtrium: {
    side: "left",
    band: "atrium",
    center: [1.45, 0.75],
    label: { at: [1.45, 0.78], text: "left\natrium" },
    outline: [
      [1.02, 0.24], [0.86, 0.65], [0.95, 1.1], [1.35, 1.3], [1.8, 1.2], [2.02, 0.8], [1.92, 0.4],
      [1.72, 0.24], [1.37, 0.2],
    ],
  },
  leftVentricle: {
    side: "left",
    band: "ventricle",
    center: [1.15, -0.95],
    label: { at: [1.22, -0.95], text: "left\nventricle" },
    outline: [
      [1.76, 0.17], [2.02, -0.5], [1.87, -1.42], [1.36, -2.22], [0.82, -2.56], [0.55, -2.3],
      [0.6, -1.5], [0.38, -0.45], [0.16, 0.18], [0.16, 0.95], [0.15, 1.72], [0.56, 1.72],
      [0.58, 0.95], [0.72, 0.3], [1.0, 0.12], [1.37, 0.1],
    ],
  },
};

// ---------------------------------------------------------------------------
// Valves: two leaflets hinged on either side of an opening.

export interface ValveDef {
  left: Vec2;
  right: Vec2;
}

export const VALVES: Record<ValveId, ValveDef> = {
  tricuspid: { left: [-1.58, AV_Y], right: [-0.84, AV_Y] },
  mitral: { left: [1.0, AV_Y], right: [1.74, AV_Y] },
  pulmonary: { left: [-0.5, 1.3], right: [-0.1, 1.3] },
  aortic: { left: [0.15, 1.18], right: [0.58, 1.18] },
};

/**
 * The open mouth of each AV valve. Atrium and ventricle cavities are drawn
 * separately, so a patch of blood bridges the wall band between them.
 */
export const ORIFICES: { pool: ChamberId; valve: ValveId }[] = [
  { pool: "rightVentricle", valve: "tricuspid" },
  { pool: "leftVentricle", valve: "mitral" },
];

// ---------------------------------------------------------------------------
// Vessels

export type VesselId = "venaCava" | "aorta" | "pulmonaryArtery" | "pulmonaryVeins";

export interface TubeDef {
  vessel: VesselId;
  points: Vec3[];
  radius: number;
  oxygenated: boolean;
  /** Draw a cut-open end cap at the last point. */
  capEnd: boolean;
  /** Draw a cut-open end cap at the first point. */
  capStart: boolean;
}

const SVC: Vec3[] = [[-1.3, 3.55, -0.1], [-1.3, 2.5, 0.0], [-1.3, 1.5, 0.1]];
const IVC: Vec3[] = [[-1.75, -2.75, -0.45], [-1.78, -2.0, -0.5], [-1.68, -0.6, -0.45], [-1.55, 0.45, -0.3]];
const AORTA: Vec3[] = [
  [0.36, 1.35, -0.05], [0.36, 2.3, -0.1], [0.46, 3.05, -0.15], [0.95, 3.48, -0.3], [1.55, 3.42, -0.5],
  [1.95, 2.9, -0.7], [2.05, 2.0, -0.85], [2.0, 0.5, -0.95], [1.9, -1.4, -0.95],
];
const PA_TRUNK: Vec3[] = [[-0.3, 1.45, 0.2], [-0.3, 1.95, 0.35], [0.12, 2.38, 0.62], [0.72, 2.52, 0.45]];
const PA_TO_LEFT_LUNG: Vec3[] = [[0.72, 2.52, 0.45], [1.5, 2.58, 0.2], [2.4, 2.52, -0.05], [3.0, 2.46, -0.1]];
const PA_TO_RIGHT_LUNG: Vec3[] = [[0.72, 2.52, 0.45], [0.9, 2.62, -0.25], [0.35, 2.6, -0.9], [-0.6, 2.52, -0.85], [-1.6, 2.5, -0.8], [-2.6, 2.46, -0.7]];
const PV_UPPER: Vec3[] = [[3.15, 1.3, -0.1], [2.55, 1.18, 0.0], [1.95, 1.0, 0.1]];
const PV_LOWER: Vec3[] = [[3.15, 0.42, -0.1], [2.55, 0.48, 0.0], [1.95, 0.62, 0.1]];

export const TUBES: TubeDef[] = [
  { vessel: "venaCava", points: SVC, radius: 0.27, oxygenated: false, capStart: true, capEnd: false },
  { vessel: "venaCava", points: IVC, radius: 0.29, oxygenated: false, capStart: true, capEnd: false },
  { vessel: "aorta", points: AORTA, radius: 0.31, oxygenated: true, capStart: false, capEnd: true },
  { vessel: "aorta", points: [[0.78, 3.38, -0.25], [0.7, 4.05, -0.25]], radius: 0.12, oxygenated: true, capStart: false, capEnd: true },
  { vessel: "aorta", points: [[1.18, 3.5, -0.38], [1.2, 4.12, -0.4]], radius: 0.12, oxygenated: true, capStart: false, capEnd: true },
  { vessel: "aorta", points: [[1.52, 3.42, -0.48], [1.68, 4.0, -0.5]], radius: 0.11, oxygenated: true, capStart: false, capEnd: true },
  { vessel: "pulmonaryArtery", points: PA_TRUNK, radius: 0.28, oxygenated: false, capStart: false, capEnd: false },
  { vessel: "pulmonaryArtery", points: PA_TO_LEFT_LUNG, radius: 0.2, oxygenated: false, capStart: false, capEnd: true },
  { vessel: "pulmonaryArtery", points: PA_TO_RIGHT_LUNG, radius: 0.2, oxygenated: false, capStart: false, capEnd: true },
  { vessel: "pulmonaryVeins", points: PV_UPPER, radius: 0.15, oxygenated: true, capStart: true, capEnd: false },
  { vessel: "pulmonaryVeins", points: PV_LOWER, radius: 0.15, oxygenated: true, capStart: true, capEnd: false },
];

// ---------------------------------------------------------------------------
// Blood flow paths. Each side runs vein -> atrium -> ventricle -> artery.
// A region may offer variants (two veins, two lung branches); a parcel keeps
// one variant index for its whole trip.

export interface FlowPath {
  points: Vec3[];
  /** Half-width of the stream at each point, as a lateral spread. */
  width: number[];
}

export interface FlowRegion {
  variants: FlowPath[];
  /** Cavity this region lies in, for the extra cavity shrink. */
  pool?: ChamberId;
}

function onFront(points: Vec2[], width: number[]): FlowPath {
  return { points: points.map(([x, y]) => [x, y, FLOW_Z] as const), width };
}

function onTube(points: Vec3[], radius: number): FlowPath {
  return { points: points.map(([x, y, z]) => [x, y, z + radius + 0.02] as const), width: points.map(() => radius * 0.45) };
}

/** Regions per side, upstream to downstream. Region k spans boundaries k and k+1. */
export const FLOW_REGIONS: Record<Side, [FlowRegion, FlowRegion, FlowRegion, FlowRegion]> = {
  right: [
    { variants: [onTube(SVC, 0.27), onTube(IVC, 0.29)] },
    {
      pool: "rightAtrium",
      variants: [
        onFront([[-1.25, 1.42], [-0.98, 1.05], [-0.98, 0.62], [-1.12, 0.28]], [0.08, 0.15, 0.15, 0.13]),
        onFront([[-1.9, 0.45], [-1.82, 0.88], [-1.52, 1.0], [-1.4, 0.62], [-1.25, 0.28]], [0.06, 0.12, 0.14, 0.14, 0.13]),
      ],
    },
    {
      pool: "rightVentricle",
      variants: [
        onFront(
          [[-1.2, 0.14], [-1.55, -0.42], [-1.22, -1.15], [-0.55, -1.72], [0.08, -1.85], [0.02, -1.05], [-0.2, -0.25], [-0.3, 0.55], [-0.3, 1.3]],
          [0.22, 0.26, 0.3, 0.26, 0.1, 0.12, 0.1, 0.09, 0.07],
        ),
      ],
    },
    { variants: [onTube([...PA_TRUNK, ...PA_TO_LEFT_LUNG.slice(1)], 0.28), onTube([...PA_TRUNK, ...PA_TO_RIGHT_LUNG.slice(1)], 0.28)] },
  ],
  left: [
    { variants: [onTube(PV_UPPER, 0.15), onTube(PV_LOWER, 0.15)] },
    {
      pool: "leftAtrium",
      variants: [
        onFront([[1.95, 1.0], [1.55, 0.95], [1.3, 0.6], [1.37, 0.26]], [0.08, 0.18, 0.18, 0.15]),
        onFront([[1.95, 0.62], [1.6, 0.5], [1.38, 0.26]], [0.06, 0.1, 0.12]),
      ],
    },
    {
      pool: "leftVentricle",
      variants: [
        onFront(
          [[1.37, 0.13], [1.72, -0.5], [1.58, -1.4], [1.05, -2.15], [0.8, -2.3], [0.8, -1.5], [0.55, -0.6], [0.36, 0.3], [0.36, 1.2]],
          [0.22, 0.26, 0.3, 0.2, 0.08, 0.12, 0.12, 0.1, 0.07],
        ),
      ],
    },
    { variants: [onTube(AORTA, 0.31)] },
  ],
};

// ---------------------------------------------------------------------------
// Electrical wiring

export const SA_NODE: Vec2 = [-1.72, 1.56];
export const AV_NODE: Vec2 = [-0.6, 0.12];

/** Polylines per conduction segment. Branches and Purkinje fibres fan out in two. */
export const WIRES: Record<ConductionId, Vec2[][]> = {
  internodal: [[SA_NODE, [-2.08, 1.05], [-2.06, 0.45], [-1.7, 0.08], [-1.1, 0.06], AV_NODE]],
  his: [[AV_NODE, [-0.35, 0.02], [0.02, -0.18]]],
  bundleBranches: [
    [[0.02, -0.18], [0.27, -0.95], [0.55, -1.85], [0.68, -2.42]],
    [[0.02, -0.18], [0.12, -0.95], [0.4, -1.85], [0.5, -2.36]],
  ],
  purkinje: [
    [[0.68, -2.42], [1.25, -2.38], [1.9, -1.72], [2.14, -0.8], [2.15, -0.05]],
    [[0.5, -2.36], [-0.3, -2.12], [-1.3, -1.45], [-1.95, -0.6], [-2.08, -0.05]],
  ],
};

/** Where each depolarization wave starts spreading across the muscle. */
export const ATRIAL_WAVE_ORIGIN = SA_NODE;
export const VENTRICULAR_WAVE_ORIGIN: Vec2 = [0.45, -1.6];

/** Label anchors for the comic "lub" and "dub" bursts. */
export const LUB_ANCHOR: Vec3 = [-2.45, -0.4, FRONT_Z + 0.4];
export const DUB_ANCHOR: Vec3 = [-1.0, 2.6, FRONT_Z + 0.6];
