// src/renderer/fakeSceneContext.ts
//
// Test-only. A SceneContext that lets vitest mount a real experience in
// Node: a plain Scene and camera, a renderer that only answers
// getPixelRatio, and a 2D canvas whose drawing calls do nothing, so canvas
// textures build without a browser. Tests then read the scene graph the
// experience built.
//
//   const ctx = fakeSceneContext();
//   experience.mount(ctx);
//   experience.setTime(t);
//   ctx.scene.getObjectByName("orbit")!.visible;

import * as THREE from "three";
import type { SceneContext } from "../core/types";

export interface FakeSceneContext extends SceneContext {
  hoverables: Map<THREE.Object3D, string>;
  /** The hoverable id a ray from `origin` towards `target` hits first, as SceneManager resolves it. */
  hoverAt(origin: THREE.Vector3Tuple, target: THREE.Vector3Tuple): string | null;
}

export function fakeSceneContext(): FakeSceneContext {
  stubCanvas();
  const scene = new THREE.Scene();
  const hoverables = new Map<THREE.Object3D, string>();
  const raycaster = new THREE.Raycaster();
  return {
    scene,
    camera: new THREE.PerspectiveCamera(),
    renderer: { getPixelRatio: () => 1 } as unknown as THREE.WebGLRenderer,
    registerHoverable: (object, id) => hoverables.set(object, id),
    unregisterHoverable: (object) => hoverables.delete(object),
    hoverables,
    hoverAt(origin, target) {
      scene.updateMatrixWorld(true);
      const from = new THREE.Vector3(...origin);
      raycaster.set(from, new THREE.Vector3(...target).sub(from).normalize());
      for (const hit of raycaster.intersectObjects([...hoverables.keys()], true)) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !hoverables.has(o)) o = o.parent;
        if (o) return hoverables.get(o)!;
      }
      return null;
    },
  };
}

function stubCanvas(): void {
  if (typeof document !== "undefined") return;
  // Every property is a no-op function that returns itself, so chains like
  // ctx.createLinearGradient(...).addColorStop(...) work.
  const inert: object = new Proxy(() => inert, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : inert),
    set: () => true,
  });
  const createElement = () => ({ width: 0, height: 0, style: {}, getContext: () => inert });
  (globalThis as unknown as { document: unknown }).document = { createElement };
}
