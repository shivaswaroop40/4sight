// src/experiences/mock/mockLogExperience.ts
//
// Log-timeline mock: solar system formation in years since the cloud began
// to collapse, on a piecewiseLogMapping. A cartoon dust cloud contracts and
// flattens into a spinning disk around a bright protosun; the gas clears;
// Jupiter and then the rocky planets pop in. Exists so the log timeline,
// warp, switching, and camera can be exercised before the Cosmos lane lands.
//
// Everything in setTime is a pure function of t: the disk rotation angle is
// derived from the slider position of t, not accumulated.

import * as THREE from "three";
import { piecewiseLogMapping } from "../../core/mappings";
import { smoothstep } from "../../core/interpolate";
import { eventAt } from "../../core/Timeline";
import { THEME, addOutline, addWarmLights, disposeObject, makeToonMaterial } from "../../core/theme";
import type { CameraPreset, FourDExperience, ObjectMetadata, SceneContext, TimelineEvent } from "../../core/types";

const YEAR_UNITS: [number, string][] = [
  [1e9, "Gyr"],
  [1e6, "Myr"],
  [1e3, "kyr"],
];

/** "0 yr", "640 yr", "12.4 kyr", "3.00 Myr", "4.60 Gyr". */
export function formatYears(years: number): string {
  if (!Number.isFinite(years) || years <= 0) return "0 yr";
  for (const [scale, unit] of YEAR_UNITS) {
    if (years >= scale * 0.9995) return `${sig(years / scale)} ${unit}`;
  }
  return `${sig(years)} yr`;
}

function sig(x: number): string {
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  if (x >= 0.01) return x.toFixed(2);
  return x.toPrecision(2);
}

const KNOTS = [
  { time: 0, label: "Collapse" },
  { time: 1e5, label: "100 kyr" },
  { time: 1e6, label: "1 Myr" },
  { time: 3e6, label: "3 Myr" },
  { time: 1e7, label: "10 Myr" },
  { time: 1e8, label: "100 Myr" },
  { time: 1e9, label: "1 Gyr" },
  { time: 4.6e9, label: "Today" },
];

const mapping = piecewiseLogMapping(KNOTS, formatYears, { logFloor: 1e3 });
const SEG = 1 / (KNOTS.length - 1);

const events: TimelineEvent[] = [
  {
    id: "collapse",
    time: 0,
    title: "A cloud starts to fall in",
    when: "Year 0",
    description:
      "A cold clump of gas and dust in a molecular cloud gets dense enough that its own gravity wins. It begins to collapse.",
    keyPoints: ["Mostly hydrogen and helium", "A few light years across", "Spinning very slowly"],
  },
  {
    id: "protosun",
    time: 1e5,
    title: "Protosun and disk",
    when: "~100,000 years",
    description:
      "Most of the mass falls to the centre and heats up into a protosun. The slow spin flattens the rest into a disk.",
    keyPoints: ["Spin plus collapse makes a disk", "The centre glows from gravitational heating"],
  },
  {
    id: "planetesimals",
    time: 1e6,
    title: "Planetesimals",
    when: "~1 million years",
    description: "Dust grains stick together into pebbles, then kilometre-sized planetesimals.",
    keyPoints: ["Billions of small bodies", "Collisions build them up"],
  },
  {
    id: "jupiter",
    time: 3e6,
    title: "Jupiter forms",
    when: "~3 million years",
    description: "Beyond the frost line, ice helps a core grow fast enough to grab a huge gas envelope.",
    keyPoints: ["The first giant planet", "Its gravity shapes the rest of the disk"],
  },
  {
    id: "gas-cleared",
    time: 1e7,
    title: "The gas clears",
    when: "~10 million years",
    description: "The young Sun's wind and light blow the leftover gas away. Only rock and ice remain.",
    keyPoints: ["Giant planets stop growing", "Rocky debris is left behind"],
  },
  {
    id: "rocky",
    time: 1e8,
    title: "Rocky planets and the Moon",
    when: "~100 million years",
    description:
      "Planetary embryos collide into Mercury, Venus, Earth and Mars. A Mars-sized body hits the young Earth and the debris forms the Moon.",
    keyPoints: ["Giant impacts", "The Moon-forming impact"],
  },
  {
    id: "settled",
    time: 1e9,
    title: "Orbits settle",
    when: "~1 billion years",
    description: "The heavy bombardment fades and the planets settle into stable orbits.",
    keyPoints: ["Fewer impacts", "Stable, nearly circular orbits"],
  },
  {
    id: "today",
    time: 4.6e9,
    title: "Today",
    when: "~4.6 billion years",
    description: "Eight planets, a belt of leftovers, and a middle-aged Sun.",
    keyPoints: ["The Sun is about halfway through its life"],
  },
];

