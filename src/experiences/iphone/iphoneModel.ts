// src/experiences/iphone/iphoneModel.ts
//
// Geometry for each iPhone part, in the toon style from core/theme. Each
// builder returns a group centred on the part's assembled position. The
// phone faces +z: display at the front, back glass and cameras at -z.

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { THEME, addOutline, makeToonMaterial } from "../../core/theme";

export const PHONE = { width: 2.91, height: 6, depth: 0.32, radius: 0.42 } as const;

const BODY = THEME.sage;
const METAL = "#D8CFC2";
const GLASS = "#2A2320";

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  addRoundedRect(shape, w, h, r);
  return shape;
}

function addRoundedRect(path: THREE.Path, w: number, h: number, r: number): void {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.quadraticCurveTo(x + w, y, x + w, y + rr);
  path.lineTo(x + w, y + h - rr);
  path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  path.lineTo(x + rr, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - rr);
  path.lineTo(x, y + rr);
  path.quadraticCurveTo(x, y, x + rr, y);
}

/** A rounded-rectangle slab (rounded in plan view), centred, with a small bevel. */
export function roundedSlab(w: number, h: number, d: number, r: number, bevel = 0.02): THREE.BufferGeometry {
  const b = Math.min(bevel, d / 3);
  const shape = roundedRectShape(w - 2 * b, h - 2 * b, Math.max(0.001, r - b));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * b,
    bevelEnabled: true,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geometry.translate(0, 0, -(d - 2 * b) / 2);
  return geometry;
}

function ring(w: number, h: number, d: number, r: number, wall: number): THREE.BufferGeometry {
  const shape = roundedRectShape(w, h, r);
  const hole = new THREE.Path();
  addRoundedRect(hole, w - 2 * wall, h - 2 * wall, r - wall);
  shape.holes.push(hole);
  const b = 0.02;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * b,
    bevelEnabled: true,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -(d - 2 * b) / 2);
  return geometry;
}

/** Ink outline with smoothed normals, so the hull has no gaps at hard edges. */
function outline(mesh: THREE.Mesh, thickness = 0.02): void {
  const hull = addOutline(mesh, thickness);
  const g = mesh.geometry.clone();
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const smooth = mergeVertices(g, 1e-3);
  g.dispose();
  smooth.computeVertexNormals();
  hull.geometry = smooth;
}

function mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.Mesh {
  return new THREE.Mesh(geometry, makeToonMaterial(color));
}

function pill(len: number, radius: number, color: THREE.ColorRepresentation): THREE.Mesh {
  return mesh(new THREE.CapsuleGeometry(radius, len, 4, 10), color);
}

function frame(): THREE.Group {
  const g = new THREE.Group();
  const band = mesh(ring(PHONE.width, PHONE.height, PHONE.depth, PHONE.radius, 0.1), METAL);
  outline(band);
  g.add(band);
  // USB-C port on the bottom edge.
  const port = pill(0.26, 0.05, GLASS);
  port.rotation.z = Math.PI / 2;
  port.position.set(0, -PHONE.height / 2 - 0.005, 0);
  g.add(port);
  // Speaker and mic holes either side.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const hole = mesh(new THREE.SphereGeometry(0.03, 8, 6), GLASS);
      hole.position.set(side * (0.42 + i * 0.1), -PHONE.height / 2 - 0.005, 0);
      g.add(hole);
    }
  }
  return g;
}

function logicBoard(): THREE.Group {
  const g = new THREE.Group();
  const board = mesh(roundedSlab(2.4, 2.3, 0.06, 0.28), THEME.sage);
  outline(board);
  g.add(board);
  const soc = mesh(roundedSlab(0.72, 0.72, 0.1, 0.1), THEME.ink);
  soc.position.set(-0.3, -0.1, 0.06);
  const socMark = mesh(roundedSlab(0.4, 0.4, 0.02, 0.06), THEME.inkSoft);
  socMark.position.set(-0.3, -0.1, 0.115);
  g.add(soc, socMark);
  const chips: Array<[number, number, number, number, string]> = [
    [0.6, 0.5, 0.4, 0.28, THEME.mustard],
    [0.65, -0.35, 0.36, 0.36, THEME.ink],
    [-0.75, 0.75, 0.42, 0.22, THEME.terracotta],
    [0.1, 0.8, 0.3, 0.2, THEME.plum],
    [-0.8, -0.8, 0.3, 0.3, THEME.mustard],
  ];
  for (const [x, y, w, h, color] of chips) {
    const chip = mesh(roundedSlab(w, h, 0.06, 0.05), color);
    chip.position.set(x, y, 0.05);
    g.add(chip);
  }
  return g;
}

function battery(): THREE.Group {
  const g = new THREE.Group();
  const cell = mesh(roundedSlab(2.3, 3.3, 0.12, 0.3), THEME.mustard);
  outline(cell);
  g.add(cell);
  const stripe = mesh(roundedSlab(2.0, 0.14, 0.02, 0.05), THEME.terracotta);
  stripe.position.set(0, 0.9, 0.065);
  const tab = mesh(roundedSlab(0.5, 0.24, 0.05, 0.06), THEME.ink);
  tab.position.set(0.5, 1.72, 0);
  g.add(stripe, tab);
  return g;
}

