// src/test/sceneSnapshot.ts
//
// Uniforms an experience adds through onBeforeCompile live only inside the
// compiled shader, so captureShaderUniforms compiles each such material
// once against the stock three.js shader for its type and keeps the
// uniforms it was handed.
//
//   const ctx = fakeSceneContext();
//   experience.mount(ctx);
//   const uniforms = captureShaderUniforms(ctx);
//   experience.setTime(t);
//   expect(sceneSnapshot(ctx, uniforms)).toEqual(expected);

import * as THREE from "three";
import type { SceneContext } from "../core/types";
import type { FakeSceneContext } from "./fakeSceneContext";

const SHADER_LIB: Record<string, keyof typeof THREE.ShaderLib> = {
  MeshBasicMaterial: "basic",
  MeshLambertMaterial: "lambert",
  MeshPhongMaterial: "phong",
  MeshStandardMaterial: "standard",
  MeshPhysicalMaterial: "physical",
  MeshToonMaterial: "toon",
  MeshMatcapMaterial: "matcap",
  PointsMaterial: "points",
  LineBasicMaterial: "basic",
  LineDashedMaterial: "dashed",
  SpriteMaterial: "sprite",
};

export type ShaderUniforms = Map<THREE.Material, Record<string, THREE.IUniform>>;

const roots = (ctx: SceneContext): THREE.Object3D[] => [ctx.scene, ctx.camera];

function materialsOf(node: THREE.Object3D): THREE.Material[] {
  const material = (node as THREE.Mesh).material;
  return material ? ([] as THREE.Material[]).concat(material) : [];
}

/** Compiles every material with an onBeforeCompile hook once and keeps the uniforms the hook added. */
export function captureShaderUniforms(ctx: SceneContext): ShaderUniforms {
  const captured: ShaderUniforms = new Map();
  for (const root of roots(ctx)) {
    root.traverse((node) => {
      for (const material of materialsOf(node)) {
        if (captured.has(material) || material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) continue;
        const lib = THREE.ShaderLib[SHADER_LIB[material.type]];
        if (!lib) throw new Error(`No stock shader for ${material.type}`);
        const shader = {
          uniforms: THREE.UniformsUtils.clone(lib.uniforms),
          vertexShader: lib.vertexShader,
          fragmentShader: lib.fragmentShader,
          defines: {},
        };
        material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, ctx.renderer);
        captured.set(material, Object.fromEntries(Object.entries(shader.uniforms).filter(([name]) => !(name in lib.uniforms))));
      }
    });
  }
  return captured;
}

function texture(t: THREE.Texture): string {
  const image = t.image as { width?: number; height?: number } | null;
  return `texture:${t.name}:${image?.width ?? 0}x${image?.height ?? 0}:v${t.version}`;
}

function value(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(value);
  if (v instanceof THREE.Texture) return texture(v);
  if ("toArray" in v && typeof v.toArray === "function") return Array.from(v.toArray() as ArrayLike<number>);
  if (ArrayBuffer.isView(v)) return hash(v as unknown as ArrayLike<number>);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x)]));
}

function uniforms(record: Record<string, THREE.IUniform> | undefined): Record<string, unknown> | undefined {
  return record && Object.fromEntries(Object.entries(record).map(([k, u]) => [k, value(u.value)]));
}

/** FNV-1a over the float bits, so equal arrays hash equal and any change shows. */
function hash(array: ArrayLike<number>): string {
  const bits = new Float32Array(1);
  const word = new Uint32Array(bits.buffer);
  let h = 0x811c9dc5;
  for (let i = 0; i < array.length; i++) {
    bits[0] = array[i];
    h = Math.imul(h ^ word[0], 0x01000193);
  }
  return `${array.length}:${(h >>> 0).toString(16)}`;
}

function hashText(text: string): string {
  return text.length > 64 ? hash(Array.from(text, (c) => c.charCodeAt(0))) : text;
}

function scalars(object: object, historyFields: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(object)) {
    if (historyFields.includes(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = hashText(v);
  }
  return out;
}

const MATERIAL_HISTORY = ["id", "uuid", "version"];

function material(m: THREE.Material, shaderUniforms: ShaderUniforms): unknown {
  const props = m as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; uniforms?: Record<string, THREE.IUniform> };
  const textures = Object.entries(m).filter((e): e is [string, THREE.Texture] => e[1] instanceof THREE.Texture);
  return {
    ...scalars(m, MATERIAL_HISTORY),
    color: props.color?.toArray(),
    emissive: props.emissive?.toArray(),
    textures: Object.fromEntries(textures.map(([k, t]) => [k, texture(t)])),
    uniforms: uniforms(props.uniforms),
    shaderUniforms: uniforms(shaderUniforms.get(m)),
  };
}

function raycast(node: THREE.Object3D): string {
  const own = (Object.getPrototypeOf(node) as THREE.Object3D).raycast;
  return node.raycast === own ? "default" : `swapped:${hashText(node.raycast.toString())}`;
}

function geometry(g: THREE.BufferGeometry): unknown {
  return {
    drawRange: [g.drawRange.start, g.drawRange.count],
    attributes: Object.fromEntries(
      Object.entries(g.attributes)
        .filter(([, a]) => !(a instanceof THREE.InstancedBufferAttribute))
        .map(([k, a]) => [k, hash((a as THREE.BufferAttribute).array)]),
    ),
  };
}

/** Per-instance data of the instances that draw: within count and not scaled to nothing. */
function instances(mesh: THREE.InstancedMesh): unknown {
  const drawn: number[] = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < mesh.count; i++) if (m.fromArray(mesh.instanceMatrix.array, i * 16).determinant() !== 0) drawn.push(i);
  const pick = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) =>
    hash(drawn.flatMap((i) => Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k])));
  const perInstance = Object.entries(mesh.geometry.attributes).filter(([, a]) => a instanceof THREE.InstancedBufferAttribute);
  return {
    drawn: drawn.length,
    matrices: pick(mesh.instanceMatrix),
    colors: mesh.instanceColor && pick(mesh.instanceColor),
    attributes: Object.fromEntries(perInstance.map(([k, a]) => [k, pick(a)])),
  };
}

/**
 * What a hidden object holds is not drawn, so a hidden object counts only as
 * hidden. A hoverable can be a hidden proxy volume that still answers the
 * pointer, so its transform still counts; anything inside a hidden group
 * answers nothing.
 */
export function sceneSnapshot(ctx: FakeSceneContext, shaderUniforms: ShaderUniforms): unknown[] {
  const out: unknown[] = [];
  const visit = (node: THREE.Object3D) => {
    const base = { type: node.type, name: node.name, visible: node.visible };
    const transform = { position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray() };
    if (!node.visible) {
      out.push(ctx.hoverables.has(node) ? { ...base, ...transform, raycast: raycast(node) } : base);
      return;
    }
    const mesh = node as THREE.Mesh;
    const instanced = node instanceof THREE.InstancedMesh ? node : null;
    const light = node instanceof THREE.Light ? node : null;
    out.push({
      ...base,
      ...transform,
      renderOrder: node.renderOrder,
      raycast: raycast(node),
      userData: scalars(node.userData),
      light: light && { intensity: light.intensity, color: light.color.toArray() },
      materials: materialsOf(node).map((m) => material(m, shaderUniforms)),
      geometry: mesh.geometry && geometry(mesh.geometry),
      instances: instanced && instances(instanced),
    });
    for (const child of node.children) visit(child);
  };
  for (const root of roots(ctx)) visit(root);
  return out;
}