interface Planet {
  id: string;
  name: string;
  radius: number;
  orbit: number;
  color: string;
  bornAt: number;
  description: string;
}

const PLANETS: Planet[] = [
  { id: "mercury", name: "Mercury", radius: 0.09, orbit: 1.15, color: THEME.inkSoft, bornAt: 1e8, description: "Small, dense, closest to the Sun." },
  { id: "venus", name: "Venus", radius: 0.14, orbit: 1.55, color: THEME.mustard, bornAt: 1e8, description: "Earth-sized, wrapped in thick clouds." },
  { id: "earth", name: "Earth", radius: 0.15, orbit: 2.0, color: THEME.sage, bornAt: 1e8, description: "Rocky, wet, and home. The Moon formed from a giant impact." },
  { id: "mars", name: "Mars", radius: 0.11, orbit: 2.5, color: THEME.terracotta, bornAt: 1e8, description: "Small and red, never finished growing." },
  { id: "jupiter", name: "Jupiter", radius: 0.42, orbit: 3.6, color: "#D9A066", bornAt: 3e6, description: "The first and largest planet. A gas giant." },
  { id: "saturn", name: "Saturn", radius: 0.34, orbit: 4.7, color: "#E8C48A", bornAt: 5e6, description: "The second gas giant, famous for its rings." },
];

const OBJECTS: Record<string, ObjectMetadata> = {
  sun: {
    id: "sun",
    name: "The (proto)Sun",
    description: "Most of the cloud's mass ends up here, glowing from the heat of collapse and later from fusion.",
    category: "star",
    properties: { Mass: "99.8% of the system", Age: "4.6 Gyr" },
  },
  disk: {
    id: "disk",
    name: "Protoplanetary disk",
    description: "Leftover gas and dust circling the young Sun. Planets grow inside it.",
    category: "disk",
    properties: { Gas: "cleared by ~10 Myr", Width: "~100 AU" },
  },
};
for (const p of PLANETS) {
  OBJECTS[p.id] = {
    id: p.id,
    name: p.name,
    description: p.description,
    category: "planet",
    properties: { "Forms by": formatYears(p.bornAt), Orbit: `${p.orbit.toFixed(1)} (scene units)` },
  };
}

const PRESETS: CameraPreset[] = [
  { id: "tilted", name: "Tilted", position: [0, 6.5, 14], target: [0, -0.6, 0] },
  { id: "top", name: "Top down", position: [0, 16, 0.01], target: [0, 0, 1.2] },
  { id: "edge", name: "Edge on", position: [15, 0.8, 0], target: [0, -0.4, 0] },
];

const PARTICLES = 900;
const CLOUD_RADIUS = 5.5;

/** Pure scene parameters at time t. */
function sceneAt(time: number) {
  const u = mapping.toParam(time);
  return {
    u,
    /** 0 = diffuse cloud, 1 = contracted. */
    collapse: smoothstep(0, SEG, u),
    /** 0 = round, 1 = flat disk. */
    flatten: smoothstep(SEG * 0.4, SEG * 2, u),
    /** 1 = full gas, 0 = only debris. */
    gas: 1 - smoothstep(SEG * 3.2, SEG * 4.2, u),
    sun: smoothstep(SEG * 0.2, SEG * 1.2, u),
    /** Disk rotation, pure in u. */
    spin: u * 9,
  };
}

