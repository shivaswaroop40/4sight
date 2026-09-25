// src/renderer/CameraManager.ts
//
// Orbit controls plus animated camera presets. The render loop calls
// update(dt) every frame; applyPreset and overview tween position and
// target over PRESET_MS with an ease-in-out curve.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { easeInOutCubic } from "../core/interpolate";
import type { CameraPreset } from "../core/types";

const PRESET_MS = 600;

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
}

export class CameraManager {
  readonly controls: OrbitControls;
  private tween: Tween | null = null;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    // A user drag cancels any preset in flight.
    this.controls.addEventListener("start", () => {
      this.tween = null;
    });
  }

  /**
   * Presets are authored for a landscape viewport. On a portrait screen the
   * horizontal field of view shrinks, so the camera backs off along the same
   * line of sight to keep the framing.
   */
  applyPreset(preset: CameraPreset, animate = true): void {
    const target = new THREE.Vector3(...preset.target);
    const offset = new THREE.Vector3(...preset.position).sub(target);
    const aspect = this.camera.aspect;
    if (aspect < 1.2) offset.multiplyScalar(Math.min(2.4, Math.pow(1.2 / aspect, 0.85)));
    this.moveTo(target.clone().add(offset), target, animate);
  }

  /** Frames the bounding sphere of everything visible in `root`, keeping the current viewing direction. */
  overview(root: THREE.Object3D, animate = true): void {
    const box = new THREE.Box3();
    root.traverseVisible((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.geometry || node.name === "outline") return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld);
      box.union(b);
    });
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect));
    const distance = (sphere.radius / Math.sin(fit / 2)) * 1.05;
    let dir = this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-9) dir = new THREE.Vector3(0.6, 0.45, 1);
    dir.normalize();
    this.moveTo(sphere.center.clone().addScaledVector(dir, distance), sphere.center.clone(), animate);
  }

  update(dtSeconds: number): void {
    const t = this.tween;
    if (t) {
      t.elapsed += dtSeconds * 1000;
      const s = easeInOutCubic(Math.min(1, t.elapsed / t.duration));
      this.camera.position.lerpVectors(t.fromPos, t.toPos, s);
      this.controls.target.lerpVectors(t.fromTarget, t.toTarget, s);
      if (s >= 1) this.tween = null;
    }
    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }

  private moveTo(position: THREE.Vector3, target: THREE.Vector3, animate: boolean): void {
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduced) {
      this.tween = null;
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos: position,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      elapsed: 0,
      duration: PRESET_MS,
    };
  }
}
