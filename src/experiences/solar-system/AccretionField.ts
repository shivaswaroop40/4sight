// src/experiences/solar-system/AccretionField.ts
//
// One THREE.Points cloud for the whole nebula. Every particle belongs to
// something: the Sun, a planet, a moon, the gas the solar wind blows away,
// or a debris belt. The vertex shader places each particle as a pure
// function of the uniforms, which setTime fills from solarStateAt(p):
//
//   cloud  -> flattened, spinning disk          (f, per-particle stagger)
//   disk   -> feeding ring converging in angle  (uClump 0 to 0.7)
//   ring   -> hot ball around the body centre   (uClump 0.5 to 1)
//   ball   -> faded out, the solid mesh takes over (uFade)
//
// Moon particles ride inside their parent's ball, then fly out into a
// small ring around the parent and gather into the moon.

import * as THREE from "three";
import { BODIES } from "./solarData";
import { BODY_INDEX, moonOmega, type SolarState } from "./SolarSystemState";

const NB = BODIES.length;

const KIND_STAR = 0;
const KIND_PLANET = 1;
const KIND_MOON = 2;
const KIND_GAS = 3;
const KIND_BELT = 4;

const GAS_PARTICLES = 22000;
const ASTEROID_PARTICLES = 3500;
const KUIPER_PARTICLES = 3000;

const vertexShader = /* glsl */ `
#define NB ${NB}
uniform float uTau;
uniform float uP;
uniform float uContract;
uniform float uCloudSpin;
uniform float uClear;
uniform float uPointScale;
uniform float uAngle[NB];
uniform float uRadius[NB];
uniform float uClump[NB];
uniform float uSize[NB];
uniform float uParent[NB];
uniform float uFade[NB];
uniform float uDir[NB];

attribute vec3 aDir;
attribute float aRadius;
attribute float aPhase;
attribute float aHeight;
attribute float aKind;
attribute float aBody;
attribute float aSeed;
attribute float aHue;
attribute float aLocal;

varying vec3 vColor;
varying float vAlpha;

const float TWO_PI = 6.28318530718;

float wrapPi(float a) { return a - TWO_PI * floor((a + 3.14159265) / TWO_PI); }
vec2 rot2(vec2 v, float a) { float c = cos(a); float s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float omega(float r) { return 1.0 / pow(max(r, 0.3), 1.5); }

vec3 ballAround(vec3 center, float size, float c) {
  return center + aDir * size * (0.25 + 0.75 * aSeed) * mix(2.6, 0.95, smoothstep(0.6, 1.0, c));
}

// A particle feeding planet b. It orbits at its own radius, converges in
// angle and radius onto the planet, then packs into a ball.
vec3 feedPos(int b, float theta, float h) {
  float c = uClump[b];
  float c1 = smoothstep(0.0, 0.7, c);
  float phi = uAngle[b];
  float R = uRadius[b];
  float a = theta + wrapPi(phi - theta) * c1;
  float r = mix(aRadius, R, c1);
  vec3 ring = vec3(r * cos(a), h * (1.0 - c1), r * sin(a));
  vec3 center = vec3(R * cos(phi), 0.0, R * sin(phi));
  return mix(ring, ballAround(center, uSize[b], c), smoothstep(0.5, 0.9, c));
}

void main() {
  int kind = int(aKind + 0.5);
  int b = int(aBody + 0.5);

  // The nebula: contracts and spins up, faster near the axis.
  vec3 cp = position * mix(1.0, 0.5, uContract);
  cp.xz = rot2(cp.xz, uCloudSpin * (1.0 + 3.0 / (1.0 + 0.25 * length(position.xz))));

  // The disk: Keplerian orbit at this particle's radius, thinning over time.
  float theta = aPhase + omega(aRadius) * uTau;
  float h = aHeight * mix(1.0, 0.35, smoothstep(0.25, 0.8, uP));
  vec3 dp = vec3(aRadius * cos(theta), h, aRadius * sin(theta));

  // Cloud to disk, staggered per particle so the collapse looks organic.
  float f = smoothstep(aSeed * 0.08, 0.16 + aSeed * 0.1, uP);

  vec3 nebula = mix(vec3(0.62, 0.28, 0.78), vec3(0.28, 0.42, 0.95), aHue);
  nebula = mix(nebula, vec3(0.95, 0.45, 0.55), smoothstep(0.8, 1.0, aHue));
  vec3 diskCol = mix(vec3(1.0, 0.72, 0.42), vec3(0.45, 0.52, 0.85), smoothstep(1.5, 12.0, aRadius));
  vec3 col = mix(nebula, diskCol, f);
  vec3 hot = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.85, 0.55), aSeed);

  float alpha = mix(0.22, 0.4, f);
  float size = mix(2.4, 1.0, f);
  vec3 pos = mix(cp, dp, f);
  float heat = 0.0;

  if (kind == ${KIND_STAR}) {
    float c = uClump[b];
    pos = mix(pos, ballAround(vec3(0.0), uSize[b], c), smoothstep(0.0, 1.0, c));
    heat = c;
    alpha *= 1.0 - 0.85 * uFade[b];
    size *= 1.3;
  } else if (kind == ${KIND_PLANET}) {
    pos = mix(cp, feedPos(b, theta, h), f);
    heat = smoothstep(0.3, 0.9, uClump[b]);
    alpha *= 1.0 - uFade[b];
  } else if (kind == ${KIND_MOON}) {
    int pb = int(uParent[b] + 0.5);
    vec3 inParent = feedPos(pb, theta, h);
    float R = uRadius[pb];
    vec3 center = vec3(R * cos(uAngle[pb]), 0.0, R * sin(uAngle[pb]));

    float mc = uClump[b];
    float emerge = smoothstep(0.0, 0.2, mc);
    float mc1 = smoothstep(0.0, 0.7, mc);
    float mr = uRadius[b];
    float lr = mix(mr * (0.45 + 1.1 * aLocal), mr, mc1);
    float lt = aPhase + uDir[b] * ${moonOmega(1).toFixed(4)} / pow(max(lr, 0.05), 1.5) * uTau;
    float la = lt + wrapPi(uAngle[b] - lt) * mc1;
    vec3 ring = center + vec3(lr * cos(la), aHeight * 0.08 * (1.0 - mc1), lr * sin(la));
    vec3 mcenter = center + vec3(mr * cos(uAngle[b]), 0.0, mr * sin(uAngle[b]));
    vec3 mp = mix(ring, ballAround(mcenter, uSize[b], mc), smoothstep(0.5, 0.9, mc));

    pos = mix(cp, mix(inParent, mp, emerge), f);
    heat = mix(smoothstep(0.3, 0.9, uClump[pb]), smoothstep(0.3, 0.9, mc), emerge);
    // Hidden inside the parent once it solidifies, visible again as debris flies out.
    alpha *= mix(1.0 - uFade[pb], 1.0, emerge) * (1.0 - uFade[b]);
  } else if (kind == ${KIND_GAS}) {
    // Blown outward and dissipated by the solar wind after ignition.
    float r = aRadius * (1.0 + 2.5 * uClear);
    vec3 blown = vec3(r * cos(theta), h * (1.0 + 2.0 * uClear), r * sin(theta));
    pos = mix(cp, blown, f);
    alpha *= 1.0 - uClear;
  } else {
    // Asteroid and Kuiper belts: the leftovers that never became planets.
    col = mix(col, vec3(0.62, 0.58, 0.54), f);
    alpha *= mix(1.0, 0.75, f);
    size *= mix(1.0, 0.7, f);
  }

  col = mix(col, hot, heat);
  alpha *= 1.0 + 0.8 * heat;

  vColor = col;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uPointScale / -mv.z, 1.0, 48.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * a * vAlpha);
}
`;

