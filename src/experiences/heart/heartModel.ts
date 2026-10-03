// src/experiences/heart/heartModel.ts
//
// Builds the cartoon heart once at mount. Every mesh that belongs to the
// heart keeps its resting coordinates in its geometry and is moved on the
// GPU by the shared deformation field (heartLayout DEFORM_GLSL), so a beat
// costs three uniform writes instead of rebuilding geometry.

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { THEME, addOutline, makeToonMaterial } from "../../core/theme";
import type { ChamberId, ConductionId, ValveId } from "./heartCycle";
import {
  AV_Y,
  ATRIAL_WAVE_ORIGIN,
  BODY_OUTLINE,
  DEFORM_GLSL,
  FRONT_Z,
  ORIFICES,
  POOL_GLSL,
  POOL_Z,
  TUBES,
  VALVES,
  VENTRICULAR_WAVE_ORIGIN,
  WIRES,
  WIRE_Z,
  type PoolDef,
  type TubeDef,
  type Vec2,
  type VesselId,
} from "./heartLayout";

/** Heart-red sits between THEME.terracotta and a true crimson so it reads as muscle, not clay. */
export const HEART_COLORS = {
  wall: "#D8574B",
  wallInk: "#5E2621",
  oxyVessel: "#D2414E",
  deoxyVessel: "#7488CC",
  oxyPool: "#9F2239",
  oxyPoolEdge: "#76162A",
  deoxyPool: "#4F5C9E",
  deoxyPoolEdge: "#38427A",
  oxyFlow: "#FFD3C7",
  deoxyFlow: "#DCE5FF",
  valve: "#FFF3DF",
  wireIdle: "#C98A45",
  wireLit: "#FFF27A",
  node: "#FFD15C",
  glow: "#FFE07A",
} as const;

export interface DeformUniforms {
  uBaseShift: THREE.IUniform<number>;
  uVentSqueeze: THREE.IUniform<number>;
  uAtrialSqueeze: THREE.IUniform<number>;
}

export function createDeformUniforms(): DeformUniforms {
  return { uBaseShift: { value: 0 }, uVentSqueeze: { value: 0 }, uAtrialSqueeze: { value: 0 } };
}

export interface PoolUniforms {
  uPoolCenter: THREE.IUniform<THREE.Vector2>;
  uPoolShrink: THREE.IUniform<number>;
  uPoolVentricle: THREE.IUniform<number>;
}

export interface WaveUniforms {
  uAtrialSpread: THREE.IUniform<number>;
  uAtrialTint: THREE.IUniform<number>;
  uVentSpread: THREE.IUniform<number>;
  uVentTint: THREE.IUniform<number>;
}

export interface WireUniforms {
  uProgress: THREE.IUniform<number>;
  uGlow: THREE.IUniform<number>;
}

interface Patch {
  key: string;
  pool?: PoolUniforms;
  /** Inverted-hull thickness: push along the normal before deforming. */
  outline?: number;
  wave?: WaveUniforms;
  wire?: WireUniforms;
}

const WAVE_GLSL = /* glsl */ `
uniform float uAtrialSpread;
uniform float uAtrialTint;
uniform float uVentSpread;
uniform float uVentTint;
varying vec3 vRest;
float depolarized(vec2 p, vec2 origin, float spread, float tint, float reach) {
  float r = spread * reach;
  float d = distance(p, origin);
  float x = (d - r) / 0.25;
  float travelling = step(0.001, spread) * (1.0 - step(0.999, spread));
  float front = exp(-x * x) * travelling;
  float behind = (1.0 - smoothstep(r - 0.2, r + 0.05, d)) * tint * step(0.001, spread);
  return max(front, behind * 0.4);
}
`;

