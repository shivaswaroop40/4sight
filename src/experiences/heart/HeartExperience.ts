// src/experiences/heart/HeartExperience.ts
//
// One heartbeat in slow motion: a cartoon cutaway heart whose chambers
// squeeze in order, valves snap shut on the lub and the dub, blood flows
// blue in and out the right side and red through the left, and the
// electrical spark travels SA node -> AV node -> His -> Purkinje while a live
// ECG draws itself underneath. setTime rebuilds all of it from t. Two
// filters hide the electrical signal and the blood-flow arrows.

import * as THREE from "three";
import { isFilterOn } from "../../core/filters";
import { smoothstep, window as windowFn } from "../../core/interpolate";
import { THEME, addWarmLights, disposeObject } from "../../core/theme";
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
import {
  BEAT_MS,
  VALVE_KIND,
  atrialWave,
  avGlow,
  clampBeat,
  ecg,
  heartSound,
  heartState,
  saGlow,
  valveOpenness,
  ventricularWave,
  wire,
  type ChamberId,
  type ConductionId,
  type ValveId,
} from "./heartCycle";
import { CAMERA_PRESETS, EVENTS, HEART_MAPPING, hoverCard } from "./heartData";
import { PARCELS_PER_SIDE, parcelsAt } from "./heartFlow";
import {
  AV_NODE,
  DUB_ANCHOR,
  LUB_ANCHOR,
  POOLS,
  SA_NODE,
  VALVES,
  VALVE_Z,
  WIRE_Z,
  LABEL_Z,
  deform,
  deformParams,
  poolShrink,
  shrinkPoint,
} from "./heartLayout";
import {
  ECG_PANEL,
  ECG_PLOT,
  HEART_COLORS,
  buildBody,
  buildNode,
  buildPool,
  buildValve,
  buildVessels,
  buildWire,
  burstTexture,
  chevronGeometry,
  createDeformUniforms,
  ecgPaperTexture,
  ecgPanelMesh,
  ecgTraceGeometry,
  glowTexture,
  repaint,
  textTexture,
  DISPLAY_FONT_PROBE,
  type DeformUniforms,
  type HeartBody,
  type Pool,
  type ValveView,
  type WireView,
} from "./heartModel";

/** Below the heart, framed by the presets. */
const ECG_POSITION = new THREE.Vector3(0.25, -4.4, 0.6);
const ECG_SCALE = 1.2;
const WIRE_IDS: ConductionId[] = ["internodal", "his", "bundleBranches", "purkinje"];
const VALVE_IDS: ValveId[] = ["tricuspid", "pulmonary", "mitral", "aortic"];
const CHAMBER_IDS: ChamberId[] = ["rightAtrium", "rightVentricle", "leftAtrium", "leftVentricle"];
const FILTERS: VisualizationFilter[] = [
  {
    id: "electrical",
    name: "Electrical signal",
    defaultOn: true,
    description: "The spark from the SA node down to the ventricle walls",
  },
  { id: "blood-flow", name: "Blood flow", defaultOn: true, description: "Arrows of blood moving through the heart" },
];
const OXY_FLOW = new THREE.Color(HEART_COLORS.oxyFlow);
const DEOXY_FLOW = new THREE.Color(HEART_COLORS.deoxyFlow);

/** Leaflet angle (radians, left leaflet) when shut and when wide open. */
const LEAFLET_ANGLE = {
  av: { shut: 0.12, open: -1.3 },
  semilunar: { shut: -0.42, open: 1.32 },
} as const;

interface Label {
  mesh: THREE.Mesh;
  /** Experience time at which the label pops in. */
  at: number;
}

class HeartExperience implements FourDExperience {
  id = "heart" as const;
  name = "Heartbeat";

