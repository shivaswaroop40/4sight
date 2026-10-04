// src/experiences/continents/globeModel.ts
//
// Geometry for the cartoon globe. Each block becomes a chunky slab that
// hugs the sphere: a curved top, faceted side walls dropping below the
// ocean, and an ink rim along the coast. Outlines are triangulated in a
// gnomonic projection (great circles map to straight lines, so polygon
// edges stay edges) and then refined until no triangle edge is long enough
// to cut a chord into the sphere.

import * as THREE from "three";
import { THEME, addOutline, makeToonMaterial } from "../../core/theme";
import type { Polygon } from "./outlines";
import { arc, toVec, type LonLat } from "./sphere";

/** Longest triangle edge on the land surface, in radians (about 2 degrees). */
const MAX_EDGE = 0.035;
/** The walls reach this far below the ocean surface. */
const BASE_RADIUS = 0.985;
/** Width of the ink rim along each coast, in radians. */
const RIM_WIDTH = 0.0075;

interface Mesh2 {
  verts: THREE.Vector3[];
  tris: [number, number, number][];
}

export function triangulate(rings: Polygon): Mesh2 {
  // GeoJSON rings may repeat the first point at the end; earcut drops it, so we must too.
  const open = rings.map((ring) => {
    const [first, last] = [ring[0], ring[ring.length - 1]];
    return first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
  });
  const ringVerts = open.map((ring) => ring.map((p) => toVec(p)));
  const centre = ringVerts[0].reduce((sum, v) => sum.add(v), new THREE.Vector3()).normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(centre);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = centre.clone().cross(east);
  const project = (v: THREE.Vector3) => {
    const p = v.clone().divideScalar(v.dot(centre));
    return new THREE.Vector2(p.dot(east), p.dot(north));
  };
  const [outer, ...holes] = ringVerts.map((ring) => ring.map(project));
  const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
  const verts = ringVerts.flat();
  const tris = faces.map(([a, b, c]) => {
    const n = verts[b].clone().sub(verts[a]).cross(verts[c].clone().sub(verts[a]));
    return (n.dot(verts[a]) > 0 ? [a, b, c] : [a, c, b]) as [number, number, number];
  });
  return { verts, tris };
}

/** Splits every edge longer than MAX_EDGE, in both triangles that share it, until none are left. */
function refine(mesh: Mesh2): void {
  for (;;) {
    const mids = new Map<string, number>();
    const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    for (const t of mesh.tris) {
      for (let k = 0; k < 3; k++) {
        const a = t[k];
        const b = t[(k + 1) % 3];
        const id = key(a, b);
        if (!mids.has(id) && arc(mesh.verts[a], mesh.verts[b]) > MAX_EDGE) {
          mids.set(id, mesh.verts.push(mesh.verts[a].clone().add(mesh.verts[b]).normalize()) - 1);
        }
      }
    }
    if (mids.size === 0) return;
    const next: [number, number, number][] = [];
    for (const t of mesh.tris) {
      const m = [0, 1, 2].map((k) => mids.get(key(t[k], t[(k + 1) % 3])));
      const split = m.filter((x) => x !== undefined).length;
      if (split === 0) {
        next.push(t);
      } else if (split === 3) {
        const [ab, bc, ca] = m as number[];
        next.push([t[0], ab, ca], [ab, t[1], bc], [ca, bc, t[2]], [ab, bc, ca]);
      } else {
        // Rotate so edge 0 (a-b) is split, and for two splits, edge 1 (b-c) too.
        let r = 0;
        while (m[r] === undefined || (split === 2 && m[(r + 1) % 3] === undefined)) r++;
        const [a, b, c] = [t[r], t[(r + 1) % 3], t[(r + 2) % 3]];
        const ab = m[r]!;
        if (split === 1) {
          next.push([a, ab, c], [ab, b, c]);
        } else {
          const bc = m[(r + 1) % 3]!;
          next.push([ab, b, bc], [a, ab, bc], [a, bc, c]);
        }
      }
    }
    mesh.tris = next;
  }
}