function planetScale(p: Planet, time: number): number {
  const born = mapping.toParam(p.bornAt);
  const u = mapping.toParam(time);
  return smoothstep(born - SEG * 0.25, born + SEG * 0.1, u);
}

function orbitAngle(orbit: number, spin: number, phase: number): number {
  return phase + spin / Math.pow(orbit / 2, 1.5);
}

const VERTEX = /* glsl */ `
attribute vec3 aDisk;
attribute vec3 aColor;
attribute float aSeed;
uniform float uCollapse;
uniform float uFlatten;
uniform float uSpin;
uniform float uGas;
uniform float uSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 cloud = position * mix(1.0, 0.55, uCollapse);
  vec3 p = mix(cloud, aDisk, uFlatten);
  float r = max(length(p.xz), 0.35);
  float a = uSpin / pow(r / 2.0, 1.5) * (0.35 + 0.65 * uFlatten);
  float c = cos(a), s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // Gas dots shrink away as the gas clears; debris dots stay.
  float debris = step(aSeed, 0.14);
  float keep = max(debris, uGas);
  vAlpha = step(0.02, keep);
  gl_PointSize = uSize * mix(1.0, 0.75, debris) * (0.6 + aSeed) * keep / -mv.z;
  vColor = aColor;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uInk;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 col = d > 0.34 ? uInk : vColor;
  gl_FragColor = vec4(col, vAlpha);
  #include <colorspace_fragment>
}`;

class MockLogExperience implements FourDExperience {
  id = "mockLog" as const;
  name = "Log mock";

  minTime = 0;
  maxTime = 4.6e9;
  mapping = mapping;
  baseDurationSeconds = 40;
  warpPresets = [0.25, 0.5, 1, 2, 5, 10, 20];
  labels = { start: "Cloud collapse", end: "Today" };
  events = events;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private sun: THREE.Mesh | null = null;
  private glow: THREE.Mesh | null = null;
  private diskProxy: THREE.Mesh | null = null;
  private planets: { planet: Planet; group: THREE.Group; orbit: THREE.LineLoop; phase: number }[] = [];

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    const root = new THREE.Group();
    root.name = "mock-log-root";
    this.root = root;

