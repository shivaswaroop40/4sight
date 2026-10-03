// src/experiences/tree/treeProps.ts
//
// Everything on the oak that is not branch or leaf: the buried acorn, the
// root flare, the storm scar and its hollow, the woodpecker hole, the ring
// slice, the gale, and the animals. Each prop owns its meshes and a pure
// pose(t). Animals and holes are drawn a little larger than life once the
// tree is big, or they would vanish at the scale of the crown.

import * as THREE from "three";
import { smoothstep } from "../../core/interpolate";
import { THEME, addOutline, makeToonMaterial } from "../../core/theme";
import { groundY } from "./treeIsland";
import { PALETTE } from "./treeMaterials";
import { STORY, frameSize, heightAt, viewCenter } from "./treeModel";
import { DRAWN_THICKNESS } from "./treePose";
import { buildRingCookie } from "./treeRings";
import { SEED_CENTER, SKELETON, WOODPECKER_HOLE, axisRadius, pointAlong, timeAtLength } from "./treeSkeleton";
import { WILDLIFE_WINDOWS, acornsAt } from "./treeState";

export interface Prop {
  object: THREE.Object3D;
  /** Hover id and the object that answers to it. */
  hover?: { id: string; target: THREE.Object3D };
  pose(t: number): void;
}

const trunk = SKELETON.axes[0];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Larger-than-life factor for small things on a big tree. */
export function propScale(t: number): number {
  return THREE.MathUtils.clamp(frameSize(t) / 7, 1, 3.2);
}

function trunkRadius(s: number, t: number): number {
  return axisRadius(trunk, timeAtLength(trunk, s), t) * DRAWN_THICKNESS;
}

/** Point on the trunk surface at height s, facing azimuth (degrees). */
function trunkSurface(s: number, azimuthDeg: number, t: number): THREE.Vector3 {
  const p = pointAlong(trunk, s);
  const a = THREE.MathUtils.degToRad(azimuthDeg);
  const r = trunkRadius(s, t);
  return new THREE.Vector3(p[0] + Math.cos(a) * r, p[1], p[2] + Math.sin(a) * r);
}

function toon(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, outline = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, makeToonMaterial(color));
  if (outline > 0) addOutline(m, outline);
  return m;
}

function ball(r: number, color: THREE.ColorRepresentation, sx = 1, sy = 1, sz = 1, outline = 0): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 20, 14);
  g.scale(sx, sy, sz);
  return toon(g, color, outline);
}

function show(object: THREE.Object3D, k: number, base = 1): void {
  object.visible = k > 0.001;
  object.scale.setScalar(Math.max(1e-4, k * base));
}

function faceAzimuth(object: THREE.Object3D, azimuthDeg: number): void {
  // Local +z looks out along the azimuth.
  object.rotation.set(0, Math.PI / 2 - THREE.MathUtils.degToRad(azimuthDeg), 0);
}

// The acorn ------------------------------------------------------------------

function acornMesh(length: number): THREE.Group {
  const g = new THREE.Group();
  const nut = ball(length * 0.38, PALETTE.acornRipe, 1, 1.35, 1, length * 0.03);
  g.add(nut);
  const tip = toon(new THREE.ConeGeometry(length * 0.08, length * 0.16, 8), PALETTE.barkDark);
  tip.position.y = -length * 0.56;
  tip.rotation.x = Math.PI;
  g.add(tip);
  const scar = ball(length * 0.2, "#C9A27A", 1, 0.35, 1);
  scar.position.y = length * 0.48;
  g.add(scar);
  return g;
}

/** Where the jay stands, which way it faces, and how far it has flown off. */
const JAY_SPOT = new THREE.Vector3(-0.13, groundY(0.15), 0.08);
const JAY_FACING = -30;

