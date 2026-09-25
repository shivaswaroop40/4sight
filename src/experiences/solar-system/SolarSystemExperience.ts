// src/experiences/solar-system/SolarSystemExperience.ts
//
// A molecular cloud collapses into the Sun, a disk, and eight planets with
// their moons. The slider walks 4.6 billion years on a knotted log scale.
// Particles do the gathering (AccretionField); solid meshes take over once a
// body has formed, glowing hot and then cooling to its final colours.

import * as THREE from "three";
import { lerp } from "../../core/interpolate";
import { eventAt } from "../../core/Timeline";
import type {
  CameraPreset,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import { AccretionField } from "./AccretionField";
import { BODIES, EVENTS, KNOTS, type BodyDef } from "./solarData";
import { formatYears, knotMapping } from "./solarMapping";
import { solarStateAt, type SolarState } from "./SolarSystemState";
import { bandsTexture, earthTexture, glowTexture, ringTexture } from "./textures";

const CAMERA: CameraPreset = { id: "overview", name: "Overview", position: [0, 13, 27], target: [0, 0, 0] };

const MOLTEN = new THREE.Color(0.22, 0.07, 0.03);
const EMISSIVE_HOT = new THREE.Color(1.0, 0.55, 0.15);
const EMISSIVE_WARM = new THREE.Color(0.6, 0.1, 0.02);
const PROTOSUN = new THREE.Color(0.75, 0.22, 0.06);
const SUN = new THREE.Color(1.0, 0.93, 0.78);
const SUN_LIGHT_COLD = new THREE.Color(0xff6a33);
const SUN_LIGHT_HOT = new THREE.Color(0xfff1dd);

interface BodyView {
  def: BodyDef;
  group: THREE.Group;
  mesh: THREE.Mesh;
  glow: THREE.Sprite;
  finalColor: THREE.Color;
  ring?: THREE.Mesh;
  orbit?: THREE.LineLoop;
}

class SolarSystemExperience implements FourDExperience {
  id = "solarSystem" as const;
  name = "Solar System";

  minTime = 0;
  maxTime = KNOTS[KNOTS.length - 1].time;
  mapping = knotMapping(KNOTS, formatYears);
  baseDurationSeconds = 40;
  warpPresets = [0.25, 0.5, 1, 2, 4];
  labels = { start: "Nebula", end: "Today" };
  events: TimelineEvent[] = EVENTS;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private field: AccretionField | null = null;
  private views: BodyView[] = [];
  private sunLight: THREE.PointLight | null = null;
  private corona: THREE.Sprite | null = null;
  private disposables: { dispose(): void }[] = [];
  private currentP = 0;

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    const root = new THREE.Group();
    this.root = root;
    ctx.scene.add(root);

    // Space is dark: paint over the app's paper background while mounted.
    // SceneManager resets scene.background on unmount.
    ctx.scene.background = new THREE.Color(0x05060a);

    const glowTex = this.track(glowTexture());

    root.add(this.starfield());

    this.field = new AccretionField(ctx.renderer.getPixelRatio());
    root.add(this.field.points);

    this.sunLight = new THREE.PointLight(0xffffff, 0, 0, 0);
    root.add(this.sunLight);
    // Fill light so night sides facing the camera don't read as black holes.
    root.add(new THREE.AmbientLight(0x6a7896, 1.1));

    const sphere = this.track(new THREE.SphereGeometry(1, 48, 32));
    const orbitGeometry = this.track(this.circle(128));

    for (const def of BODIES) {
      const group = new THREE.Group();
      const tilt = new THREE.Group();
      tilt.rotation.z = def.tilt ?? 0;
      group.add(tilt);

      let material: THREE.Material;
      const finalColor = new THREE.Color(def.color);
      if (def.kind === "star") {
        material = new THREE.MeshBasicMaterial({ color: PROTOSUN });
      } else {
        const map =
          def.surface === "bands"
            ? this.track(bandsTexture(def.bandColors ?? [def.color], def.id.length * 977 + 13))
            : def.surface === "earth"
              ? this.track(earthTexture())
              : null;
        material = new THREE.MeshStandardMaterial({ color: finalColor, map, roughness: 0.85, metalness: 0 });
      }
      this.track(material);
      const mesh = new THREE.Mesh(sphere, material);
      mesh.userData.id = def.id;
      tilt.add(mesh);

      const glowMaterial = this.track(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: def.kind === "star" ? 0xff8a3d : 0xff7a2a,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      const glow = new THREE.Sprite(glowMaterial);
      group.add(glow);

      const view: BodyView = { def, group, mesh, glow, finalColor };

      if (def.id === "saturn") {
        const inner = 1.3;
        const outer = 2.3;
        const ringMaterial = this.track(
          new THREE.MeshBasicMaterial({
            map: this.track(ringTexture(inner, outer)),
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            opacity: 0,
          }),
        );
        const ring = new THREE.Mesh(this.track(new THREE.RingGeometry(inner, outer, 128)), ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        tilt.add(ring);
        view.ring = ring;
      }

      if (def.kind === "planet") {
        const orbitMaterial = this.track(
          new THREE.LineBasicMaterial({ color: 0x6f86b8, transparent: true, opacity: 0, depthWrite: false }),
        );
        const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
        orbit.scale.setScalar(def.orbit);
        root.add(orbit);
        view.orbit = orbit;
      }

      if (def.kind === "star") {
        this.corona = new THREE.Sprite(
          this.track(
            new THREE.SpriteMaterial({
              map: glowTex,
              color: 0xffc070,
              blending: THREE.AdditiveBlending,
              transparent: true,
              depthWrite: false,
              opacity: 0,
            }),
          ),
        );
        group.add(this.corona);
      }

      root.add(group);
      ctx.registerHoverable(mesh, def.id);
      this.views.push(view);
    }
  }

  setTime(time: number): void {
    const p = this.mapping.toParam(time);
    this.currentP = p;
    if (!this.field) return;
    const state = solarStateAt(p);
    this.field.update(state);
    for (const [i, view] of this.views.entries()) {
      this.applyBody(view, state, i);
    }
  }

  getState(time: number): SolarState {
    return solarStateAt(this.mapping.toParam(time));
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    const def = BODIES.find((b) => b.id === id);
    if (!def) return null;
    const body = solarStateAt(this.currentP).bodies.find((b) => b.id === id)!;
    const stage =
      body.solid < 1 ? "Still gathering from dust and gas. " : body.heat > 0.3 ? "Molten and glowing. " : "";
    return {
      id,
      name: def.name,
      description: stage + def.description,
      category: def.kind,
      properties: def.properties,
    };
  }

  getAvailableFilters(): VisualizationFilter[] {
    return [];
  }

  getCameraPresets(): CameraPreset[] {
    return [CAMERA];
  }

  reset(): void {
    // setTime reconstructs everything from p; nothing accumulates.
  }

  dispose(): void {
    if (this.ctx) {
      for (const view of this.views) this.ctx.unregisterHoverable(view.mesh);
      if (this.root) this.ctx.scene.remove(this.root);
    }
    this.field?.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.views = [];
    this.field = null;
    this.root = null;
    this.sunLight = null;
    this.corona = null;
    this.ctx = null;
  }

  private applyBody(view: BodyView, state: SolarState, index: number): void {
    const { def, group, mesh, glow } = view;
    const body = state.bodies[index];
    group.position.set(...body.position);
    mesh.rotation.y = body.spin;

    if (def.kind === "star") {
      const ignite = state.ignition;
      const scale = def.size * body.solid * lerp(1.3, 1, ignite);
      mesh.scale.setScalar(Math.max(scale, 1e-4));
      mesh.visible = body.solid > 0.001;
      (mesh.material as THREE.MeshBasicMaterial).color.copy(PROTOSUN).lerp(SUN, ignite);

      const glowMaterial = glow.material as THREE.SpriteMaterial;
      glowMaterial.opacity = body.clump * lerp(0.55, 1, ignite);
      glowMaterial.color.setHex(0xff5a24).lerp(new THREE.Color(0xffc978), ignite);
      glow.scale.setScalar(def.size * lerp(4, 9, ignite) * Math.max(body.clump, 0.2));

      const corona = this.corona!;
      (corona.material as THREE.SpriteMaterial).opacity = 0.35 * ignite;
      corona.scale.setScalar(def.size * 22 * ignite + 1e-4);

      const light = this.sunLight!;
      light.intensity = body.solid * lerp(0.8, 3.2, ignite);
      light.color.copy(SUN_LIGHT_COLD).lerp(SUN_LIGHT_HOT, ignite);
      return;
    }

    const heat = body.heat;
    // Hot bodies are puffed up and glowing; they shrink a little as they cool.
    const scale = def.size * body.solid * (1 + 0.25 * heat);
    mesh.scale.setScalar(Math.max(scale, 1e-4));
    mesh.visible = body.solid > 0.001;

    const material = mesh.material as THREE.MeshStandardMaterial;
    const target = material.map ? new THREE.Color(1, 1, 1) : view.finalColor;
    material.color.copy(MOLTEN).lerp(target, 1 - heat);
    material.emissive.copy(EMISSIVE_WARM).lerp(EMISSIVE_HOT, heat);
    material.emissiveIntensity = Math.pow(heat, 1.2) * 1.8;

    // Glow: a brightening knot while the particles gather, then the heat of the new body.
    const gathering = THREE.MathUtils.smoothstep(body.clump, 0.4, 0.9) * (1 - body.solid);
    const glowMaterial = glow.material as THREE.SpriteMaterial;
    glowMaterial.opacity = Math.max(heat * body.solid, gathering) * 0.85;
    glow.scale.setScalar(def.size * 5 * (0.6 + heat));

    if (view.ring) {
      const ringOpacity = THREE.MathUtils.smoothstep(state.p, 0.58, 0.72);
      (view.ring.material as THREE.MeshBasicMaterial).opacity = ringOpacity * 0.9;
      view.ring.visible = ringOpacity > 0.001;
    }
    if (view.orbit) {
      (view.orbit.material as THREE.LineBasicMaterial).opacity = 0.2 * state.orbits;
      view.orbit.visible = state.orbits > 0.001;
    }
  }

  private starfield(): THREE.Points {
    let s = 99;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const count = 2500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const z = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = 250 + rand() * 150;
      const q = Math.sqrt(1 - z * z);
      positions.set([r * q * Math.cos(a), r * z, r * q * Math.sin(a)], i * 3);
    }
    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = this.track(
      new THREE.PointsMaterial({ color: 0xaab4cc, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.7 }),
    );
    return new THREE.Points(geometry, material);
  }

  private circle(segments: number): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }
}

export const solarSystemExperience: FourDExperience = new SolarSystemExperience();
