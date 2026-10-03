// src/renderer/SceneManager.ts
//
// Owns the Three.js scene, camera, renderer, camera controls, and the single
// requestAnimationFrame loop. Experiences are swapped in and out; the
// manager never knows which one is mounted beyond calling the FourDExperience
// interface. The renderer is created once and never recreated.
//
// It also turns canvas input into camera framing: a drag or a wheel zoom
// lets go of a preset, and a click on a hoverable follows it. The UI learns
// what the camera is doing through the camera listener, which reports a
// CameraView whenever it changes.
//
// A video export borrows the renderer through holdForExport: the loop stops
// and nothing else may restart it or resize the canvas until the stage is
// released, which puts the size, pixel ratio and camera back.

import * as THREE from "three";
import type { CameraMode, FilterState, FourDExperience, SceneContext, TimeController } from "../core/types";
import { disposeObject } from "../core/theme";
import { CameraManager } from "./CameraManager";
import { NO_PRESS, stepPress, type Press, type PressInput } from "./pointerGesture";

/**
 * What the UI shows about the camera. `shown` is false while the followed
 * object is hidden at the current time; the camera keeps riding its
 * position, so scrubbing back to when it is on screen finds it centred.
 */
export type CameraView =
  | { mode: Extract<CameraMode, "orbit"> }
  | { mode: Extract<CameraMode, "follow">; id: string; shown: boolean };

const ORBIT: CameraView = { mode: "orbit" };

/** The render loop. "held" belongs to a video export: visibility and resizes leave it alone. */
type Loop = "running" | "stopped" | "held";

