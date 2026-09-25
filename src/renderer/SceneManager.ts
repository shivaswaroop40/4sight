// src/renderer/SceneManager.ts
//
// Owns the Three.js scene, camera, renderer, and the single
// requestAnimationFrame loop. Experiences are swapped in and out; the
// manager never knows which one is mounted beyond calling the FourDExperience
// interface.

import * as THREE from "three";
import type { FourDExperience, SceneContext, TimeController } from "../core/types";

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private timeController: TimeController;
  private experience: FourDExperience | null = null;
  private context: SceneContext;

  private hoverables = new Map<THREE.Object3D, string>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hoveredId: string | null = null;
  private onHoverChange?: (id: string | null) => void;

  private lastFrameTime = 0;
  private frameId = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, timeController: TimeController) {
    this.container = container;
    this.timeController = timeController;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      1e12,
    );
    this.camera.position.set(3, 2, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.context = {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      registerHoverable: (object, id) => this.hoverables.set(object, id),
      unregisterHoverable: (object) => this.hoverables.delete(object),
    };

    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  setHoverListener(listener: (id: string | null) => void): void {
    this.onHoverChange = listener;
  }

  mount(experience: FourDExperience): void {
    if (this.experience) {
      this.unmount();
    }
    this.experience = experience;
    this.hoverables.clear();
    this.hoveredId = null;
    experience.mount(this.context);
    this.timeController.attach(experience);
  }

  unmount(): void {
    if (!this.experience) return;
    this.experience.dispose();
    this.hoverables.clear();
    this.hoveredId = null;
    // Clear anything the previous experience left in the scene.
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.experience = null;
  }

  start(): void {
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = now;
      this.timeController.tick(dt);
      this.updateHover();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  dispose(): void {
    this.stop();
    this.unmount();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  private updateHover(): void {
    if (this.hoverables.size === 0) {
      if (this.hoveredId !== null) {
        this.hoveredId = null;
        this.onHoverChange?.(null);
      }
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objects = Array.from(this.hoverables.keys());
    const hits = this.raycaster.intersectObjects(objects, true);

    let id: string | null = null;
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && id === null) {
        if (this.hoverables.has(obj)) {
          id = this.hoverables.get(obj)!;
        }
        obj = obj.parent;
      }
    }

    if (id !== this.hoveredId) {
      this.hoveredId = id;
      this.onHoverChange?.(id);
    }
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