function jayPose(t: number): { position: THREE.Vector3; dip: number; fly: number } {
  const dip = t > 0.025 && t < 0.058 ? Math.pow(Math.sin(((t - 0.025) / 0.011) * Math.PI), 2) : 0;
  const fly = smoothstep(0.058, 0.075, t);
  const position = JAY_SPOT.clone().add(new THREE.Vector3(-0.3 * fly * fly, 0.6 * fly * fly, -0.4 * fly * fly));
  return { position, dip, fly };
}

/** The acorn in the jay's beak, in world space. */
function beakTip(t: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(JAY_FACING);
  return jayPose(t).position.add(new THREE.Vector3(Math.cos(a) * 0.15, 0.17, Math.sin(a) * 0.15));
}

function buildSeed(): Prop {
  const seed = acornMesh(0.026);
  seed.name = "seed";
  const nut = seed.children[0] as THREE.Mesh;
  const ripe = new THREE.Color(PALETTE.acornRipe);
  const spent = new THREE.Color("#5E4636");
  return {
    object: seed,
    hover: { id: "acorns", target: seed },
    pose(t) {
      const buried = new THREE.Vector3(...SEED_CENTER);
      const onTop = buried.clone().setY(0.012);
      if (t < 0.025) {
        seed.position.copy(beakTip(t));
        seed.rotation.set(0, 0, Math.PI / 2);
      } else {
        const drop = smoothstep(0.025, 0.033, t);
        const push = smoothstep(0.035, 0.058, t);
        const from = beakTip(0.025);
        seed.position.lerpVectors(from, onTop, drop).lerp(buried, push);
        seed.rotation.set(0.25 * drop, 0, (Math.PI / 2) * (1 - drop) + 0.35 * drop);
      }
      // The shell stays underground while the seedling uses up its food, then rots.
      const spend = smoothstep(0.8, 2.5, t);
      (nut.material as THREE.MeshToonMaterial).color.copy(ripe).lerp(spent, spend);
      show(seed, 1 - smoothstep(2.5, 3.2, t), 1 - 0.25 * spend);
    },
  };
}

// The jay --------------------------------------------------------------------

function buildJay(): Prop {
  const jay = new THREE.Group();
  jay.name = "jay";
  const body = new THREE.Group();
  jay.add(body);
  body.add(ball(0.06, "#C9A08A", 1.05, 0.9, 1.6, 0.006));
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.08);
  body.add(head);
  head.add(ball(0.042, "#D8B49E", 1, 1, 1.05, 0.005));
  const crown = ball(0.03, "#EDE3D8", 1, 0.6, 1.2);
  crown.position.set(0, 0.03, -0.005);
  head.add(crown);
  const beak = toon(new THREE.ConeGeometry(0.012, 0.04, 8), "#3B3532");
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.005, 0.055);
  head.add(beak);
  for (const side of [-1, 1]) {
    const eye = ball(0.009, "#F3E9D7");
    eye.position.set(side * 0.03, 0.01, 0.025);
    const pupil = ball(0.005, THEME.ink);
    pupil.position.set(side * 0.036, 0.011, 0.029);
    const tache = ball(0.012, THEME.ink, 0.5, 1.2, 1);
    tache.position.set(side * 0.03, -0.015, 0.03);
    head.add(eye, pupil, tache);
    const wing = new THREE.Group();
    wing.position.set(side * 0.055, 0.015, -0.01);
    wing.add(ball(0.04, "#B98E77", 0.35, 0.8, 1.5, 0.004));
    const patch = ball(0.022, "#4E7FC8", 0.45, 0.7, 1);
    patch.position.set(side * 0.006, 0.01, 0.025);
    const bars = ball(0.012, "#22355E", 0.5, 0.7, 1);
    bars.position.set(side * 0.01, 0.01, 0.03);
    wing.add(patch, bars);
    wing.userData.side = side;
    body.add(wing);
  }
  const rump = ball(0.03, "#F7F1E8", 1, 0.8, 1);
  rump.position.set(0, 0.015, -0.09);
  const tail = toon(new THREE.BoxGeometry(0.05, 0.012, 0.12), THEME.ink);
  tail.position.set(0, 0.0, -0.14);
  tail.rotation.x = -0.25;
  body.add(rump, tail);
  for (const side of [-1, 1]) {
    const leg = toon(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 5), "#8A6F60");
    leg.position.set(side * 0.022, -0.075, 0.01);
    jay.add(leg);
  }
  jay.position.y = 0.105;
  const root = new THREE.Group();
  root.add(jay);
  const wings = body.children.filter((c) => c.userData.side !== undefined);
  return {
    object: root,
    hover: { id: "jay", target: jay },
    pose(t) {
      const [a, b] = WILDLIFE_WINDOWS.jay;
      const { position, dip, fly } = jayPose(t);
      root.position.copy(position);
      faceAzimuth(root, JAY_FACING);
      body.rotation.x = 0.55 * dip - 0.5 * fly;
      for (const w of wings) w.rotation.z = w.userData.side * (1.2 * fly) * (0.6 + 0.4 * Math.sin(t * 500));
      show(root, t >= a && t <= b ? 1 - smoothstep(b - 0.004, b, t) : 0);
    },
  };
}