function tapticEngine(): THREE.Group {
  const g = new THREE.Group();
  const body = pill(0.6, 0.14, THEME.plum);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 1, 0.6);
  outline(body, 0.015);
  g.add(body);
  return g;
}

function speaker(): THREE.Group {
  const g = new THREE.Group();
  const box = mesh(roundedSlab(0.95, 0.42, 0.14, 0.12), THEME.terracotta);
  outline(box, 0.015);
  g.add(box);
  for (let i = 0; i < 6; i++) {
    const dot = mesh(new THREE.SphereGeometry(0.035, 8, 6), THEME.ink);
    dot.position.set(-0.3 + i * 0.12, 0, 0.07);
    g.add(dot);
  }
  return g;
}

function lens(radius: number): THREE.Group {
  const g = new THREE.Group();
  const outer = mesh(new THREE.CylinderGeometry(radius, radius, 0.08, 28), METAL);
  outer.rotation.x = Math.PI / 2;
  outline(outer, 0.012);
  const glass = mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.09, 28), GLASS);
  glass.rotation.x = Math.PI / 2;
  const highlight = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.16, 12), new THREE.MeshBasicMaterial({ color: "#FFFFFF" }));
  highlight.position.set(radius * 0.25, radius * 0.25, -0.047);
  highlight.rotation.y = Math.PI;
  g.add(outer, glass, highlight);
  return g;
}

/** Lenses, flash, and mic. The plateau they sit on belongs to the back glass. */
function mainCamera(): THREE.Group {
  const g = new THREE.Group();
  const upper = lens(0.3);
  upper.position.set(0.25, 0.25, -0.05);
  const lower = lens(0.3);
  lower.position.set(-0.25, -0.25, -0.05);
  const flash = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), THEME.cream);
  flash.rotation.x = Math.PI / 2;
  flash.position.set(-0.3, 0.3, -0.055);
  const mic = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), GLASS);
  mic.rotation.x = Math.PI / 2;
  mic.position.set(0.3, -0.3, -0.055);
  g.add(upper, lower, flash, mic);
  return g;
}

export const CAMERA_PLATEAU_CENTER = [0.78, 2.3] as const;

function backGlass(): THREE.Group {
  const g = new THREE.Group();
  const glass = mesh(roundedSlab(PHONE.width - 0.08, PHONE.height - 0.08, 0.04, PHONE.radius - 0.04), BODY);
  outline(glass);
  g.add(glass);
  const plateau = mesh(roundedSlab(1.3, 1.3, 0.05, 0.3), BODY);
  plateau.position.set(CAMERA_PLATEAU_CENTER[0], CAMERA_PLATEAU_CENTER[1], -0.04);
  outline(plateau, 0.015);
  g.add(plateau);
  return g;
}

function sideButtons(): THREE.Group {
  const g = new THREE.Group();
  const left = -PHONE.width / 2 - 0.015;
  const right = PHONE.width / 2 + 0.015;
  const specs: Array<[number, number, number]> = [
    [left, 1.95, 0.14], // action button
    [left, 1.35, 0.3], // volume up
    [left, 0.8, 0.3], // volume down
    [right, 1.1, 0.5], // side button
  ];
  for (const [x, y, len] of specs) {
    const b = pill(len, 0.045, METAL);
    b.position.set(x, y, 0);
    b.userData.baseX = x;
    outline(b, 0.01);
    g.add(b);
  }
  return g;
}

function display(): THREE.Group {
  const g = new THREE.Group();
  const panel = mesh(roundedSlab(PHONE.width - 0.06, PHONE.height - 0.06, 0.04, PHONE.radius - 0.03), "#1C1715");
  outline(panel);
  g.add(panel);
  return g;
}

function dynamicIsland(): THREE.Group {
  const g = new THREE.Group();
  const island = pill(0.5, 0.1, "#141010");
  island.rotation.z = Math.PI / 2;
  island.scale.set(1, 1, 0.3);
  // Drawn after the lit screen so the pill always sits on top of it.
  (island.material as THREE.Material).transparent = true;
  island.renderOrder = 20;
  g.add(island);
  return g;
}

export const PART_BUILDERS: Record<string, () => THREE.Group> = {
  frame,
  "logic-board": logicBoard,
  battery,
  "taptic-engine": tapticEngine,
  speaker,
  "main-camera": mainCamera,
  "side-buttons": sideButtons,
  "back-glass": backGlass,
  display,
  "dynamic-island": dynamicIsland,
};

// ---- Screen, face, sparkles -------------------------------------------------

export const SCREEN = { width: PHONE.width - 0.2, height: PHONE.height - 0.2, radius: PHONE.radius - 0.1 } as const;

/** A rounded-rectangle plane with 0..1 UVs across its bounds. */
function roundedPlane(w: number, h: number, r: number): THREE.BufferGeometry {
  const geometry = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 12);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  }
  return geometry;
}

