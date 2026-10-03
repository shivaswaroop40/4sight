// src/experiences/tree/treeIsland.ts
//
// The grassy hill the oak grows on: a floating island with a wedge cut out
// toward the camera, so the soil layers and roots show in cross-section.
// The trunk stands on the wedge's inner edge.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addOutline, makeToonMaterial } from "../../core/theme";
import { PALETTE, oakLeafGeometry, strataMaterial } from "./treeMaterials";
import { NOTCH_AZIMUTH, NOTCH_HALF_ANGLE } from "./treeSkeleton";

export const ISLAND_RADIUS = 15;
export const ISLAND_DOME = 0.7;

/** Ground height at distance r from the trunk. */
export function groundY(r: number): number {
  return -ISLAND_DOME * (r / ISLAND_RADIUS) ** 2;
}

/** Inside the cutaway wedge (no soil there). */
export function inNotch(x: number, z: number): boolean {
  const az = (Math.atan2(z, x) * 180) / Math.PI;
  let d = Math.abs(az - NOTCH_AZIMUTH) % 360;
  if (d > 180) d = 360 - d;
  return d < NOTCH_HALF_ANGLE + 2;
}

function profile(): THREE.Vector2[] {
  const R = ISLAND_RADIUS;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const r = (i / 24) * R * 0.97;
    pts.push(new THREE.Vector2(r, groundY(r)));
  }
  // Rounded lip, then a craggy underside tapering to a point.
  const lip: [number, number][] = [
    [R * 0.995, groundY(R) - 0.12],
    [R, groundY(R) - 0.45],
    [R * 0.97, -1.7],
    [R * 0.88, -2.9],
    [R * 0.74, -3.9],
    [R * 0.56, -5.1],
    [R * 0.38, -6.2],
    [R * 0.2, -7.3],
    [R * 0.07, -8.0],
    [0, -8.2],
  ];
  for (const [r, y] of lip) pts.push(new THREE.Vector2(r, y));
  return pts;
}

export interface Island {
  group: THREE.Group;
  /** Meshes that count as "soil" for hover. */
  ground: THREE.Mesh[];
}

export function buildIsland(): Island {
  const group = new THREE.Group();
  group.name = "island";
  const material = strataMaterial(ISLAND_RADIUS, ISLAND_DOME);
  const pts = profile();

  // LatheGeometry puts phi = 0 on +z and sweeps toward +x, so azimuth = 90 - phi.
  const notchStart = 90 - (NOTCH_AZIMUTH + NOTCH_HALF_ANGLE);
  const phiStart = THREE.MathUtils.degToRad(notchStart + 2 * NOTCH_HALF_ANGLE);
  const phiLength = THREE.MathUtils.degToRad(360 - 2 * NOTCH_HALF_ANGLE);
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(pts, 96, phiStart, phiLength), material);
  lathe.name = "hill";
  addOutline(lathe, 0.06);
  group.add(lathe);

  // The two cut faces of the wedge.
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
  const faces: THREE.BufferGeometry[] = [];
  for (const azimuth of [NOTCH_AZIMUTH - NOTCH_HALF_ANGLE, NOTCH_AZIMUTH + NOTCH_HALF_ANGLE]) {
    const g = new THREE.ShapeGeometry(shape, 12);
    g.rotateY(-THREE.MathUtils.degToRad(azimuth));
    faces.push(g);
  }
  const cut = new THREE.Mesh(mergeGeometries(faces), material);
  cut.name = "cutaway";
  faces.forEach((f) => f.dispose());
  group.add(cut);

  // A rolled turf lip along the top of each cut face. It stops short of the
  // trunk so it never hides the seedling's stem.
  const edgeMaterial = makeToonMaterial(PALETTE.grassDeep);
  const lipPoints = [new THREE.Vector2(0.25, groundY(0.25)), ...pts.slice(1, 26)];
  for (const azimuth of [NOTCH_AZIMUTH - NOTCH_HALF_ANGLE, NOTCH_AZIMUTH + NOTCH_HALF_ANGLE]) {
    const curve = new THREE.CatmullRomCurve3(
      lipPoints.map((p) => {
        const a = THREE.MathUtils.degToRad(azimuth);
        return new THREE.Vector3(Math.cos(a) * p.x, p.y + 0.01, Math.sin(a) * p.x);
      }),
    );
    const lip = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.014, 6, false), edgeMaterial);
    group.add(lip);
  }

  return { group, ground: [lathe, cut] };
}

/** Grass tufts scattered over the hill, leaving the wedge and a clearing at the trunk. */
export function buildGrass(seed = 7): THREE.InstancedMesh {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.ConeGeometry(0.06, 1, 4, 1);
    b.translate(0, 0.5, 0);
    b.rotateZ((i - 2) * 0.22);
    b.rotateY(i * 1.3);
    b.scale(1, 0.75 + (i % 3) * 0.15, 1);
    blades.push(b);
  }
  const tuft = mergeGeometries(blades);
  blades.forEach((b) => b.dispose());

  const count = 1400;
  const mesh = new THREE.InstancedMesh(tuft, makeToonMaterial("#ffffff"), count);
  mesh.name = "grass";
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  let placed = 0;
  while (placed < count) {
    // Bias toward the trunk so the seedling has grass around it, kept short
    // there (a grazed sward) so it does not hide the seedling.
    const r = 0.3 + Math.pow(rand(), 1.4) * (ISLAND_RADIUS * 0.95);
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inNotch(x, z)) continue;
    const h = r < 2.5 ? 0.025 + rand() * 0.03 + r * 0.012 : 0.12 + rand() * 0.25 + r * 0.012;
    q.setFromEuler(new THREE.Euler(rand() * 0.2 - 0.1, rand() * 6.28, rand() * 0.2 - 0.1));
    m.compose(new THREE.Vector3(x, groundY(r) - 0.01, z), q, new THREE.Vector3(h * 0.9, h, h * 0.9));
    mesh.setMatrixAt(placed, m);
    color.set(rand() < 0.5 ? PALETTE.grass : PALETTE.grassDeep).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.raycast = () => {};
  return mesh;
}

/** Old fallen leaves around the spot where the jay buried its acorn. */
export function buildLitter(seed = 19): THREE.InstancedMesh {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const count = 26;
  const mesh = new THREE.InstancedMesh(oakLeafGeometry(), makeToonMaterial("#ffffff", { side: THREE.DoubleSide }), count);
  mesh.name = "litter";
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  const shades = [PALETTE.leafDead, "#8E6A4E", "#9A7A5C", "#7E624C"];
  let placed = 0;
  while (placed < count) {
    const r = 0.06 + Math.sqrt(rand()) * 0.38;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inNotch(x, z)) continue;
    q.setFromEuler(new THREE.Euler(-Math.PI / 2 + (rand() - 0.5) * 0.3, 0, rand() * Math.PI * 2, "XZY"));
    const size = 0.035 + rand() * 0.025;
    m.compose(new THREE.Vector3(x, groundY(r) + 0.002 + placed * 0.00004, z), q, new THREE.Vector3(size, size, size));
    mesh.setMatrixAt(placed, m);
    mesh.setColorAt(placed, color.set(shades[Math.floor(rand() * shades.length)]));
    placed++;
  }
  mesh.computeBoundingSphere();
  mesh.raycast = () => {};
  return mesh;
}
