// src/experiences/universe/cosmicWeb.ts
//
// The cosmic web, generated once from a fixed seed in a unit ball centred on
// us (the observable universe is centred on its observer). Knots are galaxy
// clusters; filaments join each knot to its nearest neighbours. Every
// particle gets two positions: a near-uniform start and a home on the web.
// Starts are paired with homes by Morton order, so each particle only has
// to drift a short way, the way real matter clumps.

export type Vec3 = [number, number, number];

export interface Knot {
  position: Vec3;
  /** Relative mass; the biggest knot is the showcase galaxy cluster. */
  mass: number;
}

export interface Filament {
  from: number;
  to: number;
}

export interface WebParticles {
  count: number;
  /** Near-uniform start positions, xyz per particle. */
  start: Float32Array;
  /** Positions on the web. */
  home: Float32Array;
  /** 1 in a knot, 0.5 on a filament, 0 in a void. Dense regions collapse first. */
  density: Float32Array;
  seed: Float32Array;
  /** 1 for the few particles that light up as first stars. */
  star: Float32Array;
}

export interface WebGalaxies {
  count: number;
  position: Float32Array;
  size: Float32Array;
  angle: Float32Array;
  /** 0 to 1: when, within the galaxy era, this one appears. Knots go first. */
  birth: Float32Array;
  /** 0 spiral, 1 elliptical. Ellipticals crowd into clusters. */
  elliptical: Float32Array;
  tint: Float32Array;
}

export interface CosmicWeb {
  knots: Knot[];
  filaments: Filament[];
  /** Index of the biggest knot. */
  cluster: number;
  /** Knots where the showcase first stars ignite, spread across the ball. */
  firstStarKnots: number[];
  /** The filament the hover proxy sits on. */
  showcaseFilament: number;
  particles: WebParticles;
  galaxies: WebGalaxies;
}

