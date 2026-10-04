import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { fakeSceneContext } from "./fakeSceneContext";
import { captureShaderUniforms, sceneSnapshot } from "./sceneSnapshot";

function spriteMeshAndProxy() {
  const ctx = fakeSceneContext();
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(document.createElement("canvas")) }));
  label.userData.opacity = 1;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial());
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  proxy.visible = false;
  ctx.scene.add(label, mesh, proxy);
  ctx.registerHoverable(mesh, "box");
  ctx.registerHoverable(proxy, "proxy");
  return { ctx, label, mesh, proxy, snapshot: () => JSON.stringify(sceneSnapshot(ctx, captureShaderUniforms(ctx))) };
}

const CHANGES: Record<string, (s: ReturnType<typeof spriteMeshAndProxy>) => void> = {
  "sprite rotation": (s) => (s.label.material.rotation = 1),
  emissiveIntensity: (s) => (s.mesh.material.emissiveIntensity = 2),
  transparent: (s) => (s.mesh.material.transparent = true),
  depthWrite: (s) => (s.mesh.material.depthWrite = false),
  side: (s) => (s.mesh.material.side = THREE.DoubleSide),
  blending: (s) => (s.mesh.material.blending = THREE.AdditiveBlending),
  alphaTest: (s) => (s.mesh.material.alphaTest = 0.5),
  "a repainted canvas": (s) => (s.label.material.map!.needsUpdate = true),
  "a swapped map": (s) => {
    const other = new THREE.CanvasTexture(document.createElement("canvas"));
    other.name = "other";
    s.label.material.map = other;
  },
  "a swapped raycast": (s) => (s.mesh.raycast = () => {}),
  "a swapped raycast on a hidden hover proxy": (s) => (s.proxy.raycast = () => {}),
  "userData a render hook reads": (s) => (s.label.userData.opacity = 0.5),
};

describe("sceneSnapshot", () => {
  it("changes when setTime writes any of the state that changes the frame", () => {
    const seen = Object.fromEntries(
      Object.entries(CHANGES).map(([name, change]) => {
        const s = spriteMeshAndProxy();
        const before = s.snapshot();
        change(s);
        return [name, s.snapshot() !== before];
      }),
    );
    expect(seen).toEqual(Object.fromEntries(Object.keys(CHANGES).map((name) => [name, true])));
  });

  it("is the same for two fresh mounts, whose ids, uuids and closures differ", () => {
    const a = spriteMeshAndProxy();
    const b = spriteMeshAndProxy();
    a.mesh.raycast = () => {};
    b.mesh.raycast = () => {};
    expect(a.snapshot()).toBe(b.snapshot());
  });
});