// The rabbit -----------------------------------------------------------------

function buildRabbit(): Prop {
  const g = new THREE.Group();
  g.name = "rabbit";
  const fur = "#A99179";
  const body = ball(0.11, fur, 0.95, 0.85, 1.35, 0.008);
  body.position.set(0, 0.1, 0);
  const head = ball(0.07, fur, 1, 0.95, 1.1, 0.007);
  head.position.set(0, 0.17, 0.12);
  const tail = ball(0.035, "#F7F1E8");
  tail.position.set(0, 0.12, -0.15);
  g.add(body, head, tail);
  for (const side of [-1, 1]) {
    const ear = ball(0.025, fur, 0.7, 3.4, 0.5, 0.005);
    ear.position.set(side * 0.03, 0.27, 0.1);
    ear.rotation.set(-0.35, 0, side * 0.12);
    const inner = ball(0.014, "#E3B7A7", 0.5, 3.6, 0.3);
    inner.position.set(side * 0.03, 0.27, 0.113);
    inner.rotation.copy(ear.rotation);
    const eye = ball(0.012, THEME.ink);
    eye.position.set(side * 0.05, 0.19, 0.16);
    const foot = ball(0.03, fur, 0.9, 0.5, 1.8);
    foot.position.set(side * 0.07, 0.02, -0.02);
    g.add(ear, inner, eye, foot);
  }
  const nose = ball(0.012, "#D98C7E");
  nose.position.set(0, 0.17, 0.195);
  g.add(nose);
  return {
    object: g,
    hover: { id: "rabbit", target: g },
    pose(t) {
      const [a, b] = WILDLIFE_WINDOWS.rabbit;
      const r = 0.75;
      g.position.set(Math.cos(-0.25) * r, groundY(r), Math.sin(-0.25) * r);
      faceAzimuth(g, 160);
      head.rotation.x = 0;
      show(g, smoothstep(a, a + 0.3, t) * (1 - smoothstep(b - 0.3, b, t)));
    },
  };
}

// The squirrel ---------------------------------------------------------------

