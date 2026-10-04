// src/experiences/tree/treeMaterials.ts
//
// Materials and shared geometry for the oak. Branches are one instanced
// unit cylinder each kind, tapered per instance in the vertex shader so
// every segment can be thick at the base and thin at the tip. Outlines for
// instanced meshes are a second instanced mesh sharing the same matrices.

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THEME, makeToonMaterial } from "../../core/theme";

export const PALETTE = {
  bark: "#8B6B52",
  barkDark: "#6E5242",
  root: "#C9A27A",
  deadwood: "#9A8F7A",
  wound: "#EBD3A6",
  grass: "#9DBE6E",
  grassDeep: "#7FA65A",
  topsoil: "#6B4A36",
  subsoil: "#A2744D",
  clay: "#C79A6B",
  rock: "#B8A58C",
  leafSpring: "#C2D46C",
  leafSummer: "#79A257",
  leafSummerDeep: "#5F8B4A",
  leafAutumn: "#D9A743",
  leafAutumnLate: "#B86A38",
  leafDead: "#9E7350",
  acornGreen: "#A9B865",
  acornRipe: "#9A6436",
  cup: "#8A7356",
} as const;

/** Unit cylinder from y = 0 to y = 1 with a per-instance taper attribute. */
export function taperedCylinder(count: number, radialSegments = 10): THREE.BufferGeometry {
  // Open ends: joint spheres close the bends, and caps would draw ink rings at every joint.
  const g = new THREE.CylinderGeometry(1, 1, 1, radialSegments, 1, true);
  g.translate(0, 0.5, 0);
  g.setAttribute("aTaper", new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1));
  return g;
}

const TAPER_COMMON = "#include <common>\nattribute float aTaper;";
const TAPER_VERTEX = "vec3 transformed = vec3(position);\ntransformed.xz *= mix(1.0, aTaper, clamp(position.y, 0.0, 1.0));";

export function taperedToonMaterial(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  const m = makeToonMaterial(color);
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", TAPER_COMMON)
      .replace("#include <begin_vertex>", TAPER_VERTEX);
  };
  m.customProgramCacheKey = () => "tree-taper";
  return m;
}

/**
 * Ink hull for an instanced mesh. The push is in the unit shape's space, so
 * after the instance scale a thick trunk gets a thick line and a twig a fine one.
 */
export function instancedOutline(mesh: THREE.InstancedMesh, thickness: number, tapered = false): THREE.InstancedMesh {
  const material = new THREE.MeshBasicMaterial({ color: THEME.ink, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `${tapered ? TAPER_COMMON : "#include <common>"}\nuniform float uOutline;`)
      .replace(
        "#include <begin_vertex>",
        tapered
          ? `${TAPER_VERTEX}\ntransformed += normalize(normal) * uOutline * mix(1.0, aTaper, clamp(position.y, 0.0, 1.0));`
          : "vec3 transformed = position + normalize(normal) * uOutline;",
      );
  };
  material.customProgramCacheKey = () => `tree-outline-${thickness}-${tapered}`;
  const outline = new THREE.InstancedMesh(mesh.geometry, material, mesh.count);
  outline.instanceMatrix = mesh.instanceMatrix;
  outline.name = "outline";
  outline.raycast = () => {};
  outline.frustumCulled = false;
  return outline;
}

/** A lumpy cartoon foliage blob, radius about 1. */
export function blobGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const merged = mergeVertices(g, 1e-4);
  g.dispose();
  const p = merged.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const bump = 1 + 0.09 * Math.sin(v.x * 5.1 + v.y * 2.3) * Math.cos(v.z * 4.7 - v.y * 1.9) + 0.05 * Math.sin(v.y * 9.0 + v.x * 3.0);
    // Flatter underneath, the way a clump of leaves hangs.
    const squash = v.y < 0 ? 0.78 : 1;
    p.setXYZ(i, v.x * bump, v.y * bump * squash, v.z * bump);
  }
  merged.computeVertexNormals();
  return merged;
}

/** An English oak leaf: deep rounded lobes, almost no stalk. Base at the origin, tip along +y, length 1. */
export function oakLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const lobes = 4;
  const pts: THREE.Vector2[] = [];
  // Widest above the middle, with small ear-like lobes at the base.
  const width = (y: number) => 0.36 * Math.sin(Math.PI * Math.pow(y, 0.75)) + 0.035 * (1 - y);
  for (let i = 0; i <= 96; i++) {
    const y = i / 96;
    const s = Math.sin(y * Math.PI * (lobes + 0.5));
    // Smooth at the sinuses (no sharp notches), broad rounded lobes.
    const wave = 0.5 + 0.5 * (1 - (1 - s * s) ** 2);
    pts.push(new THREE.Vector2(width(y) * wave, y));
  }
  shape.moveTo(0, 0);
  for (const p of pts) shape.lineTo(p.x, p.y);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(-pts[i].x, pts[i].y);
  shape.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(shape, 1);
  // A gentle fold along the midrib so the toon light catches two halves.
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.2);
  g.computeVertexNormals();
  return g;
}

