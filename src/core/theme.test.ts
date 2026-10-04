import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { disposeObject } from "./theme";

describe("disposeObject", () => {
  it("frees the instance buffers of an InstancedMesh along with its geometry and material", () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const parcels = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4);
    parcels.name = "parcels";
    parcels.geometry.name = "parcel-shape";
    parcels.material.name = "parcel-paint";
    group.add(parcels);
    scene.add(group);

    const disposed: string[] = [];
    for (const thing of [parcels, parcels.geometry, parcels.material]) {
      (thing as THREE.EventDispatcher<{ dispose: object }>).addEventListener("dispose", () => disposed.push(thing.name));
    }
    disposeObject(group);

    expect(disposed.sort()).toEqual(["parcel-paint", "parcel-shape", "parcels"]);
    expect(scene.children).toEqual([]);
  });
});
