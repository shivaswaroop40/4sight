import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { worldBounds } from "./worldBounds";

const box = () => new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
const corners = (b: THREE.Box3) => [b.min.toArray(), b.max.toArray()];

describe("worldBounds", () => {
  it("counts each instance of an InstancedMesh where it is, and skips zero-scale ones", () => {
    const group = new THREE.Group();
    group.position.set(0, 10, 0);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial(), 3);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 0, 0));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(8, 0, 0));
    mesh.setMatrixAt(2, new THREE.Matrix4().makeScale(0, 0, 0));
    group.add(mesh);
    expect(corners(worldBounds(mesh))).toEqual([
      [3, 9, -1],
      [9, 11, 1],
    ]);
  });

  it("leaves out hidden children, ink outlines and meshes that draw nothing", () => {
    const root = box();
    const hidden = box();
    hidden.position.set(50, 0, 0);
    hidden.visible = false;
    const outline = box();
    outline.name = "outline";
    outline.scale.setScalar(10);
    const proxy = box();
    proxy.material.visible = false;
    proxy.position.set(0, -50, 0);
    const child = box();
    child.position.set(0, 0, 5);
    root.add(hidden, outline, proxy, child);
    expect(corners(worldBounds(root))).toEqual([
      [-1, -1, -1],
      [1, 1, 6],
    ]);
  });

  it("still counts a root that is itself an invisible hover proxy", () => {
    const proxy = box();
    proxy.visible = false;
    proxy.position.set(3, 0, 0);
    expect(corners(worldBounds(proxy))).toEqual([
      [2, -1, -1],
      [4, 1, 1],
    ]);
  });
});