function buildSquirrel(): Prop {
  const g = new THREE.Group();
  g.name = "squirrel";
  const fur = "#9C958C";
  const body = ball(0.07, fur, 0.9, 1.25, 0.9, 0.007);
  body.position.set(0, 0.09, 0);
  body.rotation.x = -0.35;
  const belly = ball(0.05, "#E9E0D2", 0.8, 1.1, 0.6);
  belly.position.set(0, 0.08, 0.04);
  const head = ball(0.05, fur, 1, 0.95, 1.15, 0.006);
  head.position.set(0, 0.19, 0.04);
  g.add(body, belly, head);
  for (const side of [-1, 1]) {
    const ear = toon(new THREE.ConeGeometry(0.015, 0.04, 6), fur);
    ear.position.set(side * 0.025, 0.24, 0.03);
    const eye = ball(0.01, THEME.ink);
    eye.position.set(side * 0.03, 0.2, 0.08);
    g.add(ear, eye);
  }
  // A bushy S of a tail.
  const tail = new THREE.Group();
  const pts = [
    [0, 0.04, -0.08, 0.05],
    [0, 0.12, -0.14, 0.06],
    [0, 0.22, -0.13, 0.065],
    [0, 0.29, -0.07, 0.055],
  ];
  for (const [x, y, z, r] of pts) {
    const puff = ball(r, "#ABA59C", 1, 1, 1, 0.006);
    puff.position.set(x, y, z);
    tail.add(puff);
  }
  g.add(tail);
  const nut = acornMesh(0.035);
  nut.position.set(0, 0.13, 0.085);
  g.add(nut);
  return {
    object: g,
    hover: { id: "squirrel", target: g },
    pose(t) {
      const r = 2.3;
      const a = THREE.MathUtils.degToRad(12);
      g.position.set(Math.cos(a) * r, groundY(r), Math.sin(a) * r);
      faceAzimuth(g, 70);
      const k = smoothstep(0.15, 0.3, acornsAt(t).onGround);
      show(g, k, propScale(t));
    },
  };
}

// Storm scar, stub and hollow -----------------------------------------------

const stormLimb = SKELETON.axes[SKELETON.stormLimb];
const stormBase = new THREE.Vector3(...stormLimb.points[0]);
const stormDir = new THREE.Vector3(...stormLimb.points[1]).sub(stormBase).normalize();
export const STORM_AZIMUTH = THREE.MathUtils.radToDeg(Math.atan2(stormDir.z, stormDir.x));
const stormS = stormBase.y;
/** Limb radius when it broke: the wound is a little wider than the limb. */
const woundWidth = 2.4 * DRAWN_THICKNESS * axisRadius(stormLimb, stormLimb.birth, STORY.storm);

function buildScar(): Prop {
  const g = new THREE.Group();
  g.name = "scar";
  const face = new THREE.Group();
  g.add(face);
  const wood = new THREE.Mesh(new THREE.CircleGeometry(1, 40), makeToonMaterial(PALETTE.wound));
  const lips = toon(new THREE.TorusGeometry(1, 0.16, 10, 40), PALETTE.bark, 0.04);
  const hollow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: "#2A201B" }));
  hollow.position.z = 0.02;
  face.add(wood, lips, hollow);
  // Splinters on the snapped stub.
  const splinters = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const s = toon(new THREE.ConeGeometry(0.18, 0.6 + (i % 3) * 0.25, 4), PALETTE.wound, 0.03);
    const a = (i / 6) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.55, 0.25, Math.sin(a) * 0.55);
    splinters.add(s);
  }
  g.add(splinters);
  const fresh = new THREE.Color(PALETTE.wound);
  const weathered = new THREE.Color("#A2927C");
  return {
    object: g,
    hover: { id: "scar", target: face },
    pose(t) {
      const since = t - STORY.storm;
      g.visible = since > 0;
      if (!g.visible) return;
      const n = new THREE.Vector3(stormDir.x, 0, stormDir.z).normalize();
      const r = trunkRadius(stormS, t);
      const close = smoothstep(0, 45, since);
      const w = woundWidth * (1 - 0.55 * close);
      const h = woundWidth * 2.2 * (1 - 0.35 * close);
      face.position.set(stormBase.x + n.x * (r + 0.01), stormS - h * 0.35, stormBase.z + n.z * (r + 0.01));
      face.quaternion.setFromUnitVectors(Z_AXIS, n);
      face.scale.set(w / 2, h / 2, 1);
      (wood.material as THREE.MeshToonMaterial).color.copy(fresh).lerp(weathered, smoothstep(0, 12, since));
      lips.scale.set(1, 1, 1.5);
      lips.visible = since > 1;
      const rot = smoothstep(106, 116, t);
      hollow.visible = rot > 0.001;
      hollow.scale.set(0.62 * rot, 0.5 * rot, 1);
      hollow.position.y = 0.2;

      const stub = SKELETON.stormBreakS;
      const end = stormBase.clone().addScaledVector(stormDir, stub);
      splinters.position.copy(end);
      splinters.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stormDir);
      const limbR = woundWidth / 2.4;
      // The stub rots away as the hollow opens.
      splinters.scale.setScalar(limbR * (1 - 0.6 * rot));
    },
  };
}

