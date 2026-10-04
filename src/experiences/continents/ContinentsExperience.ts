// src/experiences/continents/ContinentsExperience.ts
//
// Continental drift on a cartoon globe, from Pangaea 250 million years ago
// to today. Every block is built once from its present-day outline; setTime
// only turns each block to its reconstructed orientation, grows or wears
// down the mountains, freezes the poles, and moves the ocean names. A
// filter overlays today's coastlines, so you can see how far each block has
// still to go.

import * as THREE from "three";
import { isFilterOn } from "../../core/filters";
import { linearMapping } from "../../core/mappings";
import { YEAR_SECONDS } from "../../core/timescale";
import { THEME, addOutline, disposeObject, makeToonMaterial } from "../../core/theme";
import { eventAt } from "../../core/Timeline";
import type {
  CameraPreset,
  ExperienceFilters,
  FilterState,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import { BLOCKS, EVENTS, MAP_LABELS, RANGES, type BlockDef, type Profile } from "./continentsData";
import {
  OLDEST_MA,
  continentsStateAt,
  formatLatitude,
  formatMa,
  formatSpeed,
  labelPosition,
  maAt,
  profileAt,
  rotationAt,
  type ContinentsState,
} from "./ContinentsState";
import {
  coastlineGhosts,
  equatorRing,
  inkMaterial,
  labelSprite,
  landGeometry,
  oceanMesh,
  peakGeometry,
  samplePath,
} from "./globeModel";
import { GREATER_INDIA, OUTLINES } from "./outlines";
import { toVec } from "./sphere";

const TICKS = [250, 200, 150, 100, 50, 0].map((ma) => ({
  u: 1 - ma / OLDEST_MA,
  label: ma === 0 ? "Today" : `${ma}M yrs`,
}));

/** Aim a little below the centre so the globe sits above the timeline panel. */
const TARGET = new THREE.Vector3(0, -0.18, 0);

function view(id: string, name: string, lon: number, lat: number): CameraPreset {
  const p = toVec([lon, lat]).multiplyScalar(4.4).add(TARGET);
  return { id, name, position: [p.x, p.y, p.z], target: [TARGET.x, TARGET.y, TARGET.z] };
}

export const CAMERA_PRESETS: CameraPreset[] = [
  view("atlantic", "Atlantic", -10, 14),
  view("indian", "Indian Ocean", 72, -12),
  view("pacific", "Pacific", -160, 8),
  view("south-pole", "South Pole", 30, -78),
];

const FILTERS: VisualizationFilter[] = [
  {
    id: "today-coastlines",
    name: "Today's coastlines",
    defaultOn: false,
    description: "Dashed outlines of where the continents sit today",
  },
];

const toward = new THREE.Vector3();
const eye = new THREE.Vector3();
const ICE = new THREE.Color("#F7F4EC");
const ICE_WALL = new THREE.Color("#C9D8DC");
const PEAK = "#A98467";
const SNOW = THEME.cream;

interface BlockView {
  def: BlockDef;
  group: THREE.Group;
  top: THREE.MeshToonMaterial;
  wall: THREE.MeshToonMaterial;
  land: THREE.Color;
  wallColor: THREE.Color;
}

interface Peak {
  mesh: THREE.Mesh;
  growth: Profile;
  width: number;
  height: number;
}

class ContinentsExperienceImpl implements FourDExperience {
  id = "continents" as const;
  name = "Continental drift";

  minTime = -OLDEST_MA;
  maxTime = 0;
  mapping = linearMapping(-OLDEST_MA, 0, formatMa, TICKS);
  baseDurationSeconds = 40;
  warpPresets = [0.25, 0.5, 1, 2, 4];
  elapsedSpanSeconds = (this.maxTime - this.minTime) * 1e6 * YEAR_SECONDS;
  labels = { start: "Pangaea", end: "Today" };
  events: TimelineEvent[] = EVENTS;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private ocean: THREE.Mesh | null = null;
  private light: THREE.DirectionalLight | null = null;
  private addedCamera = false;
  private blocks: BlockView[] = [];
  private peaks: Peak[] = [];
  private labelSprites = new Map<string, THREE.Sprite>();
  private ghosts: THREE.Group | null = null;
  private filterState: FilterState = {};

  filters: ExperienceFilters = {
    options: FILTERS,
    set: (state: FilterState) => {
      this.filterState = state;
    },
  };
  private time = -OLDEST_MA;

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    const root = new THREE.Group();
    root.name = "continents";
    this.root = root;

    root.add(new THREE.HemisphereLight("#FFF6E8", "#D9C3A5", 1.3));
    // The key light rides with the camera so every preset sees a lit face.
    this.light = new THREE.DirectionalLight(THEME.sunlight, 2.1);
    this.light.position.set(-2.5, 3, 4);
    if (!ctx.camera.parent) {
      ctx.scene.add(ctx.camera);
      this.addedCamera = true;
    }
    ctx.camera.add(this.light);

    this.ocean = oceanMesh();
    root.add(this.ocean, equatorRing());
    ctx.registerHoverable(this.ocean, "ocean");

    const peakGeo = peakGeometry();
    const peakMaterials = [makeToonMaterial(PEAK), makeToonMaterial(SNOW)];
    let peakOutline: THREE.Material | null = null;

    for (const def of BLOCKS) {
      const group = new THREE.Group();
      group.name = def.id;
      const land = new THREE.Color(def.color);
      const wallColor = land.clone().multiplyScalar(0.72);
      const top = makeToonMaterial(land);
      const wall = makeToonMaterial(wallColor);
      const mesh = new THREE.Mesh(landGeometry(OUTLINES[def.id], def.height), [top, wall, inkMaterial()]);
      group.add(mesh);
      if (def.id === "india") {
        // Paler, so today's familiar India still reads inside the bigger landmass.
        const lost = land.clone().lerp(new THREE.Color(THEME.cream), 0.45);
        const materials = [makeToonMaterial(lost), makeToonMaterial(lost.clone().multiplyScalar(0.72)), inkMaterial()];
        group.add(new THREE.Mesh(landGeometry(GREATER_INDIA, def.height), materials));
      }
      root.add(group);
      ctx.registerHoverable(group, def.id);
      this.blocks.push({ def, group, top, wall, land, wallColor });
    }

    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const up = new THREE.Vector3(0, 1, 0);
    for (const range of RANGES) {
      const block = this.blocks.find((b) => b.def.id === range.block)!;
      for (const p of samplePath(range.path, 0.036)) {
        // Nudge peaks off the ridge line so a range reads as a cluster, not a string of beads.
        p.add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(p).setLength(0.012 * rand())).normalize();
        const mesh = new THREE.Mesh(peakGeo, peakMaterials);
        mesh.position.copy(p).multiplyScalar(1 + block.def.height - 0.003);
        mesh.quaternion.setFromUnitVectors(up, p).multiply(new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI));
        if (peakOutline) {
          const hull = new THREE.Mesh(peakGeo, peakOutline);
          hull.raycast = () => {};
          mesh.add(hull);
        } else {
          peakOutline = addOutline(mesh, 0.12).material as THREE.Material;
        }
        block.group.add(mesh);
        const size = 0.8 + 0.4 * rand();
        this.peaks.push({ mesh, growth: range.growth, width: range.height * 0.9 * size, height: range.height * size });
      }
    }

    for (const def of MAP_LABELS) {
      const sprite = labelSprite(def.text, def.kind);
      sprite.renderOrder = 2;
      // Fade names as they turn toward the limb, so none is cut in half by the globe.
      sprite.onBeforeRender = (_renderer, _scene, camera) => {
        const facing = toward.copy(sprite.position).normalize().dot(eye.copy(camera.position).normalize());
        sprite.material.opacity = sprite.userData.opacity * THREE.MathUtils.smoothstep(facing, 0.25, 0.55);
      };
      root.add(sprite);
      this.labelSprites.set(def.id, sprite);
    }

    this.ghosts = coastlineGhosts(BLOCKS.flatMap((b) => OUTLINES[b.id]));
    root.add(this.ghosts);

    ctx.scene.add(root);
    this.setTime(this.time);
  }

  setTime(time: number): void {
    this.time = time;
    if (!this.root) return;
    // Writes straight into scene objects so playback allocates nothing; getState builds the same values as plain data.
    const ma = maAt(time);
    if (this.ghosts) this.ghosts.visible = isFilterOn(FILTERS, this.filterState, "today-coastlines");
    for (const view of this.blocks) {
      rotationAt(view.def.id, ma, view.group.quaternion);
      const ice = view.def.ice ? profileAt(view.def.ice, ma) : 0;
      view.top.color.copy(view.land).lerp(ICE, ice);
      view.wall.color.copy(view.wallColor).lerp(ICE_WALL, ice);
    }
    for (const peak of this.peaks) {
      const g = profileAt(peak.growth, ma);
      peak.mesh.visible = g > 0.01;
      peak.mesh.scale.set(peak.width * (0.6 + 0.4 * g), peak.height * g, peak.width * (0.6 + 0.4 * g));
    }
    for (const def of MAP_LABELS) {
      const sprite = this.labelSprites.get(def.id)!;
      const opacity = profileAt(def.opacity, ma);
      labelPosition(def.anchor, ma, sprite.position).multiplyScalar(1.07);
      sprite.userData.opacity = opacity;
      sprite.visible = opacity > 0.01;
    }
  }

  getState(time: number): ContinentsState {
    return continentsStateAt(time);
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    const ma = maAt(this.time);
    const state = continentsStateAt(this.time);
    if (id === "ocean") {
      // The card keeps the ocean's old name exactly as long as the map label still shows it.
      const panthalassa = state.labels.find((l) => l.id === "panthalassa")!.opacity > 0.01;
      return {
        id,
        name: panthalassa ? "Panthalassa" : "Ocean",
        description: panthalassa
          ? "One ocean covers most of the planet. Its floor has long since sunk back into the mantle."
          : "New ocean floor is made at mid-ocean ridges and sinks back into the mantle at trenches.",
        properties: { "Oldest ocean floor today": "about 180 million years" },
      };
    }
    const def = BLOCKS.find((b) => b.id === id);
    if (!def) return null;
    const block = state.blocks.find((b) => b.id === id)!;
    const story = [...def.story].reverse().find(([from]) => ma <= from) ?? def.story[0];
    return {
      id,
      name: def.name,
      description: story[1],
      category: "plate",
      properties: { "Centre latitude": formatLatitude(block.centre.lat), Speed: formatSpeed(block.speed) },
    };
  }

  getCameraPresets(): CameraPreset[] {
    return CAMERA_PRESETS;
  }

  reset(): void {
    this.setTime(this.minTime);
  }

  dispose(): void {
    if (this.ctx) {
      for (const b of this.blocks) this.ctx.unregisterHoverable(b.group);
      if (this.ocean) this.ctx.unregisterHoverable(this.ocean);
      if (this.light) {
        disposeObject(this.light);
        this.light.dispose();
      }
      if (this.addedCamera) this.ctx.scene.remove(this.ctx.camera);
    }
    for (const sprite of this.labelSprites.values()) sprite.material.map?.dispose();
    if (this.root) disposeObject(this.root);
    this.blocks = [];
    this.peaks = [];
    this.labelSprites.clear();
    this.ghosts = null;
    this.root = null;
    this.ocean = null;
    this.light = null;
    this.addedCamera = false;
    this.ctx = null;
    this.time = -OLDEST_MA;
  }
}

export const continentsExperience: FourDExperience = new ContinentsExperienceImpl();