/** The renderer on loan to a video export. */
export interface ExportStage {
  /**
   * Renders the current moment at the export size, with the camera settled for it. Read the canvas before
   * yielding: without preserveDrawingBuffer, WebGL clears it once the browser composites.
   */
  render(): HTMLCanvasElement;
  /** Puts the renderer and camera back and restarts the loop. Safe to call twice. */
  release(): void;
}

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
  private press: Press = NO_PRESS;
  private hoveredId: string | null = null;
  private onHoverChange?: (id: string | null) => void;
  private cameraView: CameraView = ORBIT;
  private onCameraChange?: (view: CameraView) => void;

  private lastFrameTime = 0;
  private frameId = 0;
  private loop: Loop = "stopped";
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
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerCancel);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("wheel", this.handleWheel, { passive: true });
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

  setCameraListener(listener: (view: CameraView) => void): void {
    this.onCameraChange = listener;
  }

  /**
   * Disposes the current experience, mounts the next under `filters`, resets
   * u to 0 (paused), and frames its first preset. The filters are stored
   * before the controller attaches, so the first frame is already filtered.
   */
  mount(experience: FourDExperience, filters: FilterState, animateCamera = false): void {
    if (this.experience) this.unmount();
    this.experience = experience;
    this.setHovered(null);
    experience.mount(this.context);
    experience.setFilters?.(filters);
    this.timeController.attach(experience);
    this.scene.updateMatrixWorld(true);
    this.warmUp();
    this.cameras.setDistanceScale(experience.cameraDistanceScale?.(this.timeController.state.time) ?? 1);
    const [first] = experience.getCameraPresets();
    if (first) this.cameras.applyPreset(first, animateCamera);
    else this.cameras.overview(this.scene, animateCamera);
  }

  unmount(): void {
    if (!this.experience) return;
    this.cameras.stopFollowing();
    this.experience.dispose();
    this.hoverables.clear();
    this.setHovered(null);
    // Safety net: free anything the experience left behind.
    for (const child of [...this.scene.children]) disposeObject(child);
    this.scene.background = null;
    this.scene.fog = null;
    this.experience = null;
  }

  /**
   * Compiles every material now, including objects that are hidden until
   * later in the timeline, so nothing stalls a frame when it first appears.
   * renderer.compile only visits visible objects, hence the temporary
   * reveal, and some GPU backends (ANGLE on Metal) build pipelines only at
   * the first draw, so it also draws once into a 1 px scissor.
   */
  private warmUp(): void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    this.renderer.compile(this.scene, this.camera);
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(0, 0, 1, 1);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
    for (const o of hidden) o.visible = false;
  }

  /** Re-renders the current moment under new filters. Time does not move. */
  setFilters(filters: FilterState): void {
    if (!this.experience) return;
    this.experience.setFilters?.(filters);
    this.experience.setTime(this.timeController.state.time);
  }

  applyPreset(id: string): void {
    const preset = this.experience?.getCameraPresets().find((p) => p.id === id);
    if (preset) this.cameras.applyPreset(preset);
  }

  overview(): void {
    this.scene.updateMatrixWorld(true);
    this.cameras.overview(this.scene);
  }

  stopFollowing(): void {
    this.cameras.stopFollowing();
  }

  /** The stage's size in CSS pixels. */
  get viewport(): { width: number; height: number } {
    return { width: this.container.clientWidth, height: this.container.clientHeight };
  }

  start(): void {
    if (this.loop !== "stopped") return;
    this.loop = "running";
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      if (this.loop !== "running") return;
      const dt = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0), 0.1);
      this.lastFrameTime = now;
      this.timeController.tick(dt);
      this.cameras.setDistanceScale(this.experience?.cameraDistanceScale?.(this.timeController.state.time) ?? 1);
      this.cameras.update(dt);
      this.updateCameraView();
      this.updateHover();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.loop !== "running") return;
    this.loop = "stopped";
    cancelAnimationFrame(this.frameId);
  }

  /**
   * Stops the loop and sizes the drawing buffer to exactly width x height
   * pixels. The canvas keeps its CSS size, so the page layout does not move.
   */
  holdForExport(width: number, height: number): ExportStage {
    this.stop();
    this.loop = "held";
    const camera = this.cameras.snapshot();
    const pixelRatio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    return {
      render: () => {
        this.cameras.setDistanceScale(this.experience?.cameraDistanceScale?.(this.timeController.state.time) ?? 1);
        this.cameras.settle();
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
      },
      release: () => {
        if (this.loop !== "held") return;
        this.loop = "stopped";
        this.renderer.setPixelRatio(pixelRatio);
        this.handleResize();
        this.cameras.restore(camera);
        if (!document.hidden) this.start();
      },
    };
  }

  dispose(): void {
    this.stop();
    this.unmount();
    this.cameras.dispose();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    canvas.removeEventListener("wheel", this.handleWheel);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.renderer.dispose();
    if (canvas.parentElement === this.container) this.container.removeChild(canvas);
  }

  private handleVisibility = (): void => {
    if (this.loop === "held") return;
    if (document.hidden) this.stop();
    else this.start();
  };

  private handlePointerDown = (event: PointerEvent): void => {
    this.stepPress("down", event);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    this.setPointer(event);
    this.pointerInside = true;
    this.stepPress("move", event);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    this.stepPress("up", event);
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    this.stepPress("cancel", event);
  };

  private handleWheel = (): void => {
    this.cameras.viewerMoved();
  };

  private stepPress(type: PressInput["type"], event: PointerEvent): void {
    const { press, outcome } = stepPress(this.press, { type, x: event.clientX, y: event.clientY });
    this.press = press;
    if (outcome === "drag") this.cameras.viewerMoved();
    // Picks at the up position: a tap has no hover before it.
    if (outcome === "click" && event.button === 0) {
      this.setPointer(event);
      const hit = this.pick();
      if (hit) this.cameras.follow(hit.object, hit.id);
    }
  }

  private setPointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerLeave = (): void => {
    this.pointerInside = false;
  };

  private setHovered(id: string | null): void {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.renderer.domElement.style.cursor = id ? "pointer" : "";
    this.onHoverChange?.(id);
  }

  private updateHover(): void {
    this.setHovered(this.hoverables.size > 0 && this.pointerInside ? (this.pick()?.id ?? null) : null);
  }

  /** The hoverable under the pointer, if any. */
  private pick(): { object: THREE.Object3D; id: string } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(Array.from(this.hoverables.keys()), true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !this.hoverables.has(obj)) obj = obj.parent;
      // A hoverable may itself be invisible (a proxy volume), but one inside
      // a hidden group is not on screen and must not be hoverable.
      if (obj && isShown(obj.parent)) return { object: obj, id: this.hoverables.get(obj)! };
    }
    return null;
  }

  private updateCameraView(): void {
    const f = this.cameras.framing;
    const view: CameraView = f.kind === "following" ? { mode: "follow", id: f.id, shown: isShown(f.object) } : ORBIT;
    const prev = this.cameraView;
    const same =
      view.mode === "orbit"
        ? prev.mode === "orbit"
        : prev.mode === "follow" && prev.id === view.id && prev.shown === view.shown;
    if (same) return;
    this.cameraView = view;
    this.onCameraChange?.(view);
  }

  private handleResize(): void {
    if (this.loop === "held") return;
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
