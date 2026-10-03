// src/renderer/CameraManager.ts
//
// Orbit controls plus animated camera presets. The render loop calls
// update(dt) every frame; applyPreset and overview tween position and
// target over PRESET_MS with an ease-in-out curve. What the camera does
// between tweens is its framing:
//
//   free       the viewer's camera; nothing moves it.
//   anchored   after a preset, until the viewer drags or zooms: it eases
//              along the preset's line of sight to follow the experience's
//              distance scale for the current time and the viewport's
//              aspect ratio.
//   following  after a click on an object: the orbit target glides onto the
//              object over PRESET_MS, then rides with it every frame, and
//              the camera moves by the same amount, so the viewer keeps
//              their angle and distance and can still orbit and zoom.
//              A preset, Overview or stopFollowing ends it.
//
// Video export renders frames in a loop of its own: settle() puts the
// camera where update() is easing it for the current time, at once, and
// snapshot() and restore() put the viewer's camera back afterwards.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { easeInOutCubic } from "../core/interpolate";
import type { CameraPreset } from "../core/types";

const PRESET_MS = 600;

export type Framing =
  | { kind: "free" }
  | { kind: "anchored"; preset: CameraPreset }
  | { kind: "following"; object: THREE.Object3D; id: string; from: THREE.Vector3; elapsed: number };

const FREE: Framing = { kind: "free" };

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
}

/** The viewer's camera as export found it. */
export interface CameraSnapshot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  framing: Framing;
  tween: Tween | null;
  damping: boolean;
}

export class CameraManager {
  readonly controls: OrbitControls;
  private tween: Tween | null = null;
  private framingState: Framing = FREE;
  private distanceScale = 1;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
  }

  /**
   * The viewer moved the camera by hand (a drag or a wheel zoom): a preset
   * in flight stops and the anchor lets go. A plain click is not a move.
   */
  viewerMoved(): void {
    this.tween = null;
    if (this.framingState.kind === "anchored") this.setFraming(FREE);
  }

  get framing(): Framing {
    return this.framingState;
  }

  applyPreset(preset: CameraPreset, animate = true): void {
    this.setFraming({ kind: "anchored", preset });
    this.moveTo(this.anchoredPosition(preset), new THREE.Vector3(...preset.target), animate);
  }

  /** Keeps `object` at the orbit target from now on. Following the object already followed changes nothing. */
  follow(object: THREE.Object3D, id: string): void {
    const f = this.framingState;
    if (f.kind === "following" && f.object === object) return;
    this.tween = null;
    const elapsed = prefersReducedMotion() ? PRESET_MS : 0;
    this.setFraming({ kind: "following", object, id, from: this.controls.target.clone(), elapsed });
  }

  /** The camera stays where it is. */
  stopFollowing(): void {
    if (this.framingState.kind === "following") this.setFraming(FREE);
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
    this.setFraming(FREE);
    this.moveTo(sphere.center.clone().addScaledVector(dir, distance), sphere.center.clone(), animate);
  }

  setDistanceScale(scale: number): void {
    this.distanceScale = scale;
  }

  update(dtSeconds: number): void {
    const t = this.tween;
    const f = this.framingState;
    if (t) {
      t.elapsed += dtSeconds * 1000;
      const s = easeInOutCubic(Math.min(1, t.elapsed / t.duration));
      this.camera.position.lerpVectors(t.fromPos, t.toPos, s);
      this.controls.target.lerpVectors(t.fromTarget, t.toTarget, s);
      if (s >= 1) this.tween = null;
    } else if (f.kind === "anchored") {
      this.camera.position.lerp(this.anchoredPosition(f.preset), 1 - Math.exp(-dtSeconds * 5));
    } else if (f.kind === "following") {
      f.elapsed += dtSeconds * 1000;
      // getWorldPosition refreshes the matrix, so this frame's setTime counts, not last frame's.
      const goal = f.object.getWorldPosition(new THREE.Vector3());
      const next = f.from.clone().lerp(goal, easeInOutCubic(Math.min(1, f.elapsed / PRESET_MS)));
      this.camera.position.add(next.clone().sub(this.controls.target));
      this.controls.target.copy(next);
    }
    this.controls.update();
  }

  snapshot(): CameraSnapshot {
    const f = this.framingState;
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      framing: f.kind === "following" ? { ...f, from: f.from.clone() } : f,
      tween: this.tween && { ...this.tween },
      damping: this.controls.enableDamping,
    };
  }

  restore(snapshot: CameraSnapshot): void {
    this.tween = snapshot.tween;
    this.setFraming(snapshot.framing);
    this.controls.enableDamping = snapshot.damping;
    this.camera.position.copy(snapshot.position);
    this.controls.target.copy(snapshot.target);
    this.controls.update();
  }

  /**
   * Lands the camera where update() would ease it for the current time and
   * distance scale: a tween ends, an anchor sits at its distance, a followed
   * object is centred. Damping stays off until restore(), so leftover drag
   * inertia is spent in the first frame instead of drifting through the rest.
   */
  settle(): void {
    this.controls.enableDamping = false;
    this.controls.update();
    const t = this.tween;
    if (t) {
      this.camera.position.copy(t.toPos);
      this.controls.target.copy(t.toTarget);
      this.tween = null;
    }
    const f = this.framingState;
    if (f.kind === "anchored") {
      this.camera.position.copy(this.anchoredPosition(f.preset));
    } else if (f.kind === "following") {
      f.elapsed = PRESET_MS;
      const goal = f.object.getWorldPosition(new THREE.Vector3());
      this.camera.position.add(goal.clone().sub(this.controls.target));
      this.controls.target.copy(goal);
    }
    this.controls.update();
  }

  /**
   * Presets are authored for a landscape viewport. On a portrait screen the
   * horizontal field of view shrinks, so the camera backs off along the same
   * line of sight to keep the framing.
   */
  private anchoredPosition(preset: CameraPreset): THREE.Vector3 {
    const target = new THREE.Vector3(...preset.target);
    const offset = new THREE.Vector3(...preset.position).sub(target);
    const aspect = this.camera.aspect;
    const portrait = aspect < 1.2 ? Math.min(2.4, Math.pow(1.2 / aspect, 0.85)) : 1;
    return target.addScaledVector(offset, portrait * this.distanceScale);
  }

  dispose(): void {
    this.controls.dispose();
  }

  /** Panning would pull the target off a followed object, so it is off while following. */
  private setFraming(framing: Framing): void {
    this.framingState = framing;
    this.controls.enablePan = framing.kind !== "following";
  }

  private moveTo(position: THREE.Vector3, target: THREE.Vector3, animate: boolean): void {
    if (!animate || prefersReducedMotion()) {
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

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
