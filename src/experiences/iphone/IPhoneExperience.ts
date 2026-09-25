// src/experiences/iphone/IPhoneExperience.ts
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { linearMapping } from "../../core/mappings";
import type {
  CameraPreset,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import { componentPose, iphoneState } from "./IPhoneState";
import { IPHONE_DATA_FALLBACK, loadIPhoneData, type IPhoneData } from "./iphoneData";

function formatProgress(t: number): string {
  return `${Math.round(t * 100)}%`;
}

const MAPPING_TICKS = [
  { u: 0, label: "Exploded" },
  { u: 0.25, label: "" },
  { u: 0.5, label: "Halfway" },
  { u: 0.75, label: "" },
  { u: 1, label: "Assembled" },
];

const CAMERA_PRESETS: CameraPreset[] = [{ id: "front", name: "Front", position: [0, 0.9, 6.6], target: [0, 0, 0] }];

// Per-component material tuning (metalness/roughness) keyed by component id.
// Colours themselves live in the JSON/fallback data; this only controls how
// each material reacts to light so materials that would otherwise look like
// flat plastic instead read as aluminium, glass, PCB, etc.
const MATERIAL_PARAMS: Record<string, { metalness: number; roughness: number }> = {
  frame: { metalness: 0.7, roughness: 0.35 },
  battery: { metalness: 0.25, roughness: 0.6 },
  "logic-board": { metalness: 0.2, roughness: 0.5 },
  "main-camera": { metalness: 0.5, roughness: 0.3 },
  speaker: { metalness: 0.4, roughness: 0.5 },
  display: { metalness: 0.35, roughness: 0.2 },
};
const DEFAULT_MATERIAL_PARAMS = { metalness: 0.3, roughness: 0.5 };

class IPhoneExperienceImpl implements FourDExperience {
  id = "iphone" as const;
  name = "iPhone";

  minTime = 0;
  maxTime = 1;
  mapping = linearMapping(0, 1, formatProgress, MAPPING_TICKS);
  baseDurationSeconds = 10;
  warpPresets = [0.25, 0.5, 1, 2, 4];
  labels = { start: "Exploded", end: "Assembled" };
  // No events for the iPhone per CONTRACT.md's Arjun prompt: getCurrentEvent
  // always returns null. The "What's happening?" panel falls back to a
  // generic hint in InfoPanel.tsx when events is empty.
  events: TimelineEvent[] = [];

  private data: IPhoneData = IPHONE_DATA_FALLBACK;
  private meshes = new Map<string, THREE.Mesh>();
  private lights: THREE.Light[] = [];
  private context: SceneContext | null = null;

  mount(context: SceneContext): void {
    this.context = context;
    this.data = IPHONE_DATA_FALLBACK;

    for (const component of this.data.components) {
      const [w, h, d] = component.assembled.size;
      const radius = Math.min(w, h, d) * 0.3;
      const geometry = new RoundedBoxGeometry(w, h, d, 3, radius);
      const params = MATERIAL_PARAMS[component.id] ?? DEFAULT_MATERIAL_PARAMS;
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(component.assembled.color),
        metalness: params.metalness,
        roughness: params.roughness,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.id = component.id;
      mesh.name = component.id;
      this.meshes.set(component.id, mesh);
      context.scene.add(mesh);
      context.registerHoverable(mesh, component.id);
    }

    const directional = new THREE.DirectionalLight(0xffffff, 2.5);
    directional.position.set(4, 6, 6);
    context.scene.add(directional);
    this.lights.push(directional);

    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-5, 2, -4);
    context.scene.add(fill);
    this.lights.push(fill);

    const hemisphere = new THREE.HemisphereLight(0x9fb4d8, 0x2a2a30, 1.2);
    context.scene.add(hemisphere);
    this.lights.push(hemisphere);

    this.setTime(0);

    // Best-effort validation of the public JSON; geometry already mounted
    // from the fallback so setTime stays pure and synchronous regardless.
    loadIPhoneData().catch(() => {
      /* network/build-time issues are non-fatal; fallback data already drives the scene */
    });
  }

  setTime(time: number): void {
    for (const component of this.data.components) {
      const mesh = this.meshes.get(component.id);
      if (!mesh) continue;
      const pose = componentPose(component, time);
      mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
      mesh.quaternion.set(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3]);
    }
  }

  getState(time: number) {
    return iphoneState(this.data.components, time);
  }

  getCurrentEvent(): TimelineEvent | null {
    // No events for the iPhone per CONTRACT.md's Arjun prompt.
    return null;
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
    return [];
  }

  getCameraPresets(): CameraPreset[] {
    return CAMERA_PRESETS;
  }

  reset(): void {
    this.setTime(0);
  }

  dispose(): void {
    if (this.context) {
      for (const mesh of this.meshes.values()) {
        this.context.unregisterHoverable(mesh);
        this.context.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      for (const light of this.lights) {
        this.context.scene.remove(light);
      }
    }
    this.meshes.clear();
    this.lights = [];
    this.context = null;
  }
}

export const iphoneExperience: FourDExperience = new IPhoneExperienceImpl();
