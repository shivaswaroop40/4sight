// src/renderer/SceneManager.ts
//
// Owns the Three.js scene, camera, renderer, camera controls, and the single
// requestAnimationFrame loop. Experiences are swapped in and out; the
// manager never knows which one is mounted beyond calling the FourDExperience
// interface. The renderer is created once and never recreated.

import * as THREE from "three";
import type { FourDExperience, SceneContext, TimeController } from "../core/types";
import { disposeObject } from "../core/theme";
import { CameraManager } from "./CameraManager";

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameras: CameraManager;

  private container: HTMLElement;
  private timeController: TimeController;
  private experience: FourDExperience | null = null;
  private context: SceneContext;

  private hoverables = new Map<THREE.Object3D, string>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerInside = false;
  private hoveredId: string | null = null;
  private onHoverChange?: (id: string | null) => void;

  private lastFrameTime = 0;
  private frameId = 0;
  private running = false;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, timeController: TimeController) {
    this.container = container;
    this.timeController = timeController;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 1e6);
    this.camera.position.set(3, 2, 5);

    // Transparent canvas: the warm paper gradient behind it is CSS.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.cameras = new CameraManager(this.camera, this.renderer.domElement);

    this.context = {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      registerHoverable: (object, id) => this.hoverables.set(object, id),
      unregisterHoverable: (object) => this.hoverables.delete(object),
    };

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    document.addEventListener("visibilitychange", this.handleVisibility);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  get current(): FourDExperience | null {
    return this.experience;
  }

  setHoverListener(listener: (id: string | null) => void): void {
    this.onHoverChange = listener;
  }

  /** Disposes the current experience, mounts the next, resets u to 0 (paused), and frames its first preset. */
  mount(experience: FourDExperience, animateCamera = false): void {
    if (this.experience) this.unmount();
    this.experience = experience;
    this.setHovered(null);
    experience.mount(this.context);
    this.timeController.attach(experience);
    this.scene.updateMatrixWorld(true);
    const [first] = experience.getCameraPresets();
    if (first) this.cameras.applyPreset(first, animateCamera);
    else this.cameras.overview(this.scene, animateCamera);
  }

  unmount(): void {
    if (!this.experience) return;
    this.experience.dispose();
    this.hoverables.clear();
    this.setHovered(null);
    // Safety net: free anything the experience left behind.
    for (const child of [...this.scene.children]) disposeObject(child);
    this.scene.background = null;
    this.scene.fog = null;
    this.experience = null;
  }

  applyPreset(id: string): void {
    const preset = this.experience?.getCameraPresets().find((p) => p.id === id);
    if (preset) this.cameras.applyPreset(preset);
  }

  overview(): void {
    this.scene.updateMatrixWorld(true);
    this.cameras.overview(this.scene);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0), 0.1);
      this.lastFrameTime = now;
      this.timeController.tick(dt);
      this.cameras.update(dt);
      this.updateHover();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  dispose(): void {
    this.stop();
    this.unmount();
    this.cameras.dispose();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.renderer.dispose();
    if (canvas.parentElement === this.container) this.container.removeChild(canvas);
  }

  private handleVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerInside = true;
  };

  private handlePointerLeave = (): void => {
    this.pointerInside = false;
  };

  private setHovered(id: string | null): void {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.onHoverChange?.(id);
  }

  private updateHover(): void {
    if (this.hoverables.size === 0 || !this.pointerInside) {
      this.setHovered(null);
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(Array.from(this.hoverables.keys()), true);

    let id: string | null = null;
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !this.hoverables.has(obj)) obj = obj.parent;
      // A hoverable may itself be invisible (a proxy volume), but one inside
      // a hidden group is not on screen and must not be hoverable.
      if (obj && isShown(obj.parent)) {
        id = this.hoverables.get(obj)!;
        break;
      }
    }
    this.setHovered(id);
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

function isShown(object: THREE.Object3D | null): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
  }
  return true;
}