/** Deterministic PRNG so the same nebula is generated every time. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class AccretionField {
  readonly points: THREE.Points;
  readonly uniforms: Record<string, THREE.IUniform>;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;

  constructor(pixelRatio: number) {
    const rand = mulberry32(4600);
    const gauss = () => {
      const u = Math.max(rand(), 1e-9);
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    };
    const unitVec = (): [number, number, number] => {
      const z = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      return [r * Math.cos(a), z, r * Math.sin(a)];
    };

    // A lumpy, filamentary molecular cloud: a broad haze plus dense knots.
    const knots: [number, number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const [x, y, z] = unitVec();
      const r = 4 + rand() * 9;
      knots.push([x * r, y * r * 0.7, z * r]);
    }
    const cloudPoint = (): [number, number, number] => {
      let x: number, y: number, z: number;
      if (rand() < 0.55) {
        const [ux, uy, uz] = unitVec();
        const r = 17 * Math.cbrt(rand());
        [x, y, z] = [ux * r, uy * r * 0.8, uz * r];
      } else {
        const k = knots[Math.floor(rand() * knots.length)];
        [x, y, z] = [k[0] + gauss() * 2.5, k[1] + gauss() * 2.5, k[2] + gauss() * 2.5];
      }
      return [x + 1.2 * Math.sin(y * 0.4 + z * 0.2), y, z + 1.2 * Math.cos(x * 0.3)];
    };

    const specs: { kind: number; body: number; radius: () => number; count: number; thick: number }[] = [];
    for (const [i, def] of BODIES.entries()) {
      if (def.kind === "star") {
        specs.push({ kind: KIND_STAR, body: i, count: def.particles, thick: 0.2, radius: () => 0.15 + rand() * 1.5 });
      } else if (def.kind === "planet") {
        const feed = def.feed ?? 0.3;
        specs.push({
          kind: KIND_PLANET,
          body: i,
          count: def.particles,
          thick: 0.25,
          radius: () => def.orbit + (rand() * 2 - 1) * feed,
        });
      } else {
        const parent = BODIES[BODY_INDEX.get(def.parent!)!];
        const feed = (parent.feed ?? 0.3) * 0.6;
        specs.push({
          kind: KIND_MOON,
          body: i,
          count: def.particles,
          thick: 0.25,
          radius: () => parent.orbit + (rand() * 2 - 1) * feed,
        });
      }
    }
    specs.push({ kind: KIND_GAS, body: 0, count: GAS_PARTICLES, thick: 0.45, radius: () => 1 + 15 * Math.pow(rand(), 0.8) });
    specs.push({ kind: KIND_BELT, body: 0, count: ASTEROID_PARTICLES, thick: 0.12, radius: () => 5.2 + rand() * 0.9 });
    specs.push({ kind: KIND_BELT, body: 0, count: KUIPER_PARTICLES, thick: 0.35, radius: () => 14 + rand() * 2.5 });

    const total = specs.reduce((n, s) => n + s.count, 0);
    const position = new Float32Array(total * 3);
    const dir = new Float32Array(total * 3);
    const radius = new Float32Array(total);
    const phase = new Float32Array(total);
    const height = new Float32Array(total);
    const kind = new Float32Array(total);
    const body = new Float32Array(total);
    const seed = new Float32Array(total);
    const hue = new Float32Array(total);
    const local = new Float32Array(total);

    let n = 0;
    for (const spec of specs) {
      for (let j = 0; j < spec.count; j++, n++) {
        const c = cloudPoint();
        position.set(c, n * 3);
        dir.set(unitVec(), n * 3);
        const r = spec.radius();
        radius[n] = r;
        phase[n] = rand() * Math.PI * 2;
        // Flared disk: thicker further out.
        height[n] = gauss() * spec.thick * (0.3 + r / 8);
        kind[n] = spec.kind;
        body[n] = spec.body;
        seed[n] = rand();
        hue[n] = rand();
        local[n] = rand();
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    this.geometry.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    this.geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    this.geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    this.geometry.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
    this.geometry.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    this.geometry.setAttribute("aBody", new THREE.BufferAttribute(body, 1));
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    this.geometry.setAttribute("aHue", new THREE.BufferAttribute(hue, 1));
    this.geometry.setAttribute("aLocal", new THREE.BufferAttribute(local, 1));

    const parent = new Float32Array(NB);
    const bodyRadius = new Float32Array(NB);
    const bodySize = new Float32Array(NB);
    const bodyDir = new Float32Array(NB);
    for (const [i, def] of BODIES.entries()) {
      parent[i] = def.parent ? BODY_INDEX.get(def.parent)! : 0;
      bodyRadius[i] = def.orbit;
      bodySize[i] = def.size;
      bodyDir[i] = def.retrograde ? -1 : 1;
    }

    this.uniforms = {
      uTau: { value: 0 },
      uP: { value: 0 },
      uContract: { value: 0 },
      uCloudSpin: { value: 0 },
      uClear: { value: 0 },
      uPointScale: { value: 70 * pixelRatio },
      uAngle: { value: new Float32Array(NB) },
      uRadius: { value: bodyRadius },
      uClump: { value: new Float32Array(NB) },
      uSize: { value: bodySize },
      uParent: { value: parent },
      uFade: { value: new Float32Array(NB) },
      uDir: { value: bodyDir },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    // The shader moves every particle, so the CPU bounding sphere is meaningless.
    this.points.frustumCulled = false;
  }

  update(state: SolarState): void {
    const u = this.uniforms;
    u.uTau.value = state.tau;
    u.uP.value = state.p;
    u.uContract.value = state.contract;
    u.uCloudSpin.value = state.tau * 0.012;
    u.uClear.value = state.clear;
    const angle = u.uAngle.value as Float32Array;
    const clump = u.uClump.value as Float32Array;
    const fade = u.uFade.value as Float32Array;
    for (const [i, b] of state.bodies.entries()) {
      angle[i] = b.angle;
      clump[i] = b.clump;
      fade[i] = b.particleFade;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
