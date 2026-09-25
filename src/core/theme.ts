// src/core/theme.ts
//
// The 4sight look, shared by every lane: a warm beige picture-book palette,
// toon shading, and ink outlines. The CSS custom properties in src/index.css
// use the same values.
//
//   import { THEME, makeToonMaterial, addOutline, disposeObject } from "../../core/theme";
//   const mesh = new THREE.Mesh(geometry, makeToonMaterial(THEME.terracotta));
//   addOutline(mesh);             // ink hull, child of mesh
//   scene.add(mesh);
//   ...
//   disposeObject(mesh);          // in dispose(): frees geometry + materials of the subtree

import * as THREE from "three";

export const THEME = {
  /** Page background. */
  paper: "#F3E9D7",
  /** Cards and panels. */
  cream: "#FBF5EA",
  /** Text, outlines, sticker shadows. */
  ink: "#3B2F2A",
  inkSoft: "#7A6A5F",
  terracotta: "#E07A5F",
  mustard: "#F2CC8F",
  sage: "#81B29A",
  plum: "#9C6B98",
  /** Warm light colours for scenes. */
  sunlight: "#FFF1DC",
  shadow: "#C9B79C",
} as const;

export type ThemeColor = keyof typeof THEME;

let gradientMap: THREE.DataTexture | null = null;

/** A shared 4-step toon ramp. Never disposed: every toon material reuses it. */
export function toonGradient(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const steps = new Uint8Array([90, 90, 90, 255, 165, 165, 165, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(steps, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

/** Cel-shaded material in a theme colour (or any colour). */
export function makeToonMaterial(
  color: THREE.ColorRepresentation,
  options: THREE.MeshToonMaterialParameters = {},
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...options });
}

/**
 * Adds an inverted-hull ink outline as a child of `mesh`. The hull shares the
 * mesh geometry and is pushed out along vertex normals by `thickness` world
 * units, so it reads best on smooth geometry (spheres, RoundedBoxGeometry).
 * Returns the outline so callers can hide or restyle it.
 */
export function addOutline(
  mesh: THREE.Mesh,
  thickness = 0.03,
  color: THREE.ColorRepresentation = THEME.ink,
): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uOutline;")
      .replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * uOutline;");
  };
  // Different thicknesses need different programs.
  material.customProgramCacheKey = () => `outline-${thickness}`;
  const outline = new THREE.Mesh(mesh.geometry, material);
  outline.name = "outline";
  outline.raycast = () => {};
  mesh.add(outline);
  return outline;
}

/** Disposes every geometry and material in a subtree and removes it from its parent. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const withGeometry = node as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    withGeometry.geometry?.dispose();
    const material = withGeometry.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
  root.removeFromParent();
}

/** Warm key + fill lights that suit toon materials. Returns the group so dispose can remove it. */
export function addWarmLights(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = "warm-lights";
  const key = new THREE.DirectionalLight(THEME.sunlight, 2.4);
  key.position.set(4, 6, 5);
  const hemi = new THREE.HemisphereLight("#FFF6E8", "#D9C3A5", 1.4);
  group.add(key, hemi);
  scene.add(group);
  return group;
}