/** A leaf-shaped ink card a little larger than the leaf, drawn behind it as its outline. */
export function leafInkGeometry(leaf: THREE.BufferGeometry, grow = 0.16): THREE.BufferGeometry {
  const g = leaf.clone();
  g.translate(0, -0.5, 0);
  g.scale(1 + grow * 1.6, 1 + grow * 0.5, 1);
  g.translate(0, 0.5, 0);
  return g;
}

/**
 * Round stones: one jittered sphere per cell, sliced by the surface. Returns the
 * nearest stone's distance (1 at its edge) and its radius in cells.
 */
const STONES = /* glsl */ `
vec2 stoneDist(vec3 p, float cell, float keep) {
  vec3 q = p / cell;
  vec3 id = floor(q);
  vec2 best = vec2(1.0, 0.3);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 c = id + vec3(float(x), float(y), float(z));
    vec3 h = fract(sin(vec3(dot(c, vec3(127.1, 311.7, 74.7)), dot(c, vec3(269.5, 183.3, 246.1)), dot(c, vec3(113.5, 271.9, 124.6)))) * 43758.5453);
    if (h.x < keep) continue;
    float r = 0.22 + 0.2 * h.y;
    float d = length(q - (c + 0.25 + 0.5 * h)) / r;
    if (d < best.x) best = vec2(d, r);
  }
  return best;
}

/**
 * Stone colour over a base, with an ink rim so it reads as a cartoon pebble.
 * px is one pixel's footprint in p's units, taken by the caller with fwidth in
 * uniform control flow: a derivative inside the depth branches is undefined on
 * pixels whose quad neighbours skip the branch, and shimmers frame to frame.
 */
vec3 stone(vec3 col, vec3 p, float px, float cell, float keep, vec3 tint, vec3 ink) {
  vec2 s = stoneDist(p, cell, keep);
  float aa = px / (cell * s.y) * 1.2;
  float fill = 1.0 - smoothstep(1.0 - aa, 1.0, s.x);
  float rim = smoothstep(0.86 - aa, 0.86, s.x);
  return mix(col, mix(tint, ink, rim * 0.75), fill);
}
`;

/**
 * Toon material for the hill: grass on top, then topsoil, subsoil, clay and
 * rock by depth below the surface, so the cutaway faces and the cliff show
 * the same layers.
 */
export function strataMaterial(radius: number, dome: number): THREE.MeshToonMaterial {
  const m = makeToonMaterial("#ffffff", { side: THREE.DoubleSide });
  const c = (hex: string) => {
    const col = new THREE.Color(hex);
    return `vec3(${col.r.toFixed(4)}, ${col.g.toFixed(4)}, ${col.b.toFixed(4)})`;
  };
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vStrata;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvStrata = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vStrata;\n${STONES}`)
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `float px = length(fwidth(vStrata));
        float rr = length(vStrata.xz);
        float top = -${dome.toFixed(3)} * (rr * rr) / ${(radius * radius).toFixed(3)};
        float depth = top - vStrata.y;
        float ang = atan(vStrata.z, vStrata.x);
        float wob = sin(ang * 9.0 + rr * 1.7) * 0.5 + sin(rr * 4.3 + vStrata.y * 2.0) * 0.5;
        vec3 col = ${c(PALETTE.grass)};
        if (depth > 0.05 + 0.012 * wob) col = ${c(PALETTE.topsoil)};
        if (depth > 0.6 + 0.08 * wob) col = ${c(PALETTE.subsoil)};
        if (depth > 2.4 + 0.3 * wob) col = ${c(PALETTE.clay)};
        if (depth > 4.4 + 0.4 * wob) col = ${c(PALETTE.rock)};
        if (depth > 0.05) {
          vec3 ink = ${c("#4A3528")};
          col = stone(col, vStrata, px, 0.035, 0.6, col * 0.84, col * 0.84);
          col = stone(col, vStrata + 3.1, px, 0.06, 0.84, ${c(PALETTE.rock)}, ink);
          if (depth > 0.6) col = stone(col, vStrata + 7.7, px, 0.7, 0.86, ${c("#D8C8AE")}, ink);
        }
        vec4 diffuseColor = vec4(col, opacity);`,
      );
  };
  m.customProgramCacheKey = () => "tree-strata";
  return m;
}