  minTime = 0;
  maxTime = BEAT_MS;
  mapping = HEART_MAPPING;
  /** 0.8 s of life over 10 s of screen: 12.5 times slower than real. */
  baseDurationSeconds = 10;
  warpPresets = [0.25, 0.5, 1, 2, 4, 8];
  labels = { start: "Spark", end: "Next beat" };
  events: TimelineEvent[] = EVENTS;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private lights: THREE.Group | null = null;
  private readonly deformUniforms: DeformUniforms = createDeformUniforms();
  private body: HeartBody | null = null;
  private pools: Pool[] = [];
  private valves: ValveView[] = [];
  private valveProxies = new Map<ValveId, THREE.Mesh>();
  private wires: WireView[] = [];
  private sparks = new Map<ConductionId, THREE.Sprite[]>();
  private saNode: THREE.Mesh | null = null;
  private avNode: THREE.Mesh | null = null;
  private saHalo: THREE.Sprite | null = null;
  private avHalo: THREE.Sprite | null = null;
  private flow: THREE.InstancedMesh | null = null;
  private electrical: THREE.Group | null = null;
  private filterState: FilterState = {};

  filters: ExperienceFilters = {
    options: FILTERS,
    set: (state: FilterState) => {
      this.filterState = state;
    },
  };
  private ecgTrace: THREE.Mesh | null = null;
  private ecgHead: THREE.Mesh | null = null;
  private ecgLabels: Label[] = [];
  private lub: THREE.Sprite | null = null;
  private dub: THREE.Sprite | null = null;
  private chamberLabels: { mesh: THREE.Mesh; pool: ChamberId }[] = [];
  private hoverables: THREE.Object3D[] = [];
  private textures: THREE.Texture[] = [];
  private time = 0;

  private readonly scratch = new THREE.Object3D();

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    this.lights = addWarmLights(ctx.scene);
    const root = new THREE.Group();
    root.name = "heartbeat";
    this.root = root;
    ctx.scene.add(root);

    const heart = new THREE.Group();
    heart.name = "heart";
    root.add(heart);
    const u = this.deformUniforms;

    this.body = buildBody(u);
    heart.add(this.body.mesh);
    this.hover(this.body.mesh, "heartWall");

    for (const vessel of buildVessels(u)) {
      heart.add(vessel.mesh);
      this.hover(vessel.mesh, vessel.vessel);
    }