// Woodpecker and its hole ----------------------------------------------------

function buildWoodpecker(): Prop[] {
  const hole = new THREE.Group();
  hole.name = "woodpecker-hole";
  const rim = toon(new THREE.TorusGeometry(1, 0.28, 8, 24), PALETTE.barkDark);
  const dark = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: "#1F1814" }));
  hole.add(rim, dark);

  const bird = new THREE.Group();
  bird.name = "woodpecker";
  const body = ball(0.05, "#2E2A28", 0.85, 1.6, 0.8, 0.005);
  const chest = ball(0.035, "#F2EADF", 0.75, 1.3, 0.6);
  chest.position.set(0, 0.0, 0.025);
  const vent = ball(0.022, "#D2453C", 0.8, 0.8, 0.6);
  vent.position.set(0, -0.06, 0.02);
  const head = ball(0.035, "#2E2A28", 1, 1, 1.1, 0.004);
  head.position.set(0, 0.085, 0.01);
  const cheek = ball(0.022, "#F2EADF", 1.1, 0.8, 0.8);
  cheek.position.set(0, 0.08, 0.03);
  const nape = ball(0.016, "#D2453C");
  nape.position.set(0, 0.095, -0.025);
  const beak = toon(new THREE.ConeGeometry(0.008, 0.045, 6), "#4A4440");
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.085, 0.055);
  const patch = ball(0.02, "#F2EADF", 0.4, 1, 1.2);
  patch.position.set(0.04, 0.01, -0.005);
  const patch2 = patch.clone();
  patch2.position.x = -0.04;
  const tail = toon(new THREE.ConeGeometry(0.02, 0.08, 4), "#2E2A28");
  tail.position.set(0, -0.1, -0.02);
  tail.rotation.x = Math.PI + 0.3;
  bird.add(body, chest, vent, head, cheek, nape, beak, patch, patch2, tail);

  const az = WOODPECKER_HOLE.azimuth;
  return [
    {
      object: hole,
      hover: { id: "woodpecker-hole", target: hole },
      pose(t) {
        const k = smoothstep(STORY.woodpecker, STORY.woodpecker + 0.8, t);
        hole.position.copy(trunkSurface(WOODPECKER_HOLE.s, az, t));
        faceAzimuth(hole, az);
        show(hole, k, 0.035 * propScale(t));
      },
    },
    {
      object: bird,
      hover: { id: "woodpecker", target: bird },
      pose(t) {
        const [a, b] = WILDLIFE_WINDOWS.woodpecker;
        const k = smoothstep(a, a + 0.5, t) * (1 - smoothstep(b - 0.5, b, t));
        const s = propScale(t);
        bird.position.copy(trunkSurface(WOODPECKER_HOLE.s + 0.07 * s, az - 14 * Math.min(1, s / 2), t));
        faceAzimuth(bird, az + 20);
        bird.rotation.x = -0.15;
        show(bird, k, s);
      },
    },
  ];
}

// The owl --------------------------------------------------------------------