/**
 * One block's land: a curved top (group 0), side walls (group 1) and an ink
 * rim just above the top (group 2), all in present-day coordinates.
 */
export function landGeometry(polygons: Polygon[], height: number): THREE.BufferGeometry {
  const top = 1 + height;
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  const groups: [number, number][] = [];

  const vertex = (p: THREE.Vector3, n: THREE.Vector3) => {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    return positions.length / 3 - 1;
  };

  const meshes = polygons.map((rings) => {
    const mesh = triangulate(rings);
    refine(mesh);
    return mesh;
  });

  // Coast edges, directed with the land on their left when seen from above.
  const coasts = meshes.map((mesh) => {
    const directed = new Set(mesh.tris.flatMap(([a, b, c]) => [`${a}:${b}`, `${b}:${c}`, `${c}:${a}`]));
    const edges: [number, number][] = [];
    for (const id of directed) {
      const [a, b] = id.split(":").map(Number);
      if (!directed.has(`${b}:${a}`)) edges.push([a, b]);
    }
    return edges;
  });

  let start = index.length;
  for (const mesh of meshes) {
    const base = positions.length / 3;
    for (const v of mesh.verts) vertex(v.clone().multiplyScalar(top), v);
    for (const [a, b, c] of mesh.tris) index.push(base + a, base + b, base + c);
  }
  groups.push([start, index.length - start]);

  start = index.length;
  meshes.forEach((mesh, m) => {
    for (const [i, j] of coasts[m]) {
      const vi = mesh.verts[i];
      const vj = mesh.verts[j];
      const outward = vj.clone().sub(vi).cross(vi.clone().add(vj)).normalize();
      const ti = vertex(vi.clone().multiplyScalar(top), outward);
      const tj = vertex(vj.clone().multiplyScalar(top), outward);
      const bi = vertex(vi.clone().multiplyScalar(BASE_RADIUS), outward);
      const bj = vertex(vj.clone().multiplyScalar(BASE_RADIUS), outward);
      index.push(ti, bi, bj, ti, bj, tj);
    }
  });
  groups.push([start, index.length - start]);

  start = index.length;
  meshes.forEach((mesh, m) => {
    const inward = new Map<number, THREE.Vector3>();
    for (const [i, j] of coasts[m]) {
      const left = mesh.verts[i].clone().add(mesh.verts[j]).cross(mesh.verts[j].clone().sub(mesh.verts[i])).normalize();
      for (const k of [i, j]) inward.set(k, (inward.get(k) ?? new THREE.Vector3()).add(left));
    }
    const rim = top + 0.0015;
    for (const [i, j] of coasts[m]) {
      const inner = (k: number) =>
        mesh.verts[k].clone().addScaledVector(inward.get(k)!.clone().normalize(), RIM_WIDTH).normalize().multiplyScalar(rim);
      const oi = vertex(mesh.verts[i].clone().multiplyScalar(rim), mesh.verts[i]);
      const oj = vertex(mesh.verts[j].clone().multiplyScalar(rim), mesh.verts[j]);
      const ii = vertex(inner(i), mesh.verts[i]);
      const ij = vertex(inner(j), mesh.verts[j]);
      index.push(oi, oj, ij, oi, ij, ii);
    }
  });
  groups.push([start, index.length - start]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  groups.forEach(([s, count], i) => geometry.addGroup(s, count, i));
  geometry.computeBoundingSphere();
  return geometry;
}

export function inkMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: THEME.ink, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
}

