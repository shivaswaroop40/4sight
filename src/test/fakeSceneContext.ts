// src/test/fakeSceneContext.ts
//
// A SceneContext that lets vitest mount a real experience in Node: a plain
// Scene and camera and a renderer that only answers getPixelRatio. Canvas
// textures build against the inert document installed by setup.ts. Tests
// then read the scene graph the experience built.
//
//   const ctx = fakeSceneContext();
//   experience.mount(ctx);
//   experience.setTime(t);
//   ctx.scene.getObjectByName("orbit")!.visible;

import * as THREE from "three";
import type { SceneContext } from "../core/types";

export interface FakeSceneContext extends SceneContext {
  hoverables: Map<THREE.Object3D, string>;
  /** The hoverable id a ray from `origin` towards `target` hits first. Unlike SceneManager it ignores hidden parents. */
  hoverAt(origin: THREE.Vector3Tuple, target: THREE.Vector3Tuple): string | null;
}

export function fakeSceneContext(): FakeSceneContext {
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
