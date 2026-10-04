// src/experiences/universe/UniverseField.ts
//
// The GPU side of the universe. Three shader-driven objects, each placed as a
// pure function of uniforms that setTime fills from universeStateAt(t):
//
//   matter    60,000 points drifting from a near-uniform haze onto the web
//   galaxies  instanced camera-facing sprites that pop in along the web
//   veil      the ball's skin: plasma fog, its CMB ripples, then the afterglow
//
// No per-particle work happens in JavaScript after mount.

import * as THREE from "three";
import type { CosmicWeb } from "./cosmicWeb";
import type { UniverseState } from "./UniverseState";

const matterVertex = /* glsl */ `
uniform float uRadius;
uniform float uStructure;
uniform float uVisible;
uniform float uStars;
uniform float uGalaxies;
uniform float uPointScale;

attribute vec3 aHome;
attribute float aDensity;
attribute float aSeed;
attribute float aStar;

varying vec3 vColor;
varying float vAlpha;

void main() {
  // Knots collapse first, filaments next, voids drain last.
  float lead = aDensity * 0.35 - aSeed * 0.2;
  float f = smoothstep(0.0, 1.0, clamp(uStructure * 1.25 + lead, 0.0, 1.0));
  vec3 pos = mix(position, aHome, f) * uRadius;

  vec3 gas = vec3(0.50, 0.53, 0.80);
  vec3 web = vec3(0.72, 0.60, 0.92);
  vec3 warm = vec3(1.00, 0.80, 0.58);
  vec3 col = mix(gas, web, f * smoothstep(0.3, 1.0, aDensity + 0.3));
  col = mix(col, warm, uGalaxies * smoothstep(0.7, 1.0, aDensity) * f);

  float alpha = uVisible * mix(0.3, 0.85, f * (0.4 + 0.6 * aDensity)) * mix(0.6, 1.0, uGalaxies);
  float size = mix(1.6, 2.4, aDensity * f);

  float star = aStar * uStars;
  col = mix(col, vec3(0.92, 0.96, 1.0), star);
  alpha = mix(alpha, uVisible, star);
  size *= 1.0 + 2.2 * star;

  vColor = col;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uPointScale / -mv.z, 1.0, 9.0);
}
`;

const matterFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = 1.0 - smoothstep(0.32, 0.5, d);
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

const galaxyVertex = /* glsl */ `
uniform float uRadius;
uniform float uGalaxies;
uniform float uSize;

attribute vec3 aCenter;
attribute float aScale;
attribute float aAngle;
attribute float aBirth;
attribute float aElliptical;
attribute float aTint;

varying vec2 vUv;
varying float vTint;
varying float vAlpha;

void main() {
  float s = clamp((uGalaxies - aBirth * 0.75) / 0.25, 0.0, 1.0);
  // A small overshoot so each galaxy pops in like a sticker.
  float pop = s * (1.0 + 0.5 * sin(3.14159 * s) * (1.0 - s));
  vec4 mv = modelViewMatrix * vec4(aCenter * uRadius, 1.0);
  float c = cos(aAngle);
  float n = sin(aAngle);
  vec2 corner = position.xy * vec2(1.0, mix(0.55, 1.0, aTint));
  corner = vec2(c * corner.x - n * corner.y, n * corner.x + c * corner.y);
  mv.xy += corner * aScale * uSize * pop * mix(1.0, 0.7, aElliptical);
  gl_Position = projectionMatrix * mv;
  vUv = vec2((uv.x + aElliptical) * 0.5, uv.y);
  vTint = aTint;
  vAlpha = smoothstep(0.0, 0.3, s);
}
`;

const galaxyFragment = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vTint;
varying float vAlpha;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.5 || vAlpha < 0.01) discard;
  vec3 tint = mix(vec3(0.85, 0.88, 1.0), vec3(1.0, 0.9, 0.78), vTint);
  gl_FragColor = vec4(tex.rgb * tint, vAlpha);
  #include <colorspace_fragment>
}
`;

const veilVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormal;
varying vec3 vView;

void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const veilFragment = /* glsl */ `
uniform float uFog;
uniform float uHeat;
uniform float uRipples;
uniform float uAfterglow;
uniform float uPhase;
uniform float uQuarks;

varying vec3 vObj;
varying vec3 vNormal;
varying vec3 vView;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  return 0.55 * noise(p) + 0.3 * noise(p * 2.1) + 0.15 * noise(p * 4.3);
}