/** Injects the deformation (and optional cavity shrink, depolarization glow, or wire glow) into a built-in material. */
function patch<M extends THREE.Material>(material: M, deformUniforms: DeformUniforms, p: Patch): M {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, deformUniforms, p.pool ?? {}, p.wave ?? {}, p.wire ?? {});
    const head = [DEFORM_GLSL, p.pool ? POOL_GLSL : "", p.wave ? "varying vec3 vRest;" : "", p.wire ? "varying float vAlong;" : ""];
    const body = [
      p.outline !== undefined ? `transformed = position + normalize(normal) * ${p.outline.toFixed(4)};` : "",
      p.wave ? "vRest = transformed;" : "",
      p.wire ? "vAlong = uv.x;" : "",
      p.pool ? "transformed = poolShrink(transformed);" : "",
      "transformed = heartDeform(transformed);",
    ];
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${head.join("\n")}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${body.join("\n")}`);
    if (p.wave) {
      const [ax, ay] = ATRIAL_WAVE_ORIGIN;
      const [vx, vy] = VENTRICULAR_WAVE_ORIGIN;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${WAVE_GLSL}`)
        .replace(
          "#include <opaque_fragment>",
          `float atria = smoothstep(${AV_Y - 0.05}, ${AV_Y + 0.15}, vRest.y);
          float g = atria * depolarized(vRest.xy, vec2(${ax}, ${ay}), uAtrialSpread, uAtrialTint, 4.3)
            + (1.0 - atria) * depolarized(vRest.xy, vec2(${vx}, ${vy}), uVentSpread, uVentTint, 3.4);
          outgoingLight = mix(outgoingLight, vec3(1.0, 0.84, 0.4), clamp(g, 0.0, 1.0) * 0.5);
          #include <opaque_fragment>`,
        );
    }
    if (p.wire) {
      const idle = new THREE.Color(HEART_COLORS.wireIdle);
      const lit = new THREE.Color(HEART_COLORS.wireLit);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uProgress;\nuniform float uGlow;\nvarying float vAlong;")
        .replace(
          "#include <opaque_fragment>",
          `float reached = step(vAlong, uProgress) * uGlow;
          float x = (vAlong - uProgress) * 9.0;
          float spark = exp(-x * x) * step(0.0001, uProgress) * uGlow;
          outgoingLight = mix(vec3(${idle.r}, ${idle.g}, ${idle.b}), vec3(${lit.r}, ${lit.g}, ${lit.b}), reached);
          outgoingLight = mix(outgoingLight, vec3(1.0), spark * 0.85);
          #include <opaque_fragment>`,
        );
    }
  };
  material.customProgramCacheKey = () => `heart-${p.key}`;
  return material;
}

/** Ink hull that follows the deformation. Shares the mesh geometry unless a smoothed one is given. */
function deformedOutline(mesh: THREE.Mesh, u: DeformUniforms, thickness: number, geometry?: THREE.BufferGeometry): THREE.Mesh {
  const material = patch(new THREE.MeshBasicMaterial({ color: THEME.ink, side: THREE.BackSide }), u, {
    key: `outline-${thickness}`,
    outline: thickness,
  });
  const hull = new THREE.Mesh(geometry ?? mesh.geometry, material);
  hull.name = "outline";
  hull.raycast = () => {};
  mesh.add(hull);
  return hull;
}

/** Smooth vertex normals for an inverted hull on geometry with hard edges. */
function smoothedForOutline(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.clone();
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const merged = mergeVertices(g, 1e-4);
  g.dispose();
  merged.computeVertexNormals();
  return merged;
}

function splinePoints(outline: Vec2[], count: number): THREE.Vector2[] {
  const curve = new THREE.CatmullRomCurve3(
    outline.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    "centripetal",
  );
  return curve.getSpacedPoints(count).slice(0, count).map((p) => new THREE.Vector2(p.x, p.y));
}

/** A closed band along a curve between inner and outer offsets (negative is inward). */
function ribbon(points: THREE.Vector2[], inner: number, outer: number, z: number): THREE.BufferGeometry {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  const outward = area > 0 ? 1 : -1;
  const n = points.length;
  const positions = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = (ty / len) * outward;
    const ny = (-tx / len) * outward;
    const p = points[i];
    positions.set([p.x + nx * inner, p.y + ny * inner, z, p.x + nx * outer, p.y + ny * outer, z], i * 6);
  }
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    index.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

// ---------------------------------------------------------------------------

export interface HeartBody {
  mesh: THREE.Mesh;
  wave: WaveUniforms;
}

export function buildBody(u: DeformUniforms): HeartBody {
  const shape = new THREE.Shape(splinePoints(BODY_OUTLINE, 220));
  const depth = 0.5;
  const bevel = 0.6;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 0.26,
    bevelSegments: 9,
    curveSegments: 1,
  });
  geometry.translate(0, 0, FRONT_Z - depth - bevel);
  const wave: WaveUniforms = {
    uAtrialSpread: { value: 0 },
    uAtrialTint: { value: 0 },
    uVentSpread: { value: 0 },
    uVentTint: { value: 0 },
  };
  const mesh = new THREE.Mesh(geometry, patch(makeToonMaterial(HEART_COLORS.wall), u, { key: "body", wave }));
  deformedOutline(mesh, u, 0.035, smoothedForOutline(geometry));
  return { mesh, wave };
}

