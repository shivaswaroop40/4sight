// src/experiences/keyframe/KeyframeExperience.ts
//
// A FourDExperience driven entirely by a scene definition. mount builds one
// node per object from the primitive table, setTime applies sampleScene's
// poses, and everything else (events, presets, hover text, mapping) is read
// from the definition. A new scenario is a JSON file plus one line:
//
//   export const fooExperience = keyframeExperience("foo", fooJson);
//
// See types.ts for the data shape and parse.ts for the authoring format.

import * as THREE from "three";
import { addOutline, addWarmLights, disposeObject, makeToonMaterial } from "../../core/theme";
import { eventAt } from "../../core/Timeline";
import type {
  CameraPreset,
  ExperienceId,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimeMapping,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import { mappingFor } from "./mapping";
import { parseScene } from "./parse";
import { buildGeometry, hullGeometry } from "./primitives";
import { cameraDistanceScaleAt, hoverDescription, sampleNumber, sampleScene } from "./sample";
import type { SceneDef, SceneObjectDef, SceneSample } from "./types";

type SurfaceMaterial = THREE.MeshToonMaterial | THREE.MeshBasicMaterial;

interface ObjectView {
  def: SceneObjectDef;
  node: THREE.Object3D;
  material: SurfaceMaterial | null;
  hull: THREE.MeshBasicMaterial | null;
  /** The object's fullest opacity; the outline fades relative to it so see-through shells keep solid ink. */
  peakOpacity: number;
  dynamicColor: boolean;
}

const DEG = Math.PI / 180;

/**
 * A see-through shell wraps the things you can see inside it, so it must not
 * steal the pointer from them. Its ray hits are pushed far back: anything
 * solid under the pointer wins, and among shells the inner layers (lower
 * renderOrder) win over the outer ones.
 */
function seeThroughForHover(mesh: THREE.Mesh, renderOrder: number): void {
  const raycast = mesh.raycast.bind(mesh);
  mesh.raycast = (raycaster, hits) => {
    const first = hits.length;
    raycast(raycaster, hits);
    for (let i = first; i < hits.length; i++) hits[i].distance += 1e6 * (1 + renderOrder);
  };
}

export class KeyframeExperience implements FourDExperience {
  readonly id: ExperienceId;
  readonly name: string;
  readonly minTime: number;
  readonly maxTime: number;
  readonly mapping: TimeMapping;
  readonly baseDurationSeconds: number;
  readonly warpPresets: number[];
  readonly elapsedSpanSeconds?: number;
  readonly labels: { start: string; end: string };
  readonly events: TimelineEvent[];
  readonly def: SceneDef;
  /** Present only when the scene authors one, so the renderer keeps its default otherwise. */
  readonly cameraSubjectAspect?: (time: number) => number;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private lights: THREE.Group | null = null;
  private views: ObjectView[] = [];
  private hoverables: THREE.Object3D[] = [];
  private resources = new Set<{ dispose(): void }>();
  private depthMaterial: THREE.MeshBasicMaterial | null = null;
  private currentTime: number;

  constructor(id: ExperienceId, def: SceneDef) {
    this.id = id;
    this.def = def;
    this.name = def.name;
    this.minTime = def.minTime;
    this.maxTime = def.maxTime;
    this.mapping = mappingFor(def);
    this.baseDurationSeconds = def.baseDurationSeconds;
    this.warpPresets = def.warpPresets;
    if (def.secondsPerUnit !== undefined) this.elapsedSpanSeconds = (def.maxTime - def.minTime) * def.secondsPerUnit;
    this.labels = def.labels;
    this.events = def.events;
    this.currentTime = def.minTime;
    const aspect = def.cameraSubjectAspect;
    if (aspect.length > 0) this.cameraSubjectAspect = (time) => sampleNumber(aspect, time);
  }

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    this.lights = addWarmLights(ctx.scene);
    const root = new THREE.Group();
    root.name = this.def.id;
    this.root = root;

    const geometries = new Map<string, { surface: THREE.BufferGeometry; hull: THREE.BufferGeometry } | null>();
    const staticMaterials = new Map<string, SurfaceMaterial>();
    const nodes = new Map<string, THREE.Object3D>();

    for (const def of this.def.objects) {
      const geometryKey = `${def.primitive}:${JSON.stringify(def.params)}`;
      if (!geometries.has(geometryKey)) {
        const surface = buildGeometry(def.primitive, def.params);
        geometries.set(geometryKey, surface ? { surface, hull: hullGeometry(def.primitive, surface) } : null);
        if (surface) this.resources.add(surface);
      }
      const geometry = geometries.get(geometryKey)!;

      const view: ObjectView = {
        def,
        node: new THREE.Group(),
        material: null,
        hull: null,
        peakOpacity: Math.max(...def.tracks.opacity.map((k) => k.v)),
        dynamicColor: def.tracks.color.length > 1,
      };
      view.node.name = def.id;

      if (geometry) {
        const material = this.material(def, staticMaterials);
        view.material = material;
        const mesh = new THREE.Mesh(geometry.surface, material);
        view.node.add(mesh);
        // See-through objects draw in three passes per renderOrder layer:
        // depth of every shell in the layer, then their tint, then their
        // hulls. Overlapping shells in one layer then tint each pixel once
        // and read as a single merged volume, and the hulls, depth-tested
        // against the front faces, show only the outer silhouette instead
        // of a dark disc behind the glass.
        if (def.transparent) {
          const depth = new THREE.Mesh(geometry.surface, this.depthOnly());
          depth.renderOrder = 3 * def.renderOrder;
          view.node.add(depth);
          mesh.renderOrder = 3 * def.renderOrder + 1;
          seeThroughForHover(mesh, def.renderOrder);
        }
        if (def.outline > 0) {
          const hull = addOutline(mesh, def.outline);
          hull.geometry = geometry.hull;
          this.resources.add(geometry.hull);
          const hullMaterial = hull.material as THREE.MeshBasicMaterial;
          this.resources.add(hullMaterial);
          if (def.transparent) {
            hullMaterial.transparent = true;
            hull.renderOrder = 3 * def.renderOrder + 2;
          }
          view.hull = hullMaterial;
        }
        if (def.hover) {
          ctx.registerHoverable(mesh, def.hover);
          this.hoverables.push(mesh);
        }
      }

      (def.parent ? nodes.get(def.parent)! : root).add(view.node);
      nodes.set(def.id, view.node);
      this.views.push(view);
    }

    ctx.scene.add(root);
    this.setTime(this.currentTime);
  }

  private material(def: SceneObjectDef, shared: Map<string, SurfaceMaterial>): SurfaceMaterial {
    const [r, g, b] = def.tracks.color[0].v;
    const color = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    const key = `${def.shading}:${color.getHexString()}`;
    const reusable = !def.transparent && def.tracks.color.length === 1;
    if (reusable && shared.has(key)) return shared.get(key)!;
    const material =
      def.shading === "flat" ? new THREE.MeshBasicMaterial({ color }) : makeToonMaterial(color);
    if (def.transparent) {
      material.transparent = true;
      material.depthWrite = false;
    }
    if (reusable) shared.set(key, material);
    this.resources.add(material);
    return material;
  }

  private depthOnly(): THREE.MeshBasicMaterial {
    if (!this.depthMaterial) {
      this.depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
      this.resources.add(this.depthMaterial);
    }
    return this.depthMaterial;
  }

  setTime(time: number): void {
    this.currentTime = time;
    if (!this.root) return;
    const sample = sampleScene(this.def, time);
    sample.objects.forEach((pose, i) => {
      const view = this.views[i];
      const { node } = view;
      node.visible = pose.visible;
      if (!pose.visible) return;
      node.position.set(...pose.position);
      node.rotation.set(pose.rotation[0] * DEG, pose.rotation[1] * DEG, pose.rotation[2] * DEG);
      node.scale.set(...pose.scale);
      if (view.dynamicColor && view.material) {
        view.material.color.setRGB(pose.color[0], pose.color[1], pose.color[2], THREE.SRGBColorSpace);
      }
      if (view.def.transparent) {
        if (view.material) view.material.opacity = pose.opacity;
        if (view.hull) view.hull.opacity = Math.min(1, pose.opacity / view.peakOpacity);
      }
    });
  }

  getState(time: number): SceneSample {
    return sampleScene(this.def, time);
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    if (!Object.hasOwn(this.def.hover, id)) return null;
    const hover = this.def.hover[id];
    const meta: ObjectMetadata = { id, name: hover.name, description: hoverDescription(hover, this.currentTime) };
    if (hover.category) meta.category = hover.category;
    if (hover.properties) meta.properties = hover.properties;
    return meta;
  }

  getAvailableFilters(): VisualizationFilter[] {
    return [];
  }

  getCameraPresets(): CameraPreset[] {
    return this.def.cameraPresets;
  }

  cameraDistanceScale(time: number): number {
    return cameraDistanceScaleAt(this.def, time);
  }

  reset(): void {
    this.setTime(this.minTime);
  }

  dispose(): void {
    if (this.ctx) for (const mesh of this.hoverables) this.ctx.unregisterHoverable(mesh);
    this.root?.removeFromParent();
    for (const r of this.resources) r.dispose();
    if (this.lights) disposeObject(this.lights);
    this.resources.clear();
    this.depthMaterial = null;
    this.hoverables = [];
    this.views = [];
    this.root = null;
    this.lights = null;
    this.ctx = null;
    this.currentTime = this.minTime;
  }
}

/** Parses scene JSON and wraps it as an experience. Throws SceneParseError on bad data, at import time. */
export function keyframeExperience(id: ExperienceId, json: unknown): KeyframeExperience {
  const def = parseScene(json);
  if (def.id !== id) throw new Error(`scene id "${def.id}" does not match experience id "${id}"`);
  return new KeyframeExperience(id, def);
}
