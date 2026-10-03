// src/experiences/iphone/IPhoneExperience.ts
//
// An iPhone that assembles itself and then comes to life: the screen turns
// on, a face opens its eyes, blinks, and the phone does a happy hop. Every
// frame is rebuilt from t by setTime, so scrubbing back plays it in reverse.
// The X-ray filter turns the glass translucent so the parts inside show.

import * as THREE from "three";
import { defaultFilterState } from "../../core/filters";
import { linearMapping } from "../../core/mappings";
import { addWarmLights, disposeObject } from "../../core/theme";
import { eventAt } from "../../core/Timeline";
import type {
  CameraPreset,
  FilterState,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import {
  cameraDistanceScale,
  componentAssembledFraction,
  componentPose,
  eyeOpenness,
  faceOpacity,
  hopPose,
  iphoneState,
  screenOpacity,
  smileAmount,
  sparkleScale,
} from "./IPhoneState";
import { IPHONE_DATA_FALLBACK, type IPhoneData } from "./iphoneData";
import { PART_BUILDERS, PHONE, buildFace, buildScreen, buildSparkles, type Face, type Screen } from "./iphoneModel";

const MAPPING_TICKS = [
  { u: 0, label: "Exploded" },
  { u: 0.25, label: "" },
  { u: 0.5, label: "Halfway" },
  { u: 0.75, label: "" },
  { u: 1, label: "Alive" },
];

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "three-quarter", name: "Three-quarter", position: [8, 3.5, 13.5], target: [0, -0.9, 0] },
  { id: "front", name: "Front", position: [0, -0.9, 15], target: [0, -0.9, 0] },
  { id: "back", name: "Back", position: [0, -0.9, -15], target: [0, -0.9, 0] },
  { id: "side", name: "Side", position: [15, 0, 0], target: [0, -0.9, 0] },
];

const FILTERS: VisualizationFilter[] = [
  { id: "xray", name: "X-ray", defaultOn: false, description: "See through the case to the parts inside" },
];

/**
 * The glass that hides the parts inside. X-ray turns it, and the screen and
 * face drawn on the display, translucent. The metal frame stays solid: it
 * hides nothing from the front or back, and its ink outline keeps the
 * phone's silhouette in the house style.
 */
const CASING = ["back-glass", "display"];
const XRAY_CASING_OPACITY = 0.16;
const XRAY_SCREEN_OPACITY = 0.18;

interface Casing {
  /** Every surface mesh, so X-ray can let hover rays pass through to the internals. */
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  outlines: THREE.Object3D[];
}

const NO_RAYCAST = () => {};

class IPhoneExperienceImpl implements FourDExperience {
  id = "iphone" as const;
  name = "iPhone";

  minTime = 0;
  maxTime = 1;
  mapping = linearMapping(0, 1, (t: number) => `${Math.round(t * 100)}%`, MAPPING_TICKS);
  baseDurationSeconds = 10;
  warpPresets = [0.25, 0.5, 1, 2, 4];
  labels = { start: "Exploded", end: "Alive" };

  private data: IPhoneData = IPHONE_DATA_FALLBACK;
  events: TimelineEvent[] = this.data.events;

  private context: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private parts = new Map<string, THREE.Group>();
  private lights: THREE.Group | null = null;
  private screen: Screen | null = null;
  private face: Face | null = null;
  private sparkles: THREE.Group[] = [];
  private casing: Casing = { meshes: [], materials: [], outlines: [] };
  private xray = false;

  mount(context: SceneContext): void {
    this.context = context;
    this.xray = defaultFilterState(FILTERS).xray;
    this.lights = addWarmLights(context.scene);

    // root pivots at the phone's bottom edge so the hop squashes from the floor.
    const root = new THREE.Group();
    root.name = "iphone";
    const body = new THREE.Group();
    body.position.y = PHONE.height / 2;
    root.add(body);

    for (const component of this.data.components) {
      const build = PART_BUILDERS[component.id];
      if (!build) continue;
      const part = build();
      part.name = component.id;
      part.userData.id = component.id;
      body.add(part);
      this.parts.set(component.id, part);
      context.registerHoverable(part, component.id);
    }

    const display = this.parts.get("display");
    if (display) {
      this.screen = buildScreen();
      this.face = buildFace();
      display.add(this.screen.group, this.face.group);
    }
    this.casing = this.collectCasing();

    this.sparkles = buildSparkles();
    for (const s of this.sparkles) body.add(s);

    context.scene.add(root);
    this.root = root;
    this.setTime(0);
  }