function drawWallpaper(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1056;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, THEME.plum);
  grad.addColorStop(0.45, THEME.terracotta);
  grad.addColorStop(0.85, THEME.mustard);
  grad.addColorStop(1, THEME.cream);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // A soft sun sitting on the horizon.
  ctx.fillStyle = "rgba(251, 245, 234, 0.55)";
  ctx.beginPath();
  ctx.arc(256, 960, 190, Math.PI, 0);
  ctx.fill();
  // Rolling hills.
  ctx.fillStyle = "rgba(129, 178, 154, 0.9)";
  ctx.beginPath();
  ctx.moveTo(0, 960);
  ctx.quadraticCurveTo(160, 880, 300, 950);
  ctx.quadraticCurveTo(420, 1000, 512, 930);
  ctx.lineTo(512, 1056);
  ctx.lineTo(0, 1056);
  ctx.fill();
  // Status bar clock.
  ctx.fillStyle = THEME.cream;
  ctx.font = "bold 34px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("9:41", 48, 72);
  return canvas;
}

export interface Screen {
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  texture: THREE.CanvasTexture;
}

export function buildScreen(): Screen {
  const texture = new THREE.CanvasTexture(drawWallpaper());
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const plane = new THREE.Mesh(roundedPlane(SCREEN.width, SCREEN.height, SCREEN.radius), material);
  plane.position.z = 0.032;
  plane.renderOrder = 1;
  const group = new THREE.Group();
  group.name = "screen";
  group.add(plane);
  return { group, materials: [material], texture };
}

export interface Eye {
  open: THREE.Group;
  closed: THREE.Mesh;
}

export interface Face {
  group: THREE.Group;
  eyes: Eye[];
  pupils: THREE.Group[];
  smile: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[];
}

function faceMaterial(color: THREE.ColorRepresentation, materials: THREE.MeshBasicMaterial[]): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  materials.push(m);
  return m;
}

/** Two big friendly eyes, rosy cheeks, and a smile, drawn as flat meshes on the screen. */
export function buildFace(): Face {
  const materials: THREE.MeshBasicMaterial[] = [];
  const ink = faceMaterial(THEME.ink, materials);
  const white = faceMaterial("#FFFFFF", materials);
  const pupil = faceMaterial("#2A2320", materials);
  const cheek = faceMaterial(THEME.terracotta, materials);
  const group = new THREE.Group();
  group.name = "face";
  group.position.z = 0.038;
  const eyes: Eye[] = [];
  const pupils: THREE.Group[] = [];
  let order = 2;
  const layer = (m: THREE.Mesh, z: number) => {
    m.position.z = z;
    m.renderOrder = order++;
    return m;
  };
  for (const side of [-1, 1]) {
    const open = new THREE.Group();
    open.position.set(side * 0.55, 0.55, 0);
    const rim = layer(new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), ink), 0);
    rim.scale.set(0.82, 1.1, 1);
    const sclera = layer(new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), white), 0.002);
    sclera.scale.set(0.82, 1.1, 1);
    const look = new THREE.Group();
    const iris = layer(new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), pupil), 0.004);
    const shine = layer(new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), white), 0.006);
    shine.position.set(0.07, 0.08, 0.006);
    const shine2 = layer(new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), white), 0.006);
    shine2.position.set(-0.06, -0.08, 0.006);
    look.add(iris, shine, shine2);
    open.add(rim, sclera, look);
    pupils.push(look);
    // Closed eye: a sleepy downward arc.
    const closed = layer(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 24, Math.PI), ink), 0);
    closed.rotation.z = Math.PI;
    closed.position.set(side * 0.55, 0.62, 0);
    group.add(open, closed);
    eyes.push({ open, closed });
    const blush = layer(new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), cheek), 0);
    blush.scale.set(1.3, 0.8, 1);
    blush.position.set(side * 0.9, -0.05, 0);
    group.add(blush);
  }
  const smile = layer(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 32, Math.PI), ink), 0);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.12, 0);
  group.add(smile);
  return { group, eyes, pupils, smile, materials };
}

function starShape(outer: number, inner: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export const SPARKLE_SPOTS: Array<[number, number, number, number]> = [
  // x, y, z, size
  [-2.3, 2.6, 0.4, 0.34],
  [2.3, 3.1, 0.2, 0.28],
  [2.6, 0.9, 0.5, 0.22],
  [-2.5, 0.2, 0.3, 0.24],
  [-1.9, -2.4, 0.4, 0.2],
  [2.2, -1.8, 0.3, 0.3],
];

export function buildSparkles(): THREE.Group[] {
  return SPARKLE_SPOTS.map(([x, y, z, size], i) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const back = new THREE.Mesh(new THREE.ShapeGeometry(starShape(1.25, 0.58)), new THREE.MeshBasicMaterial({ color: THEME.ink }));
    const front = new THREE.Mesh(
      new THREE.ShapeGeometry(starShape(1, 0.42)),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? THEME.mustard : THEME.cream,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      }),
    );
    front.position.z = 0.05;
    front.renderOrder = 1;
    g.add(back, front);
    g.userData.size = size;
    g.visible = false;
    return g;
  });
}