export interface Pool {
  id: ChamberId;
  group: THREE.Group;
  /** The flat cavity fill; registered as the chamber's hoverable. */
  fill: THREE.Mesh;
  uniforms: PoolUniforms;
}

export function buildPool(id: ChamberId, def: PoolDef, u: DeformUniforms, layer: number): Pool {
  const uniforms: PoolUniforms = {
    uPoolCenter: { value: new THREE.Vector2(def.center[0], def.center[1]) },
    uPoolShrink: { value: 0 },
    uPoolVentricle: { value: def.band === "ventricle" ? 1 : 0 },
  };
  const oxy = def.side === "left";
  const z = POOL_Z + layer * 0.004;
  const pts = splinePoints(def.outline, 160);
  const material = (color: string) =>
    patch(new THREE.MeshBasicMaterial({ color }), u, { key: "pool", pool: uniforms });

  const group = new THREE.Group();
  group.name = id;
  const fillGeometry = new THREE.ShapeGeometry(new THREE.Shape(pts));
  fillGeometry.translate(0, 0, z);
  const fill = new THREE.Mesh(fillGeometry, material(oxy ? HEART_COLORS.oxyPool : HEART_COLORS.deoxyPool));
  const shade = new THREE.Mesh(ribbon(pts, -0.13, 0, z + 0.001), material(oxy ? HEART_COLORS.oxyPoolEdge : HEART_COLORS.deoxyPoolEdge));
  const ink = new THREE.Mesh(ribbon(pts, -0.012, 0.035, z + 0.002), material(HEART_COLORS.wallInk));
  for (const m of [shade, ink]) m.raycast = () => {};
  group.add(fill, shade, ink);
  for (const orifice of ORIFICES.filter((o) => o.pool === id)) {
    const { left, right } = VALVES[orifice.valve];
    const mouth = new THREE.Shape();
    const [x0, x1] = [left[0] + 0.05, right[0] - 0.02];
    mouth.moveTo(x0, AV_Y - 0.2);
    mouth.lineTo(x1, AV_Y - 0.2);
    mouth.quadraticCurveTo(x1 + 0.04, AV_Y, x1, AV_Y + 0.16);
    mouth.lineTo(x0, AV_Y + 0.16);
    mouth.quadraticCurveTo(x0 - 0.04, AV_Y, x0, AV_Y - 0.2);
    const geometry = new THREE.ShapeGeometry(mouth, 8);
    geometry.translate(0, 0, z + 0.006);
    const patchMesh = new THREE.Mesh(geometry, material(oxy ? HEART_COLORS.oxyPool : HEART_COLORS.deoxyPool));
    patchMesh.raycast = () => {};
    group.add(patchMesh);
  }
  return { id, group, fill, uniforms };
}

export interface Vessel {
  vessel: VesselId;
  mesh: THREE.Mesh;
}

function buildVessel(def: TubeDef, u: DeformUniforms): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(def.points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const geometry = new THREE.TubeGeometry(curve, Math.max(24, def.points.length * 20), def.radius, 20, false);
  const color = def.oxygenated ? HEART_COLORS.oxyVessel : HEART_COLORS.deoxyVessel;
  const mesh = new THREE.Mesh(geometry, patch(makeToonMaterial(color), u, { key: "vessel" }));
  deformedOutline(mesh, u, 0.028);
  const lumen = def.oxygenated ? HEART_COLORS.oxyPool : HEART_COLORS.deoxyPool;
  const caps: [boolean, number][] = [
    [def.capStart, 0],
    [def.capEnd, 1],
  ];
  for (const [wanted, at] of caps) {
    if (!wanted) continue;
    const cap = new THREE.CircleGeometry(def.radius * 0.8, 24);
    const tangent = curve.getTangentAt(at);
    const facing = at === 0 ? tangent.clone().negate() : tangent;
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), facing, new THREE.Vector3(0, 1, 0.001));
    cap.applyMatrix4(m);
    cap.translate(...curve.getPointAt(at).addScaledVector(facing, -0.01).toArray());
    const capMesh = new THREE.Mesh(cap, patch(new THREE.MeshBasicMaterial({ color: lumen, side: THREE.DoubleSide }), u, { key: "vessel-cap" }));
    capMesh.raycast = () => {};
    mesh.add(capMesh);
  }
  return mesh;
}

