// src/experiences/mock/mockExperience.ts
//
// Linear-timeline mock. A toon cube travels an arc through markers A, B, C
// as t goes 0 -> 0.5 -> 1, at constant parameter speed so warp rates are
// easy to see. Every control (scrub, play, reverse, warp, hover, camera)
// is tested against this before a real experience lands.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { linearMapping } from "../../core/mappings";
import { eventAt } from "../../core/Timeline";
import { THEME, addOutline, addWarmLights, disposeObject, makeToonMaterial } from "../../core/theme";
import type { CameraPreset, FourDExperience, ObjectMetadata, SceneContext, TimelineEvent } from "../../core/types";

const POINT_A = new THREE.Vector3(-2, 0, 0);
const POINT_B = new THREE.Vector3(0, 1.5, 0);
const POINT_C = new THREE.Vector3(2, 0, 0);
// Quadratic Bezier control point chosen so the curve passes B at s = 0.5.
const CONTROL = POINT_B.clone().multiplyScalar(2).sub(POINT_A.clone().add(POINT_C).multiplyScalar(0.5));
const curve = new THREE.QuadraticBezierCurve3(POINT_A, CONTROL, POINT_C);

function positionAt(t: number): THREE.Vector3 {
  return curve.getPoint(Math.min(1, Math.max(0, t)));
}

const events: TimelineEvent[] = [
  {
    id: "a",
    time: 0,
    title: "At A",
    when: "t = 0",
    description: "The cube waits on the terracotta marker. Press play or drag the timeline.",
    keyPoints: ["Linear mapping: equal slider distance, equal time", "One full pass takes 5 s at 1×"],
  },
  {
    id: "b",
    time: 0.5,
    title: "At B",
    when: "t = 0.5",
    description: "Halfway along the arc, the cube tops the mustard marker.",
    keyPoints: ["setTime(t) is pure: scrub back and it returns here exactly", "Try 5×: the whole pass takes 1 s"],
  },
  {
    id: "c",
    time: 1,
    title: "At C",
    when: "t = 1",
    description: "The end of the pass. Press play again to restart, or reverse to travel back.",
    keyPoints: ["Playback pauses at the end", "Play at the end restarts from A"],
  },
];

const OBJECTS: Record<string, ObjectMetadata> = {
  cube: {
    id: "cube",
    name: "Cube",
    description: "The test object. Its position and spin are a pure function of t.",
    category: "mock",
    properties: { Path: "Bezier arc", Speed: "constant", Spin: "1 turn / pass" },
  },
  "marker-a": { id: "marker-a", name: "Marker A", description: "Where the pass begins.", properties: { t: 0 } },
  "marker-b": { id: "marker-b", name: "Marker B", description: "The top of the arc.", properties: { t: 0.5 } },
  "marker-c": { id: "marker-c", name: "Marker C", description: "Where the pass ends.", properties: { t: 1 } },
};

const PRESETS: CameraPreset[] = [
  { id: "front", name: "Front", position: [0, 2.6, 10.5], target: [0, -0.1, 0] },
  { id: "high", name: "High", position: [6, 8, 7], target: [0, -0.3, 0] },
  { id: "side", name: "Side", position: [10.5, 1.8, 1.2], target: [0, 0, 0] },
];

class MockExperience implements FourDExperience {
  id = "mock" as const;
  name = "Linear mock";

  minTime = 0;
  maxTime = 1;
  mapping = linearMapping(0, 1, (t) => t.toFixed(2));
  baseDurationSeconds = 5;
  warpPresets = [0.1, 0.5, 1, 2, 5];
  labels = { start: "A", end: "C" };
  events = events;

  private root: THREE.Group | null = null;
  private cube: THREE.Mesh | null = null;
  private ctx: SceneContext | null = null;

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    const root = new THREE.Group();
    root.name = "mock-root";
    this.root = root;

    this.cube = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.7, 0.7, 4, 0.14), makeToonMaterial(THEME.terracotta));
    addOutline(this.cube, 0.035);
    root.add(this.cube);
    ctx.registerHoverable(this.cube, "cube");

    const markerColors = [THEME.terracotta, THEME.mustard, THEME.sage];
    [POINT_A, POINT_B, POINT_C].forEach((p, i) => {
      const id = ["marker-a", "marker-b", "marker-c"][i];
      // A squashed sphere: smooth normals keep the ink outline unbroken.
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), makeToonMaterial(markerColors[i]));
      marker.scale.set(1, 0.32, 1);
      addOutline(marker, 0.07);
      marker.position.set(p.x, p.y - 0.52, p.z);
      root.add(marker);
      ctx.registerHoverable(marker, id);
    });

    // Dashed ink path.
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const path = new THREE.Line(
      pathGeometry,
      new THREE.LineDashedMaterial({ color: THEME.inkSoft, dashSize: 0.12, gapSize: 0.1 }),
    );
    path.computeLineDistances();
    root.add(path);

    // Picture-book stage: a cream disc with an ink rim.
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.16, 64), makeToonMaterial(THEME.cream));
    addOutline(stage, 0.03);
    stage.position.y = -0.62;
    root.add(stage);

    ctx.scene.add(root);
    root.add(addWarmLights(ctx.scene));
  }

  setTime(time: number): void {
    if (!this.cube) return;
    this.cube.position.copy(positionAt(time));
    this.cube.rotation.set(0.35, time * Math.PI * 2, 0.2);
  }

  getState(time: number): unknown {
    return { position: positionAt(time), spin: time * Math.PI * 2 };
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

  reset(): void {
    // Pure setTime handles reconstruction; nothing to accumulate here.
  }

  dispose(): void {
    if (this.root && this.ctx) {
      this.root.traverse((o) => this.ctx!.unregisterHoverable(o));
      disposeObject(this.root);
    }
    this.root = null;
    this.cube = null;
    this.ctx = null;
  }
}

export const mockExperience: FourDExperience = new MockExperience();
