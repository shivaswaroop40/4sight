// src/renderer/worldBounds.ts
//
// The world-space box around what an object draws on screen. Following an
// object centres on it and Overview frames it, so the two agree on where a
// thing is.

import * as THREE from "three";

const part = new THREE.Box3();
const instance = new THREE.Matrix4();
const centre = new THREE.Vector3();

/**
 * The world-space bounds of what `root` draws: its own geometry plus that of
 * every visible descendant. Hidden subtrees, ink outlines and meshes whose
 * material draws nothing are left out, but `root` itself always counts, so a
 * hover proxy can still be followed. An InstancedMesh counts its instances,
 * not its geometry at the origin. Refreshes the world matrices first, so
 * this frame's setTime counts, not last frame's.
 */
export function worldBounds(root: THREE.Object3D, out = new THREE.Box3()): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  out.makeEmpty();
  addOwn(root, out);
  const walk = (node: THREE.Object3D) => {
    for (const child of node.children) {
      if (!child.visible) continue;
      if (draws(child)) addOwn(child, out);
      walk(child);
    }
  };
  walk(root);
  return out;
}

function draws(node: THREE.Object3D): boolean {
  const material = (node as THREE.Mesh).material;
  if (!material || node.name === "outline") return false;
  return Array.isArray(material) ? material.some((m) => m.visible) : material.visible;
}

function addOwn(node: THREE.Object3D, out: THREE.Box3): void {
  const geometry = (node as THREE.Mesh).geometry;
  if (!geometry) return;
  if (!(node instanceof THREE.InstancedMesh)) {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    out.union(part.copy(geometry.boundingBox!).applyMatrix4(node.matrixWorld));
    return;
  }
  addInstanceCentresPaddedByLargestInstance(node, out);
}

function addInstanceCentresPaddedByLargestInstance(node: THREE.InstancedMesh, out: THREE.Box3): void {
  const geometry = node.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!;
  const matrices = node.instanceMatrix.array;
  let scale = 0;
  part.makeEmpty();
  for (let i = 0; i < node.count; i++) {
    instance.fromArray(matrices, i * 16);
    // A zero-scale instance is hidden; counting it would pull the box to the mesh's origin.
    if (instance.determinant() === 0) continue;
    part.expandByPoint(centre.copy(sphere.center).applyMatrix4(instance));
    scale = Math.max(scale, instance.getMaxScaleOnAxis());
  }
  if (part.isEmpty()) return;
  out.union(part.expandByScalar(sphere.radius * scale).applyMatrix4(node.matrixWorld));
}