export function buildVessels(u: DeformUniforms): Vessel[] {
  return TUBES.map((def) => ({ vessel: def.vessel, mesh: buildVessel(def, u) }));
}

// ---------------------------------------------------------------------------
// Valves

export interface ValveView {
  id: ValveId;
  group: THREE.Group;
  left: THREE.Mesh;
  right: THREE.Mesh;
  length: number;
}

export function buildValve(id: ValveId, width: number): ValveView {
  const radius = 0.055;
  const length = width / 2 + 0.02;
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - 2 * radius), 6, 14);
  geometry.rotateZ(-Math.PI / 2);
  geometry.translate(length / 2, 0, 0);
  const material = makeToonMaterial(HEART_COLORS.valve);
  const group = new THREE.Group();
  group.name = id;
  const leaflet = () => {
    const m = new THREE.Mesh(geometry, material);
    addOutline(m, 0.022);
    return m;
  };
  const left = leaflet();
  const right = leaflet();
  group.add(left, right);
  return { id, group, left, right, length };
}

// ---------------------------------------------------------------------------
// Electrical wiring

export interface WireView {
  id: ConductionId;
  meshes: THREE.Mesh[];
  curves: THREE.CatmullRomCurve3[];
  uniforms: WireUniforms;
}

export function buildWire(id: ConductionId, u: DeformUniforms): WireView {
  const uniforms: WireUniforms = { uProgress: { value: 0 }, uGlow: { value: 0 } };
  const material = patch(new THREE.MeshBasicMaterial({ color: "#ffffff" }), u, { key: "wire", wire: uniforms });
  const curves = WIRES[id].map(
    (line) => new THREE.CatmullRomCurve3(line.map(([x, y]) => new THREE.Vector3(x, y, WIRE_Z)), false, "centripetal"),
  );
  const meshes = curves.map((curve) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.038, 8, false), material);
    mesh.raycast = () => {};
    return mesh;
  });
  return { id, meshes, curves, uniforms };
}

export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,240,1)");
  g.addColorStop(0.25, "rgba(255,236,150,0.85)");
  g.addColorStop(0.6, "rgba(255,214,90,0.25)");
  g.addColorStop(1, "rgba(255,214,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildNode(radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), makeToonMaterial(HEART_COLORS.node));
  addOutline(mesh, 0.025);
  return mesh;
}

// ---------------------------------------------------------------------------
// Blood: one light chevron per parcel, pointing the way it flows.

export function chevronGeometry(size: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(size, 0);
  s.lineTo(-size * 0.7, size * 0.75);
  s.lineTo(-size * 0.25, 0);
  s.lineTo(-size * 0.7, -size * 0.75);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

// ---------------------------------------------------------------------------
// Text and paper, painted with canvas at mount.

const FONT = "Fredoka, Nunito, ui-rounded, system-ui, sans-serif";
/** A font string that resolves once the display web font has loaded. */
export const DISPLAY_FONT_PROBE = "700 64px Fredoka";

/**
 * A canvas texture that remembers how to paint itself. The web font may
 * arrive after mount, so callers repaint every text texture once it has.
 */
function painted(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, anisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const repaint = () => {
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    paint(ctx);
    ctx.restore();
    texture.needsUpdate = true;
  };
  repaint();
  texture.userData.repaint = repaint;
  return texture;
}

export function repaint(texture: THREE.Texture): void {
  (texture.userData.repaint as (() => void) | undefined)?.();
}

/** Text on a transparent canvas; "\n" starts a new line. */
export function textTexture(
  text: string,
  opts: { size?: number; color?: string; stroke?: string; weight?: number; pad?: number; pill?: string } = {},
): { texture: THREE.CanvasTexture; aspect: number } {
  const size = opts.size ?? 96;
  const pad = opts.pad ?? size * 0.3;
  const lines = text.split("\n");
  const lineHeight = size * 1.1;
  const font = `${opts.weight ?? 700} ${size}px ${FONT}`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const w = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width)) + pad * 2);
  const h = Math.ceil(lineHeight * lines.length + size * 0.2 + pad * 2);
  const texture = painted(w, h, (ctx) => {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (opts.pill) {
      ctx.fillStyle = opts.pill;
      ctx.strokeStyle = THEME.ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(3, 3, w - 6, h - 6, h / 2 - 4);
      ctx.fill();
      ctx.stroke();
    }
    lines.forEach((line, i) => {
      const y = h / 2 + (i - (lines.length - 1) / 2) * lineHeight + size * 0.05;
      if (opts.stroke) {
        ctx.lineJoin = "round";
        ctx.strokeStyle = opts.stroke;
        ctx.lineWidth = size * 0.22;
        ctx.strokeText(line, w / 2, y);
      }
      ctx.fillStyle = opts.color ?? THEME.ink;
      ctx.fillText(line, w / 2, y);
    });
  });
  return { texture, aspect: w / h };
}