function buildOwl(): Prop {
  const g = new THREE.Group();
  g.name = "owl";
  const body = ball(0.11, "#9B6B45", 1, 1.1, 0.85, 0.008);
  const face = ball(0.075, "#D6B48C", 1.25, 1, 0.45);
  face.position.set(0, 0.07, 0.07);
  g.add(body, face);
  for (const side of [-1, 1]) {
    const eye = ball(0.026, "#1F1814");
    eye.position.set(side * 0.04, 0.08, 0.1);
    const shine = ball(0.008, "#FFFFFF");
    shine.position.set(side * 0.045, 0.09, 0.124);
    const brow = ball(0.03, "#7E5536", 1.2, 0.4, 0.5);
    brow.position.set(side * 0.04, 0.115, 0.09);
    brow.rotation.z = side * -0.3;
    g.add(eye, shine, brow);
  }
  const beak = toon(new THREE.ConeGeometry(0.012, 0.03, 6), "#E3C07A");
  beak.position.set(0, 0.045, 0.11);
  beak.rotation.x = Math.PI + 0.4;
  g.add(beak);
  return {
    object: g,
    hover: { id: "owl", target: g },
    pose(t) {
      const [a, b] = WILDLIFE_WINDOWS.owl;
      const n = new THREE.Vector3(stormDir.x, 0, stormDir.z).normalize();
      const r = trunkRadius(stormS, t);
      const h = woundWidth * 2.2 * (1 - 0.35 * smoothstep(0, 45, t - STORY.storm));
      g.position.set(stormBase.x + n.x * (r - 0.02), stormS - h * 0.35 + 0.05, stormBase.z + n.z * (r - 0.02));
      faceAzimuth(g, STORM_AZIMUTH + 25);
      show(g, smoothstep(a, a + 0.6, t) * (1 - smoothstep(b + 1, b + 2, t)), Math.min(propScale(t), 1.8));
    },
  };
}

// The gale -------------------------------------------------------------------

function buildStorm(): Prop {
  const g = new THREE.Group();
  g.name = "storm";
  const cloud = new THREE.Group();
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 3.2],
    [3.4, -0.4, 0.6, 2.6],
    [-3.3, -0.3, -0.4, 2.7],
    [1.4, 1.4, -0.6, 2.4],
    [-1.6, 1.2, 0.5, 2.3],
    [5.8, -0.9, -0.3, 1.8],
    [-5.6, -0.8, 0.4, 1.9],
  ];
  for (const [x, y, z, r] of puffs) {
    const p = ball(r, "#7D7489", 1, 0.8, 1, 0.12);
    p.position.set(x, y, z);
    cloud.add(p);
  }
  g.add(cloud);
  const rainMaterial = new THREE.MeshBasicMaterial({ color: "#8FA3B8", transparent: true, opacity: 0.7 });
  const rainGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.2, 4);
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rain = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const d = new THREE.Mesh(rainGeo, rainMaterial);
    d.position.set((rand() - 0.5) * 16, -2 - rand() * 14, (rand() - 0.5) * 10);
    d.rotation.z = 0.35;
    rain.add(d);
  }
  g.add(rain);
  const boltShape = new THREE.Shape();
  const bolt: [number, number][] = [[0, 0], [1.2, 0], [0.4, -2.6], [1.4, -2.6], [-0.6, -6.8], [0.1, -3.4], [-0.9, -3.4]];
  boltShape.moveTo(...bolt[0]);
  for (const p of bolt.slice(1)) boltShape.lineTo(...p);
  const lightning = toon(new THREE.ExtrudeGeometry(boltShape, { depth: 0.3, bevelEnabled: false }), THEME.mustard, 0.08);
  lightning.position.set(-2.5, -1.5, 1);
  g.add(lightning);
  return {
    object: g,
    hover: { id: "storm", target: cloud },
    pose(t) {
      const k = smoothstep(STORY.storm - 1.6, STORY.storm - 0.4, t) * (1 - smoothstep(STORY.stormLanded + 0.4, STORY.stormLanded + 1.6, t));
      g.position.set(1, heightAt(t) + 3.5, -1);
      show(g, k);
      lightning.visible = t > STORY.storm - 0.12 && t < STORY.storm + 0.04;
    },
  };
}

// Root flare -----------------------------------------------------------------