  setTime(time: number): void {
    const t = Math.min(1, Math.max(0, time));
    for (const component of this.data.components) {
      const part = this.parts.get(component.id);
      if (!part) continue;
      const pose = componentPose(component, t);
      part.position.set(...pose.position);
      part.quaternion.set(...pose.quaternion);
      part.scale.set(...pose.scale);
      if (component.id === "side-buttons") {
        // Buttons slide in from either side.
        const spread = 1 - componentAssembledFraction(component, t);
        for (const b of part.children) b.position.x = b.userData.baseX * (1 + spread * 0.7);
      }
    }

    if (this.root) {
      const hop = hopPose(t);
      this.root.position.set(0, -PHONE.height / 2 + hop.y, 0);
      this.root.scale.set(...hop.scale);
      this.root.rotation.set(...hop.rotation);
    }

    const casingOpacity = this.xray ? XRAY_CASING_OPACITY : 1;
    for (const m of this.casing.materials) m.opacity = casingOpacity;
    for (const o of this.casing.outlines) o.visible = !this.xray;
    const screenScale = this.xray ? XRAY_SCREEN_OPACITY : 1;

    if (this.screen) {
      const o = screenOpacity(t) * screenScale;
      for (const m of this.screen.materials) m.opacity = o;
      this.screen.group.visible = o > 0;
    }

    if (this.face) {
      const o = faceOpacity(t) * screenScale;
      const open = eyeOpenness(t);
      for (const m of this.face.materials) m.opacity = o;
      this.face.group.visible = o > 0;
      for (const eye of this.face.eyes) {
        eye.open.scale.set(1, Math.max(0.001, open), 1);
        eye.open.visible = open > 0.08;
        eye.closed.visible = open <= 0.08;
      }
      // Pupils glance toward the default camera once the eyes are open.
      const glance = Math.min(1, open);
      for (const p of this.face.pupils) p.position.set(0.07 * glance, 0.05 * glance, 0);
      const smile = smileAmount(t);
      this.face.smile.scale.set(0.4 + 0.6 * smile, 0.3 + 0.7 * smile, 1);
    }

    this.sparkles.forEach((s, i) => {
      const k = sparkleScale(t, i, this.sparkles.length);
      s.visible = k > 0;
      s.scale.setScalar(Math.max(0.0001, k * s.userData.size));
      s.rotation.z = (1 - Math.min(1, k)) * 1.5;
    });
  }

  getState(time: number) {
    return iphoneState(this.data.components, time);
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    const component = this.data.components.find((c) => c.id === id);
    if (!component) return null;
    return {
      id: component.id,
      name: component.name,
      description: component.description,
      category: "component",
      properties: component.properties,
    };
  }

  getAvailableFilters(): VisualizationFilter[] {
    return FILTERS;
  }

  /**
   * Flips the casing's blending only when X-ray changes; setTime sets the
   * opacity. The casing also stops catching hover rays, so hovering in X-ray
   * names the part inside.
   */
  setFilters(state: FilterState): void {
    const xray = state.xray === true;
    if (xray === this.xray) return;
    this.xray = xray;
    for (const m of this.casing.materials) {
      m.transparent = xray;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    }
    for (const mesh of this.casing.meshes) mesh.raycast = xray ? NO_RAYCAST : THREE.Mesh.prototype.raycast;
  }

  getCameraPresets(): CameraPreset[] {
    return CAMERA_PRESETS;
  }

  cameraDistanceScale(time: number): number {
    return cameraDistanceScale(time);
  }

  reset(): void {
    this.setTime(0);
  }

  dispose(): void {
    if (this.context) {
      for (const part of this.parts.values()) this.context.unregisterHoverable(part);
    }
    this.screen?.texture.dispose();
    if (this.root) disposeObject(this.root);
    if (this.lights) disposeObject(this.lights);
    this.parts.clear();
    this.sparkles = [];
    this.casing = { meshes: [], materials: [], outlines: [] };
    this.screen = null;
    this.face = null;
    this.root = null;
    this.lights = null;
    this.context = null;
  }

  /** The casing's own toon surfaces and ink hulls. The screen and face keep their own opacity in setTime. */
  private collectCasing(): Casing {
    const casing: Casing = { meshes: [], materials: [], outlines: [] };
    for (const id of CASING) {
      this.parts.get(id)?.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        if (o.name === "outline") {
          casing.outlines.push(o);
          return;
        }
        casing.meshes.push(o);
        if (o.material instanceof THREE.MeshToonMaterial) casing.materials.push(o.material);
      });
    }
    return casing;
  }
}

export const iphoneExperience: FourDExperience = new IPhoneExperienceImpl();