    for (const id of CHAMBER_IDS) {
      const pool = buildPool(id, POOLS[id], u, POOLS[id].band === "ventricle" ? 1 : 0);
      this.pools.push(pool);
      heart.add(pool.group);
      this.hover(pool.fill, id);
      const { texture, aspect } = textTexture(POOLS[id].label.text, { size: 64, color: THEME.cream, stroke: THEME.ink });
      const height = 0.7;
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(height * aspect, height),
        new THREE.MeshBasicMaterial({ map: this.track(texture), transparent: true, depthWrite: false }),
      );
      label.raycast = () => {};
      label.renderOrder = 3;
      heart.add(label);
      this.chamberLabels.push({ mesh: label, pool: id });
    }

    for (const id of VALVE_IDS) {
      const def = VALVES[id];
      const width = Math.hypot(def.right[0] - def.left[0], def.right[1] - def.left[1]);
      const view = buildValve(id, width);
      this.valves.push(view);
      heart.add(view.group);
      const proxy = new THREE.Mesh(new THREE.CircleGeometry(width * 0.55, 20), new THREE.MeshBasicMaterial());
      proxy.visible = false;
      heart.add(proxy);
      this.valveProxies.set(id, proxy);
      this.hover(proxy, id);
    }

    const glow = this.track(glowTexture());
    const sprite = (scale: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, depthWrite: false, transparent: true }));
      s.scale.setScalar(scale);
      s.renderOrder = 2;
      return s;
    };

    // One group, so the filter hides the nodes from hover too.
    const electrical = new THREE.Group();
    electrical.name = "electrical";
    heart.add(electrical);
    this.electrical = electrical;
    for (const id of WIRE_IDS) {
      const view = buildWire(id, u);
      this.wires.push(view);
      for (const m of view.meshes) electrical.add(m);
      const heads = view.curves.map(() => sprite(0.42));
      for (const h of heads) electrical.add(h);
      this.sparks.set(id, heads);
    }

    this.saNode = buildNode(0.12);
    this.avNode = buildNode(0.1);
    this.saHalo = sprite(1.1);
    this.avHalo = sprite(0.9);
    electrical.add(this.saNode, this.avNode, this.saHalo, this.avHalo);
    this.hover(this.saNode, "saNode");
    this.hover(this.avNode, "avNode");

    const capacity = PARCELS_PER_SIDE * 2;
    this.flow = new THREE.InstancedMesh(chevronGeometry(0.1), new THREE.MeshBasicMaterial(), capacity);
    this.flow.name = "blood-flow";
    this.flow.raycast = () => {};
    this.flow.frustumCulled = false;
    this.flow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    heart.add(this.flow);
    // Allocates the per-instance colour buffer before the first frame.
    this.flow.setColorAt(0, OXY_FLOW);

    this.buildEcg(root);
    this.buildBursts(heart);
    document.fonts
      ?.load(DISPLAY_FONT_PROBE)
      .then(() => {
        if (this.root === root) this.textures.forEach(repaint);
      })
      .catch(() => {});

    this.setTime(0);
  }

  private hover(object: THREE.Object3D, id: string): void {
    this.ctx?.registerHoverable(object, id);
    this.hoverables.push(object);
  }

  private track<T extends THREE.Texture>(texture: T): T {
    this.textures.push(texture);
    return texture;
  }

  private buildEcg(root: THREE.Group): void {
    const group = new THREE.Group();
    group.name = "ecg";
    group.position.copy(ECG_POSITION);
    group.scale.setScalar(ECG_SCALE);
    root.add(group);

    const panel = ecgPanelMesh();
    panel.position.z = -0.1;
    // The strip turns to face the camera so it stays readable from the side
    // view. That is a view concern, not a time one, so it runs from the
    // panel's own render hook rather than in setTime. The panel draws before
    // its siblings so they render with the matrix this writes.
    panel.renderOrder = -1;
    panel.onBeforeRender = (_renderer, _scene, camera) => {
      group.quaternion.copy(camera.quaternion);
      group.updateMatrixWorld(true);
    };
    group.add(panel);
    this.hover(panel, "ecg");

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(ECG_PANEL.width, ECG_PANEL.height),
      new THREE.MeshBasicMaterial({ map: this.track(ecgPaperTexture()) }),
    );
    paper.position.z = -0.015;
    paper.raycast = () => {};
    group.add(paper);

    const samples = new Float32Array((BEAT_MS + 1) * 2);
    for (let t = 0; t <= BEAT_MS; t++) {
      samples[2 * t] = ecgX(t);
      samples[2 * t + 1] = ecgY(t);
    }
    this.ecgTrace = new THREE.Mesh(ecgTraceGeometry(samples, 0.022), new THREE.MeshBasicMaterial({ color: THEME.ink }));
    this.ecgTrace.raycast = () => {};
    group.add(this.ecgTrace);

    const head = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshBasicMaterial({ color: THEME.terracotta }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 24), new THREE.MeshBasicMaterial({ color: THEME.ink }));
    head.add(ring);
    head.position.z = 0.01;
    head.raycast = () => {};
    ring.raycast = () => {};
    group.add(head);
    this.ecgHead = head;

    const label = (text: string, at: number, x: number, y: number, size: number, opts: Parameters<typeof textTexture>[1] = {}) => {
      const { texture, aspect } = textTexture(text, opts);
      this.track(texture);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size * aspect, size),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
      );
      mesh.position.set(x, y, 0.02);
      mesh.raycast = () => {};
      group.add(mesh);
      this.ecgLabels.push({ mesh, at });
    };
    label("P", 45, ecgX(45), ecgY(45) + 0.24, 0.36, { color: THEME.plum });
    label("QRS", 190, ecgX(190) - 0.48, ecgY(190) - 0.12, 0.36, { color: THEME.plum });
    label("T", 470, ecgX(470), ecgY(470) + 0.24, 0.36, { color: THEME.plum });
    label("AV delay", 125, ecgX(125), ECG_PLOT.baseline - 0.25, 0.26, { color: THEME.inkSoft, weight: 600 });
    label("lub", 210, ecgX(210), ECG_PLOT.baseline - 0.5, 0.3, { pill: THEME.mustard, size: 80 });
    label("dub", 540, ecgX(540), ECG_PLOT.baseline - 0.5, 0.3, { pill: THEME.mustard, size: 80 });
  }

  private buildBursts(heart: THREE.Group): void {
    const make = (text: string, anchor: readonly [number, number, number]) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.track(burstTexture(text, THEME.mustard)), transparent: true, depthTest: false }),
      );
      s.position.set(...anchor);
      s.renderOrder = 5;
      heart.add(s);
      return s;
    };
    this.lub = make("LUB!", LUB_ANCHOR);
    this.dub = make("DUB!", DUB_ANCHOR);
  }

  setTime(time: number): void {
    const t = clampBeat(time);
    this.time = t;
    const params = deformParams(t);
    this.deformUniforms.uBaseShift.value = params.baseShift;
    this.deformUniforms.uVentSqueeze.value = params.ventSqueeze;
    this.deformUniforms.uAtrialSqueeze.value = params.atrialSqueeze;

    const electrical = isFilterOn(FILTERS, this.filterState, "electrical");
    if (this.electrical) this.electrical.visible = electrical;
    if (this.flow) this.flow.visible = isFilterOn(FILTERS, this.filterState, "blood-flow");

    if (this.body) {
      const a = atrialWave(t);
      const v = ventricularWave(t);
      const on = electrical ? 1 : 0;
      this.body.wave.uAtrialSpread.value = a.spread * on;
      this.body.wave.uAtrialTint.value = a.tint * on;
      this.body.wave.uVentSpread.value = v.spread * on;
      this.body.wave.uVentTint.value = v.tint * on;
    }

    for (const pool of this.pools) pool.uniforms.uPoolShrink.value = poolShrink(POOLS[pool.id].band, t);
    for (const { mesh, pool } of this.chamberLabels) {
      const def = POOLS[pool];
      const [x, y] = shrinkPoint(def.label.at[0], def.label.at[1], def, poolShrink(def.band, t));
      mesh.position.set(...deform(x, y, LABEL_Z, params));
    }

    for (const view of this.valves) {
      const def = VALVES[view.id];
      const angles = LEAFLET_ANGLE[VALVE_KIND[view.id]];
      const angle = angles.shut + (angles.open - angles.shut) * valveOpenness(view.id, t);
      const l = deform(def.left[0], def.left[1], VALVE_Z, params);
      const r = deform(def.right[0], def.right[1], VALVE_Z, params);
      view.left.position.set(...l);
      view.left.rotation.z = angle;
      view.right.position.set(...r);
      view.right.rotation.z = Math.PI - angle;
      this.valveProxies.get(view.id)?.position.set((l[0] + r[0]) / 2, (l[1] + r[1]) / 2, VALVE_Z + 0.02);
    }

    for (const view of this.wires) {
      const w = wire(view.id, t);
      view.uniforms.uProgress.value = w.progress;
      view.uniforms.uGlow.value = w.glow;
      const travelling = w.progress > 0 && w.progress < 1;
      const heads = this.sparks.get(view.id) ?? [];
      view.curves.forEach((curve, i) => {
        const head = heads[i];
        head.visible = travelling;
        if (!travelling) return;
        const p = curve.getPointAt(w.progress);
        head.position.set(...deform(p.x, p.y, WIRE_Z + 0.02, params));
      });
    }

    this.placeNode(this.saNode, this.saHalo, SA_NODE, saGlow(t), params);
    this.placeNode(this.avNode, this.avHalo, AV_NODE, avGlow(t), params);

    this.placeFlow(t);
    this.placeEcg(t);
    this.placeBursts(t);
  }

  private placeNode(
    node: THREE.Mesh | null,
    halo: THREE.Sprite | null,
    at: readonly [number, number],
    glow: number,
    params: ReturnType<typeof deformParams>,
  ): void {
    if (!node || !halo) return;
    const p = deform(at[0], at[1], WIRE_Z + 0.03, params);
    node.position.set(...p);
    node.scale.setScalar(1 + 0.35 * glow);
    halo.position.set(p[0], p[1], p[2] + 0.05);
    halo.visible = glow > 0.01;
    (halo.material as THREE.SpriteMaterial).opacity = glow;
  }

  private placeFlow(t: number): void {
    const flow = this.flow;
    if (!flow) return;
    const parcels = parcelsAt(t);
    parcels.forEach((p, i) => {
      this.scratch.position.set(p.position[0], p.position[1], p.position[2]);
      this.scratch.rotation.set(0, 0, p.angle);
      this.scratch.scale.setScalar(Math.max(0.0001, p.scale));
      this.scratch.updateMatrix();
      flow.setMatrixAt(i, this.scratch.matrix);
      flow.setColorAt(i, p.side === "left" ? OXY_FLOW : DEOXY_FLOW);
    });
    flow.count = parcels.length;
    flow.instanceMatrix.needsUpdate = true;
    if (flow.instanceColor) flow.instanceColor.needsUpdate = true;
  }

  private placeEcg(t: number): void {
    if (this.ecgTrace) this.ecgTrace.geometry.setDrawRange(0, Math.floor(t) * 6);
    if (this.ecgHead) this.ecgHead.position.set(ecgX(t), ecgY(t), 0.01);
    for (const label of this.ecgLabels) {
      const k = windowFn(t, label.at, label.at + 40);
      label.mesh.visible = k > 0;
      label.mesh.scale.setScalar(Math.max(0.0001, popIn(k)));
    }
  }

  private placeBursts(t: number): void {
    const sound = heartSound(t);
    const place = (sprite: THREE.Sprite | null, k: number, size: number) => {
      if (!sprite) return;
      sprite.visible = k > 0.01;
      sprite.scale.setScalar(size * (0.6 + 0.4 * popIn(Math.min(1, k * 1.2))));
      (sprite.material as THREE.SpriteMaterial).opacity = smoothstep(0, 0.35, k);
    };
    place(this.lub, sound.lub, 1.7);
    place(this.dub, sound.dub, 1.4);
  }

  getState(time: number) {
    const t = clampBeat(time);
    const parcels = parcelsAt(t);
    const count = (region: number) => parcels.filter((p) => p.region === region).length;
    return {
      ...heartState(t),
      ecgDrawnMs: Math.floor(t),
      blood: { vein: count(0), atrium: count(1), ventricle: count(2), artery: count(3) },
    };
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    return hoverCard(id, this.time);
  }

  getCameraPresets(): CameraPreset[] {
    return CAMERA_PRESETS;
  }

  reset(): void {
    this.setTime(0);
  }

  dispose(): void {
    const ctx = this.ctx;
    if (ctx) {
      for (const o of this.hoverables) ctx.unregisterHoverable(o);
    }
    for (const tex of this.textures) tex.dispose();
    if (this.root) disposeObject(this.root);
    if (this.lights) disposeObject(this.lights);
    this.textures = [];
    this.hoverables = [];
    this.pools = [];
    this.valves = [];
    this.valveProxies.clear();
    this.wires = [];
    this.sparks.clear();
    this.ecgLabels = [];
    this.chamberLabels = [];
    this.body = null;
    this.saNode = this.avNode = null;
    this.saHalo = this.avHalo = null;
    this.flow = null;
    this.electrical = null;
    this.ecgTrace = this.ecgHead = null;
    this.lub = this.dub = null;
    this.root = null;
    this.lights = null;
    this.ctx = null;
  }
}

function ecgX(t: number): number {
  return ECG_PLOT.left + (t / BEAT_MS) * (ECG_PLOT.right - ECG_PLOT.left);
}

function ecgY(t: number): number {
  return ECG_PLOT.baseline + ecg(t) * ECG_PLOT.mvScale;
}

/** 0 -> 1 with a small overshoot, exact at both ends. */
function popIn(k: number): number {
  const s = Math.min(1, Math.max(0, k)) - 1;
  return 1 + 2.7 * s * s * s + 1.7 * s * s;
}

export const heartExperience: FourDExperience = new HeartExperience();