/** Deterministic PRNG so the same web is generated every time. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KNOT_COUNT = 46;
const NEIGHBOURS = 3;
const BALL = 0.94;

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function spread(bits: number): number {
  let x = bits & 0x3ff;
  x = (x | (x << 16)) & 0x30000ff;
  x = (x | (x << 8)) & 0x300f00f;
  x = (x | (x << 4)) & 0x30c30c3;
  x = (x | (x << 2)) & 0x9249249;
  return x;
}

function morton(x: number, y: number, z: number): number {
  const q = (v: number) => Math.min(1023, Math.max(0, Math.floor(((v + 1) / 2) * 1024)));
  return spread(q(x)) | (spread(q(y)) << 1) | (spread(q(z)) << 2);
}

export function buildCosmicWeb(particleCount = 60000, galaxyCount = 650, seedValue = 13800): CosmicWeb {
  const rand = mulberry32(seedValue);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
  const inBall = (radius: number): Vec3 => {
    for (;;) {
      const p: Vec3 = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
      if (Math.hypot(...p) <= 1) return [p[0] * radius, p[1] * radius, p[2] * radius];
    }
  };
  const clampToBall = (p: Vec3): Vec3 => {
    const r = Math.hypot(...p);
    return r > BALL ? [(p[0] * BALL) / r, (p[1] * BALL) / r, (p[2] * BALL) / r] : p;
  };

  // A big cluster in clear view, our small Local Group near the centre, then
  // the rest scattered with a minimum spacing so the web has visible voids.
  const knots: Knot[] = [
    { position: [0.42, 0.16, 0.22], mass: 1.6 },
    { position: [0.05, -0.03, 0.02], mass: 0.35 },
    { position: [-0.4, -0.22, 0.3], mass: 1.0 },
  ];
  while (knots.length < KNOT_COUNT) {
    const p = inBall(0.88);
    if (knots.every((k) => dist(k.position, p) > 0.2)) knots.push({ position: p, mass: 0.3 + rand() * 0.8 });
  }

  const seen = new Set<string>();
  const filaments: Filament[] = [];
  knots.forEach((k, i) => {
    const nearest = knots
      .map((o, j) => ({ j, d: dist(k.position, o.position) }))
      .filter((o) => o.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, NEIGHBOURS);
    for (const { j, d } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (d < 0.62 && !seen.has(key)) {
        seen.add(key);
        filaments.push({ from: Math.min(i, j), to: Math.max(i, j) });
      }
    }
  });

  const massTotal = knots.reduce((n, k) => n + k.mass, 0);
  const pickKnot = (): number => {
    let r = rand() * massTotal;
    for (let i = 0; i < knots.length; i++) {
      r -= knots[i].mass;
      if (r <= 0) return i;
    }
    return knots.length - 1;
  };
  const onFilament = (f: Filament, thickness: number): Vec3 => {
    const a = knots[f.from].position;
    const b = knots[f.to].position;
    const s = rand();
    // Thicker in the middle, pinched where it meets a knot.
    const w = thickness * (0.5 + Math.sin(Math.PI * s));
    return [a[0] + (b[0] - a[0]) * s + gauss() * w, a[1] + (b[1] - a[1]) * s + gauss() * w, a[2] + (b[2] - a[2]) * s + gauss() * w];
  };
  const inKnot = (k: Knot, scale: number): Vec3 => {
    const r = scale * Math.sqrt(k.mass);
    return [k.position[0] + gauss() * r, k.position[1] + gauss() * r, k.position[2] + gauss() * r];
  };

  const homes: { p: Vec3; density: number }[] = [];
  for (let i = 0; i < particleCount; i++) {
    const roll = rand();
    if (roll < 0.26) homes.push({ p: clampToBall(inKnot(knots[pickKnot()], 0.045)), density: 1 });
    else if (roll < 0.88) homes.push({ p: clampToBall(onFilament(filaments[Math.floor(rand() * filaments.length)], 0.014)), density: 0.5 });
    else homes.push({ p: inBall(BALL), density: 0 });
  }
  const starts: Vec3[] = [];
  for (let i = 0; i < particleCount; i++) starts.push(inBall(BALL));

  const byMorton = (list: Vec3[]) =>
    list.map((p, i) => ({ i, m: morton(...p) })).sort((x, y) => x.m - y.m).map((e) => e.i);
  const homeOrder = byMorton(homes.map((h) => h.p));
  const startOrder = byMorton(starts);

  const particles: WebParticles = {
    count: particleCount,
    start: new Float32Array(particleCount * 3),
    home: new Float32Array(particleCount * 3),
    density: new Float32Array(particleCount),
    seed: new Float32Array(particleCount),
    star: new Float32Array(particleCount),
  };
  for (let n = 0; n < particleCount; n++) {
    const h = homes[homeOrder[n]];
    particles.home.set(h.p, n * 3);
    particles.start.set(starts[startOrder[n]], n * 3);
    particles.density[n] = h.density;
    particles.seed[n] = rand();
    particles.star[n] = h.density > 0 && rand() < 0.035 ? 1 : 0;
  }

  const galaxies: WebGalaxies = {
    count: galaxyCount,
    position: new Float32Array(galaxyCount * 3),
    size: new Float32Array(galaxyCount),
    angle: new Float32Array(galaxyCount),
    birth: new Float32Array(galaxyCount),
    elliptical: new Float32Array(galaxyCount),
    tint: new Float32Array(galaxyCount),
  };
  for (let g = 0; g < galaxyCount; g++) {
    const inCluster = rand() < 0.5;
    const knot = knots[pickKnot()];
    let p: Vec3;
    // Keep a clearing around us so the Milky Way stands out in the close-up.
    do {
      p = inCluster ? inKnot(knot, 0.05) : onFilament(filaments[Math.floor(rand() * filaments.length)], 0.012);
    } while (Math.hypot(...p) < 0.1);
    galaxies.position.set(clampToBall(p), g * 3);
    galaxies.size[g] = 0.6 + rand() * 0.8 + (inCluster ? 0.2 * knot.mass : 0);
    galaxies.angle[g] = rand() * Math.PI * 2;
    galaxies.birth[g] = inCluster ? rand() * 0.55 : 0.25 + rand() * 0.75;
    galaxies.elliptical[g] = rand() < (inCluster ? 0.25 + 0.3 * knot.mass : 0.12) ? 1 : 0;
    galaxies.tint[g] = rand();
  }

  const showcaseFilament = filaments
    .map((f, i) => ({ i, d: dist(knots[f.from].position, knots[f.to].position), touchesCluster: f.from === 0 || f.to === 0 }))
    .filter((f) => !f.touchesCluster)
    .sort((x, y) => y.d - x.d)[Math.floor(filaments.length / 6)].i;

  const firstStarKnots = Array.from({ length: 9 }, (_, i) => 2 + i * 4);

  return { knots, filaments, cluster: 0, firstStarKnots, showcaseFilament, particles, galaxies };
}