function buildFlare(): Prop {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 48, 16, true);
  geo.translate(0, 0.5, 0);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const yy = -0.5 + y * 2.3;
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const lobes = 0.65 + 0.35 * Math.pow(Math.abs(Math.cos(a * 2.5)), 2);
    const r = 1 + 1.4 * Math.exp(-Math.max(0, yy) * 3.2) * lobes;
    p.setXYZ(i, Math.cos(a) * r, yy, Math.sin(a) * r);
  }
  geo.computeVertexNormals();
  const flare = toon(geo, PALETTE.bark, 0.05);
  flare.name = "flare";
  return {
    object: flare,
    hover: { id: "trunk", target: flare },
    pose(t) {
      const r = trunkRadius(0, t);
      show(flare, r > 0.03 ? 1 : 0, Math.max(r, 1e-4) * 0.98);
    },
  };
}

// The ring slice -------------------------------------------------------------

/**
 * The slice floats out from the trunk along COOKIE_DIRECTION, from the
 * point the camera presets look at, and faces back along it. The "Trunk and
 * rings" preset sits further out on the same line, so it sees the slice face
 * on with the trunk behind it.
 */
const COOKIE_DIRECTION = new THREE.Vector3(
  Math.cos(THREE.MathUtils.degToRad(18)),
  Math.tan(THREE.MathUtils.degToRad(-5)),
  Math.sin(THREE.MathUtils.degToRad(18)),
).normalize();
const COOKIE_DISTANCE = 0.62;
export const COOKIE_RADIUS = 0.085;

function buildCookie(): Prop {
  const cookie = buildRingCookie();
  const g = new THREE.Group();
  g.name = "ring-slice";
  g.add(cookie.group);
  const leader = toon(new THREE.CylinderGeometry(1, 1, 1, 6), THEME.ink);
  leader.geometry.translate(0, 0.5, 0);
  g.add(leader);
  const band = toon(new THREE.TorusGeometry(1, 0.06, 6, 40), THEME.ink);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const a = Math.atan2(COOKIE_DIRECTION.z, COOKIE_DIRECTION.x);
  return {
    object: g,
    hover: { id: "rings", target: cookie.disc },
    pose(t) {
      cookie.material.uniforms.uAge.value = Math.max(0, t - STORY.shoot);
      const S = frameSize(t);
      const k = smoothstep(1.0, 1.4, t);
      g.visible = k > 0.001;
      if (!g.visible) return;
      const radius = COOKIE_RADIUS * S * k;
      const center = new THREE.Vector3(0, viewCenter(t), 0).addScaledVector(COOKIE_DIRECTION, COOKIE_DISTANCE * S);
      cookie.group.position.copy(center);
      cookie.group.scale.setScalar(Math.max(radius, 1e-4));
      cookie.group.quaternion.setFromUnitVectors(Y_AXIS, COOKIE_DIRECTION);

      const sliceH = Math.min(0.3, 0.2 * heightAt(t));
      const tr = trunkRadius(sliceH, t);
      band.position.set(0, sliceH, 0);
      band.scale.set(tr * 1.04, tr * 1.04, tr * 1.04);
      band.visible = tr > 0;
      const from = new THREE.Vector3(Math.cos(a) * tr, sliceH, Math.sin(a) * tr);
      const to = center.clone().addScaledVector(new THREE.Vector3(-Math.cos(a), -0.6, -Math.sin(a)).normalize(), radius);
      const d = to.clone().sub(from);
      leader.position.copy(from);
      leader.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      leader.scale.set(0.0035 * S, d.length(), 0.0035 * S);
    },
  };
}

export function buildProps(): Prop[] {
  return [
    buildSeed(),
    buildJay(),
    buildRabbit(),
    buildSquirrel(),
    buildScar(),
    ...buildWoodpecker(),
    buildOwl(),
    buildStorm(),
    buildFlare(),
    buildCookie(),
  ];
}