void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vView)));

  // Hot plasma in flat picture-book tones: a core, posterised boiling blobs,
  // and a thin darker rim. The palette slides from white-hot to orange.
  vec3 core = uHeat < 0.5 ? mix(vec3(1.0, 0.99, 0.9), vec3(1.0, 0.87, 0.56), uHeat * 2.0) : mix(vec3(1.0, 0.87, 0.56), vec3(0.97, 0.62, 0.42), uHeat * 2.0 - 1.0);
  vec3 blobc = uHeat < 0.5 ? mix(vec3(1.0, 0.86, 0.5), vec3(0.98, 0.74, 0.42), uHeat * 2.0) : mix(vec3(0.98, 0.74, 0.42), vec3(0.9, 0.48, 0.34), uHeat * 2.0 - 1.0);
  vec3 rimc = uHeat < 0.5 ? mix(vec3(0.98, 0.8, 0.45), vec3(0.94, 0.6, 0.34), uHeat * 2.0) : mix(vec3(0.94, 0.6, 0.34), vec3(0.78, 0.36, 0.27), uHeat * 2.0 - 1.0);
  // Unequal per-axis offsets: the hash is symmetric in x, y, z, which would mirror the pattern.
  float boil = fbm(vObj * 2.6 + vec3(uPhase, uPhase * 0.7 + 2.1, uPhase * 1.3 + 5.2));
  vec3 fog = mix(core, blobc, step(0.55, boil));
  fog = mix(fog, rimc, step(facing, 0.32));

  float m = fbm(vObj * 4.0 + vec3(uPhase * 0.25 + 7.3, 1.9, 4.6));
  vec3 cold = vec3(0.45, 0.66, 0.66);
  vec3 cool = vec3(0.98, 0.93, 0.80);
  vec3 warmc = vec3(0.95, 0.76, 0.45);
  vec3 hot = vec3(0.86, 0.43, 0.33);
  vec3 cmb = m < 0.42 ? cold : m < 0.5 ? cool : m < 0.58 ? warmc : hot;

  vec3 col = mix(fog, cmb, uRipples * 0.85);

  vec3 cell = floor(vObj * 7.0);
  float q = hash(cell);
  if (uQuarks > 0.0 && q > 0.86) {
    vec3 qc = q > 0.953 ? vec3(0.88, 0.48, 0.37) : q > 0.907 ? vec3(0.51, 0.70, 0.60) : vec3(0.61, 0.42, 0.60);
    float d = length(fract(vObj * 7.0) - 0.5);
    col = mix(col, qc, uQuarks * (1.0 - smoothstep(0.17, 0.2, d)));
  }

  // The fog lifts in patches rather than fading to mud, and the released
  // light lingers as a crisp ring at the rim that thins as it cools.
  float lift = clamp((fbm(vObj * 5.0 + vec3(3.0, 8.4, 1.7)) - 0.25) * 2.0, 0.0, 1.0);
  float fogAlpha = step(1.0 - uFog, lift * 0.98 + 0.01);
  float shell = step(facing, 0.42 * uAfterglow);
  float alpha = max(fogAlpha, shell);
  gl_FragColor = vec4(col, alpha);
}
`;

export class UniverseField {
  readonly matter: THREE.Points;
  readonly galaxies: THREE.Mesh;
  readonly veil: THREE.Mesh;
  /** The veil's far side, drawn before the matter so it never paints over nearer dots. */
  readonly veilBack: THREE.Mesh;
  private matterUniforms: Record<string, THREE.IUniform>;
  private galaxyUniforms: Record<string, THREE.IUniform>;
  private veilUniforms: Record<string, THREE.IUniform>;
  private disposables: { dispose(): void }[] = [];

  constructor(web: CosmicWeb, galaxyMap: THREE.Texture) {
    const p = web.particles;
    const matterGeometry = this.track(new THREE.BufferGeometry());
    matterGeometry.setAttribute("position", new THREE.BufferAttribute(p.start, 3));
    matterGeometry.setAttribute("aHome", new THREE.BufferAttribute(p.home, 3));
    matterGeometry.setAttribute("aDensity", new THREE.BufferAttribute(p.density, 1));
    matterGeometry.setAttribute("aSeed", new THREE.BufferAttribute(p.seed, 1));
    matterGeometry.setAttribute("aStar", new THREE.BufferAttribute(p.star, 1));
    this.matterUniforms = {
      uRadius: { value: 1 },
      uStructure: { value: 0 },
      uVisible: { value: 0 },
      uStars: { value: 0 },
      uGalaxies: { value: 0 },
      uPointScale: { value: 26 },
    };
    this.matter = new THREE.Points(
      matterGeometry,
      this.track(
        new THREE.ShaderMaterial({
          uniforms: this.matterUniforms,
          vertexShader: matterVertex,
          fragmentShader: matterFragment,
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    // The shader moves every particle, so the CPU bounding sphere is meaningless.
    this.matter.frustumCulled = false;
    this.matter.renderOrder = 1;
    // gl_PointSize is in device pixels. The ratio changes under a video export
    // (held at 1) and whenever the renderer is retuned, so read it per frame.
    this.matter.onBeforeRender = (renderer) => {
      this.matterUniforms.uPointScale.value = 26 * renderer.getPixelRatio();
    };

    const g = web.galaxies;
    const quad = new THREE.PlaneGeometry(1, 1);
    const galaxyGeometry = this.track(new THREE.InstancedBufferGeometry());
    galaxyGeometry.setIndex(quad.index);
    galaxyGeometry.setAttribute("position", quad.getAttribute("position"));
    galaxyGeometry.setAttribute("uv", quad.getAttribute("uv"));
    galaxyGeometry.setAttribute("aCenter", new THREE.InstancedBufferAttribute(g.position, 3));
    galaxyGeometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(g.size, 1));
    galaxyGeometry.setAttribute("aAngle", new THREE.InstancedBufferAttribute(g.angle, 1));
    galaxyGeometry.setAttribute("aBirth", new THREE.InstancedBufferAttribute(g.birth, 1));
    galaxyGeometry.setAttribute("aElliptical", new THREE.InstancedBufferAttribute(g.elliptical, 1));
    galaxyGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(g.tint, 1));
    galaxyGeometry.instanceCount = g.count;
    this.galaxyUniforms = {
      uRadius: { value: 1 },
      uGalaxies: { value: 0 },
      uSize: { value: 0.5 },
      uMap: { value: galaxyMap },
    };
    this.galaxies = new THREE.Mesh(
      galaxyGeometry,
      this.track(
        new THREE.ShaderMaterial({
          uniforms: this.galaxyUniforms,
          vertexShader: galaxyVertex,
          fragmentShader: galaxyFragment,
          transparent: true,
        }),
      ),
    );
    this.galaxies.frustumCulled = false;
    this.galaxies.renderOrder = 2;
    // The instanced quads have no meaningful CPU bounds; keep them out of hover and overview.
    this.galaxies.raycast = () => {};

    this.veilUniforms = {
      uFog: { value: 1 },
      uHeat: { value: 0 },
      uRipples: { value: 0 },
      uAfterglow: { value: 0 },
      uPhase: { value: 0 },
      uQuarks: { value: 0 },
    };
    const veilMaterial = (side: THREE.Side) =>
      this.track(
        new THREE.ShaderMaterial({
          uniforms: this.veilUniforms,
          vertexShader: veilVertex,
          fragmentShader: veilFragment,
          transparent: true,
          depthWrite: false,
          side,
        }),
      );
    const sphere = this.track(new THREE.SphereGeometry(1, 96, 64));
    this.veil = new THREE.Mesh(sphere, veilMaterial(THREE.FrontSide));
    this.veil.renderOrder = 3;
    this.veil.raycast = () => {};
    this.veilBack = new THREE.Mesh(sphere, veilMaterial(THREE.BackSide));
    this.veilBack.renderOrder = 0;
    this.veilBack.raycast = () => {};
  }

  update(state: UniverseState): void {
    const m = this.matterUniforms;
    m.uRadius.value = state.radius;
    m.uStructure.value = state.structure;
    m.uVisible.value = 1 - state.fog;
    m.uStars.value = state.firstStars;
    m.uGalaxies.value = state.galaxies;
    this.matter.visible = state.fog < 0.999;

    const g = this.galaxyUniforms;
    g.uRadius.value = state.radius;
    g.uGalaxies.value = state.galaxies;
    this.galaxies.visible = state.galaxies > 0.001;

    const v = this.veilUniforms;
    v.uFog.value = state.fog;
    v.uHeat.value = state.fogHeat;
    v.uRipples.value = state.ripples;
    v.uAfterglow.value = state.afterglow;
    v.uPhase.value = state.boil;
    v.uQuarks.value = state.quarks;
    const veiled = state.fog > 0.001 || state.afterglow > 0.001;
    for (const mesh of [this.veil, this.veilBack]) {
      mesh.scale.setScalar(state.radius);
      mesh.visible = veiled;
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }
}
