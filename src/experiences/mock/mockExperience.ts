// src/experiences/mock/mockExperience.ts
//
// Phase 1 exit check. A single cube moves A -> B -> C as t goes 0 -> 0.5 -> 1.
// Every control (scrub, play, reverse, warp, hover) must work against this
// before any real experience is built.

import * as THREE from "three";
import { linearMapping } from "../../core/mappings";
import { eventAt } from "../../core/Timeline";
import { lerp, easeInOutCubic, window as timeWindow } from "../../core/interpolate";
import type { FourDExperience, ObjectMetadata, SceneContext, TimelineEvent } from "../../core/types";

const POINT_A = new THREE.Vector3(-2, 0, 0);
const POINT_B = new THREE.Vector3(0, 1.5, 0);
const POINT_C = new THREE.Vector3(2, 0, 0);

function positionAt(t: number): THREE.Vector3 {
  if (t <= 0.5) {
    const s = easeInOutCubic(timeWindow(t, 0, 0.5));
    return new THREE.Vector3(
      lerp(POINT_A.x, POINT_B.x, s),
      lerp(POINT_A.y, POINT_B.y, s),
      lerp(POINT_A.z, POINT_B.z, s),
    );
  }
  const s = easeInOutCubic(timeWindow(t, 0.5, 1));
  return new THREE.Vector3(
    lerp(POINT_B.x, POINT_C.x, s),
    lerp(POINT_B.y, POINT_C.y, s),
    lerp(POINT_B.z, POINT_C.z, s),
  );
}

const events: TimelineEvent[] = [
  { id: "a", time: 0, title: "At A", when: "t = 0", description: "", keyPoints: [] },
  { id: "b", time: 0.5, title: "At B", when: "t = 0.5", description: "", keyPoints: [] },
  { id: "c", time: 1, title: "At C", when: "t = 1", description: "", keyPoints: [] },
];

class MockExperience implements FourDExperience {
  id: "mock" = "mock";
  name = "Mock";

  minTime = 0;
  maxTime = 1;
  mapping = linearMapping(0, 1, (t) => t.toFixed(2));
  baseDurationSeconds = 5;
  warpPresets = [0.1, 0.5, 1, 2, 5];
  labels = { start: "A", end: "C" };
  events = events;

  private cube: THREE.Mesh | null = null;
  private ctx: SceneContext | null = null;

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: 0x4fa3ff });
    this.cube = new THREE.Mesh(geometry, material);
    this.cube.userData.id = "cube";
    ctx.scene.add(this.cube);
    ctx.registerHoverable(this.cube, "cube");

    const directional = new THREE.DirectionalLight(0xffffff, 2);
    directional.position.set(3, 5, 2);
    ctx.scene.add(directional);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.8);
    ctx.scene.add(hemi);
  }

  setTime(time: number): void {
    if (!this.cube) return;
    const p = positionAt(time);
    this.cube.position.copy(p);
  }

  getState(time: number): unknown {
    return { position: positionAt(time) };
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    return id === "cube" ? { id, name: "Cube", description: "Test object" } : null;
  }

  getAvailableFilters() {
    return [];
  }

  getCameraPresets() {
    return [];
  }

  reset(): void {
    // Pure setTime handles reconstruction; nothing to accumulate here.
  }

  dispose(): void {
    if (this.cube && this.ctx) {
      this.ctx.unregisterHoverable(this.cube);
      this.cube.geometry.dispose();
      (this.cube.material as THREE.Material).dispose();
    }
    this.cube = null;
    this.ctx = null;
  }
}

export const mockExperience: FourDExperience = new MockExperience();