/** A unit mountain: a five-sided rock cone with a snow cap, base at y = 0, apex at y = 1. */
export function peakGeometry(): THREE.BufferGeometry {
  const rock = new THREE.ConeGeometry(1, 1, 5, 1, true).translate(0, 0.5, 0);
  const snow = new THREE.ConeGeometry(0.3, 0.29, 5, 1, true).translate(0, 0.86, 0);
  const geometry = new THREE.BufferGeometry();
  const merged = [rock, snow];
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  merged.forEach((g, i) => {
    const offset = positions.length / 3;
    positions.push(...g.getAttribute("position").array);
    normals.push(...g.getAttribute("normal").array);
    const start = index.length;
    for (const k of g.getIndex()!.array) index.push(offset + k);
    geometry.addGroup(start, index.length - start, i);
    g.dispose();
  });
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Evenly spaced points along a path on the sphere, about `spacing` radians apart. */
export function samplePath(path: LonLat[], spacing: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = toVec(path[i]);
    const b = toVec(path[i + 1]);
    const n = Math.max(1, Math.round(arc(a, b) / spacing));
    for (let k = 0; k < n; k++) points.push(a.clone().lerp(b, k / n).normalize());
  }
  points.push(toVec(path[path.length - 1]));
  return points;
}

/**
 * Today's coastlines as dashed ink lines floating just above the tallest
 * land, so they read over both the ocean and the drifting blocks.
 */
export function coastlineGhosts(outlines: readonly Polygon[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "today-coastlines";
  const material = new THREE.LineDashedMaterial({
    color: THEME.ink,
    dashSize: 0.024,
    gapSize: 0.016,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  // Lines above the surface peek over the horizon from the far side; fade them out toward the limb.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying float vFacing;\nvoid main() {")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvec3 world = (modelMatrix * vec4(position, 1.0)).xyz;\nvFacing = dot(normalize(world), normalize(cameraPosition - world));",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vFacing;\nvoid main() {")
      .replace("#include <opaque_fragment>", "diffuseColor.a *= smoothstep(0.05, 0.3, vFacing);\n#include <opaque_fragment>");
  };
  for (const [coast] of outlines) {
    const points = samplePath([...coast, coast[0]], 0.01).map((p) => p.multiplyScalar(1.03));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    line.computeLineDistances();
    line.raycast = () => {};
    group.add(line);
  }
  return group;
}

export function oceanMesh(): THREE.Mesh {
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), makeToonMaterial("#8FC6C6"));
  ocean.name = "ocean";
  addOutline(ocean, 0.018);
  return ocean;
}

/** A faint ink ring around the equator, so you can see who crosses it. */
export function equatorRing(): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0015, 0.0022, 6, 256),
    new THREE.MeshBasicMaterial({ color: THEME.ink, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.raycast = () => {};
  return ring;
}

const LABEL_STYLES = {
  /** Ink italics with a cream halo, like sea names on an old map. */
  ocean: { font: "italic 600 64px", spacing: "0px", fill: THEME.ink, halo: THEME.cream, height: 0.11 },
  /** Chunky cream capitals with an ink edge, sitting on the land. */
  land: { font: "700 72px", spacing: "10px", fill: THEME.cream, halo: THEME.ink, height: 0.13 },
} as const;

export function labelSprite(text: string, kind: keyof typeof LABEL_STYLES): THREE.Sprite {
  const style = LABEL_STYLES[kind];
  const canvas = document.createElement("canvas");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const draw = () => {
    const ctx = canvas.getContext("2d")!;
    const setFont = () => {
      ctx.font = `${style.font} Fredoka, Nunito, ui-rounded, system-ui, sans-serif`;
      ctx.letterSpacing = style.spacing;
    };
    setFont();
    const width = Math.ceil(ctx.measureText(text).width) + 48;
    // A web font arriving late can change the width; a resized canvas needs a fresh GPU texture.
    if (canvas.width !== width) texture.dispose();
    canvas.width = width;
    canvas.height = 112;
    setFont();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.strokeStyle = style.halo;
    ctx.strokeText(text, width / 2, 58);
    ctx.fillStyle = style.fill;
    ctx.fillText(text, width / 2, 58);
    texture.needsUpdate = true;
    sprite.scale.set((style.height * width) / canvas.height, style.height, 1);
  };
  draw();
  document.fonts?.ready.then(draw);
  return sprite;
}