/** A comic "LUB!" or "DUB!" starburst. */
export function burstTexture(text: string, fill: string): THREE.CanvasTexture {
  return painted(512, 512, (ctx) => {
    ctx.translate(256, 256);
    const spikes = 11;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? 240 : 170;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.82);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.strokeStyle = THEME.ink;
    ctx.stroke();
    ctx.font = `700 130px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 22;
    ctx.strokeText(text, 0, 8);
    ctx.fillStyle = THEME.cream;
    ctx.fillText(text, 0, 8);
  });
}

// ---------------------------------------------------------------------------
// ECG strip

export const ECG_PANEL = { width: 6.4, height: 1.9 } as const;
/** The plot area inside the panel, in panel units. */
export const ECG_PLOT = { left: -2.95, right: 2.95, baseline: -0.25, mvScale: 0.62 } as const;

export function ecgPaperTexture(): THREE.CanvasTexture {
  const w = 1600;
  const h = Math.round((w * ECG_PANEL.height) / ECG_PANEL.width);
  const px = (x: number) => ((x + ECG_PANEL.width / 2) / ECG_PANEL.width) * w;
  const py = (y: number) => ((ECG_PANEL.height / 2 - y) / ECG_PANEL.height) * h;
  const ms = (t: number) => ECG_PLOT.left + (t / 800) * (ECG_PLOT.right - ECG_PLOT.left);
  return painted(
    w,
    h,
    (ctx) => {
      ctx.fillStyle = "#FFF7EC";
      ctx.fillRect(0, 0, w, h);
      // ECG paper: small squares 40 ms, big squares 200 ms.
      const small = (ms(40) - ms(0)) * (w / ECG_PANEL.width);
      const rule = (i: number) => {
        ctx.strokeStyle = i % 5 === 0 ? "rgba(224,122,95,0.7)" : "rgba(224,122,95,0.3)";
        ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.2;
      };
      for (let i = 0, x = px(ECG_PLOT.left); x <= px(ECG_PLOT.right) + 1; i++, x += small) {
        rule(i);
        ctx.beginPath();
        ctx.moveTo(x, py(0.62));
        ctx.lineTo(x, py(-0.62));
        ctx.stroke();
      }
      for (let i = -6, y = py(ECG_PLOT.baseline) + 6 * small; i <= 6; i++, y -= small) {
        if (y < py(0.62) - 1 || y > py(-0.62) + 1) continue;
        rule(i);
        ctx.beginPath();
        ctx.moveTo(px(ECG_PLOT.left), y);
        ctx.lineTo(px(ECG_PLOT.right), y);
        ctx.stroke();
      }
      ctx.fillStyle = THEME.inkSoft;
      ctx.textBaseline = "middle";
      ctx.font = `700 46px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillText("ECG", px(ECG_PLOT.left), py(0.78));
      ctx.textAlign = "right";
      ctx.fillText("one beat · 800 ms", px(ECG_PLOT.right), py(0.78));
      ctx.font = `600 34px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillText("0 ms", px(ECG_PLOT.left), py(-0.8));
      ctx.textAlign = "right";
      ctx.fillText("800 ms", px(ECG_PLOT.right), py(-0.8));
    },
    8,
  );
}

/** A ribbon along the ECG polyline; drawing the first k samples shows the trace up to sample k. */
export function ecgTraceGeometry(samples: Float32Array, halfWidth: number): THREE.BufferGeometry {
  const n = samples.length / 2;
  const positions = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const tx = samples[2 * b] - samples[2 * a];
    const ty = samples[2 * b + 1] - samples[2 * a + 1];
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const x = samples[2 * i];
    const y = samples[2 * i + 1];
    positions.set([x + nx * halfWidth, y + ny * halfWidth, 0, x - nx * halfWidth, y - ny * halfWidth, 0], i * 6);
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

export function ecgPanelMesh(): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(ECG_PANEL.width + 0.2, ECG_PANEL.height + 0.2, 0.16, 4, 0.12);
  const mesh = new THREE.Mesh(geometry, makeToonMaterial(THEME.cream));
  addOutline(mesh, 0.035);
  return mesh;
}
