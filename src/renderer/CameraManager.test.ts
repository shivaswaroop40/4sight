import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { CameraPreset } from "../core/types";
import { fakeCanvas } from "../test/fakeCanvas";
import { CameraManager } from "./CameraManager";
import { NO_PRESS, stepPress, type PressInput } from "./pointerGesture";

const FRONT: CameraPreset = { id: "front", name: "Front", position: [0, 0, 10], target: [0, 0, 0] };
const SIDE: CameraPreset = { id: "side", name: "Side", position: [10, 0, 0], target: [0, 0, 0] };

function setup() {
  const camera = new THREE.PerspectiveCamera(45, 16 / 9);
  const cameras = new CameraManager(camera, fakeCanvas());
  return { camera, cameras };
}

const at = (v: THREE.Vector3) => v.toArray().map((n) => Math.round(n * 1000) / 1000 + 0);

/** SceneManager's rule: a press that turns into a drag lets go of a preset; a click does not. */
function press(cameras: CameraManager, inputs: [PressInput["type"], number, number][]): void {
  let p = NO_PRESS;
  for (const [type, x, y] of inputs) {
    const step = stepPress(p, { type, x, y });
    p = step.press;
    if (step.outcome === "drag") cameras.viewerMoved();
  }
}

describe("camera framing", () => {
  it("anchors on a preset and follows the distance scale along its line of sight", () => {
    const { camera, cameras } = setup();
    cameras.applyPreset(FRONT, false);
    expect(cameras.framing.kind).toBe("anchored");
    expect(at(camera.position)).toEqual([0, 0, 10]);
    cameras.setSubject(2);
    cameras.settle();
    expect(at(camera.position)).toEqual([0, 0, 20]);
  });

  it("keeps the anchor through a plain click and lets go once a press drags past 5 px", () => {
    const { camera, cameras } = setup();
    cameras.applyPreset(FRONT, false);
    press(cameras, [["down", 100, 100], ["move", 103, 103], ["up", 103, 103]]);
    expect(cameras.framing.kind).toBe("anchored");

    press(cameras, [["down", 100, 100], ["move", 110, 100], ["up", 110, 100]]);
    expect(cameras.framing.kind).toBe("free");
    cameras.setSubject(3);
    cameras.update(1);
    expect(at(camera.position)).toEqual([0, 0, 10]);
  });

  it("follows a clicked object, keeping the viewer's offset, until a preset", () => {
    const { camera, cameras } = setup();
    cameras.applyPreset(FRONT, false);
    const earth = new THREE.Object3D();
    earth.position.set(5, 0, 0);
    cameras.follow(earth, "earth");
    cameras.settle();
    expect(cameras.framing).toMatchObject({ kind: "following", id: "earth" });
    expect([at(cameras.controls.target), at(camera.position)]).toEqual([
      [5, 0, 0],
      [5, 0, 10],
    ]);

    cameras.applyPreset(SIDE, false);
    expect(cameras.framing.kind).toBe("anchored");
    expect(at(camera.position)).toEqual([10, 0, 0]);
  });

  it("puts back the camera, its framing and a preset in flight after an export settles it", () => {
    const { camera, cameras } = setup();
    cameras.applyPreset(FRONT, false);
    cameras.applyPreset(SIDE);
    cameras.update(0.3);
    const before = at(camera.position);
    const snapshot = cameras.snapshot();

    cameras.setSubject(2);
    cameras.settle();
    expect(at(camera.position)).toEqual([20, 0, 0]);

    cameras.setSubject(1);
    cameras.restore(snapshot);
    expect(at(camera.position)).toEqual(before);
    expect(cameras.framing.kind).toBe("anchored");
    expect(cameras.controls.enableDamping).toBe(true);
    cameras.update(0.3);
    expect(at(camera.position)).toEqual([10, 0, 0]);
  });
});