    // Seeded so re-mounts look identical.
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const cloud = new Float32Array(PARTICLES * 3);
    const disk = new Float32Array(PARTICLES * 3);
    const colors = new Float32Array(PARTICLES * 3);
    const seeds = new Float32Array(PARTICLES);
    const palette = [THEME.terracotta, THEME.mustard, THEME.plum, "#D9A066", THEME.sage].map((c) => new THREE.Color(c));
    for (let i = 0; i < PARTICLES; i++) {
      // Cloud: lumpy sphere.
      const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      const r = CLOUD_RADIUS * Math.cbrt(rand()) * (0.8 + 0.2 * rand());
      cloud.set([dir.x * r, dir.y * r * 0.85, dir.z * r], i * 3);
      // Disk: denser towards the middle, thin.
      const dr = 0.7 + 4.8 * Math.pow(rand(), 0.8);
      const th = rand() * Math.PI * 2;
      disk.set([Math.cos(th) * dr, (rand() - 0.5) * 0.12 * dr * 0.4, Math.sin(th) * dr], i * 3);
      const col = palette[Math.min(palette.length - 1, Math.floor(Math.pow(rand(), 1.3) * palette.length))];
      colors.set([col.r, col.g, col.b], i * 3);
      seeds[i] = rand();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cloud, 3));
    geometry.setAttribute("aDisk", new THREE.BufferAttribute(disk, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCollapse: { value: 0 },
        uFlatten: { value: 0 },
        uSpin: { value: 0 },
        uGas: { value: 1 },
        uSize: { value: 84 * Math.min(window.devicePixelRatio, 2) },
        uInk: { value: new THREE.Color(THEME.ink) },
      },
    });
    const points = new THREE.Points(geometry, this.material);
    points.frustumCulled = false;
    root.add(points);

    // Protosun: toon sphere with a soft cream halo disc behind it.
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 48, 32),
      makeToonMaterial(THEME.mustard, { emissive: new THREE.Color("#F6A55B"), emissiveIntensity: 0.55 }),
    );
    addOutline(this.sun, 0.04);
    root.add(this.sun);
    ctx.registerHoverable(this.sun, "sun");

    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 48),
      // Opaque and drawn first with no depth write: a flat picture-book halo that everything else draws over.
      new THREE.MeshBasicMaterial({ color: "#FBE6B8", depthWrite: false }),
    );
    this.glow.renderOrder = -1;
    // Billboard the halo each frame from the camera, so it faces the viewer while orbiting paused.
    const glow = this.glow;
    // It sits just behind the Sun (away from the camera) so it never veils the Sun's outline.
    const behind = new THREE.Vector3();
    glow.onBeforeRender = (_renderer, _scene, camera) => {
      glow.quaternion.copy(camera.quaternion);
      behind.copy(camera.position).normalize().multiplyScalar(-0.9);
      glow.position.copy(behind);
      glow.updateMatrixWorld();
    };
    root.add(this.glow);

    // Invisible, hoverable disk volume.
    this.diskProxy = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, 0.1, 48), new THREE.MeshBasicMaterial());
    this.diskProxy.visible = false;
    root.add(this.diskProxy);
    ctx.registerHoverable(this.diskProxy, "disk");

    PLANETS.forEach((planet, i) => {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(planet.radius, 32, 20), makeToonMaterial(planet.color));
      addOutline(mesh, Math.max(0.02, planet.radius * 0.14));
      group.add(mesh);
      if (planet.id === "saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(planet.radius * 1.35, planet.radius * 1.9, 48),
          makeToonMaterial("#C99A5B", { side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2.4;
        mesh.add(ring);
      }
      ctx.registerHoverable(mesh, planet.id);
      root.add(group);

      const orbitPoints = new THREE.EllipseCurve(0, 0, planet.orbit, planet.orbit).getPoints(96);
      const orbit = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitPoints.map((p) => new THREE.Vector3(p.x, 0, p.y))),
        new THREE.LineBasicMaterial({ color: THEME.inkSoft, transparent: true, opacity: 0 }),
      );
      root.add(orbit);
      this.planets.push({ planet, group, orbit, phase: i * 2.1 });
    });

    ctx.scene.add(root);
    root.add(addWarmLights(ctx.scene));
  }

  setTime(time: number): void {
    if (!this.material || !this.sun || !this.glow || !this.ctx) return;
    const s = sceneAt(time);
    const uniforms = this.material.uniforms;
    uniforms.uCollapse.value = s.collapse;
    uniforms.uFlatten.value = s.flatten;
    uniforms.uSpin.value = s.spin;
    uniforms.uGas.value = s.gas;

    const sunScale = 0.25 + 0.75 * s.sun;
    this.sun.scale.setScalar(sunScale);
    this.glow.scale.setScalar(0.3 + 0.9 * s.sun);

    for (const { planet, group, orbit, phase } of this.planets) {
      const scale = planetScale(planet, time);
      group.visible = scale > 0.001;
      group.scale.setScalar(Math.max(scale, 0.001));
      const angle = orbitAngle(planet.orbit, s.spin, phase);
      group.position.set(Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit);
      (orbit.material as THREE.LineBasicMaterial).opacity = 0.45 * scale;
    }
  }

  getState(time: number): unknown {
    const s = sceneAt(time);
    return {
      ...s,
      planets: Object.fromEntries(PLANETS.map((p) => [p.id, planetScale(p, time)])),
    };
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    return OBJECTS[id] ?? null;
  }

  getAvailableFilters() {
    return [];
  }

  getCameraPresets(): CameraPreset[] {
    return PRESETS;
  }

  reset(): void {}

  dispose(): void {
    if (this.root && this.ctx) {
      this.root.traverse((o) => this.ctx!.unregisterHoverable(o));
      disposeObject(this.root);
    }
    this.root = null;
    this.material = null;
    this.sun = null;
    this.glow = null;
    this.diskProxy = null;
    this.planets = [];
    this.ctx = null;
  }
}

export const mockLogExperience: FourDExperience = new MockLogExperience();
