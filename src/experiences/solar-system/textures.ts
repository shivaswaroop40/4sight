// src/experiences/solar-system/textures.ts
//
// Small procedural canvas textures, generated once at mount. Browser only.

import * as THREE from "three";

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial falloff for glow sprites. */
export function glowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.6)");
  g.addColorStop(0.5, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

/** Horizontal cloud bands for the gas giants. */
export function bandsTexture(colors: string[], seed: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 256);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let y = 0;
  while (y < 256) {
    const h = 4 + rand() * 22;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(0, y, 512, h + 1);
    y += h;
  }
  // Turbulent streaks along the bands.
  for (let i = 0; i < 220; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.2;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const sy = rand() * 256;
    ctx.fillRect(rand() * 512, sy, 30 + rand() * 120, 1 + rand() * 3);
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

/** Blue oceans, green and brown continents, white poles. */
export function earthTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = "#1f4f9c";
  ctx.fillRect(0, 0, 512, 256);
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const land = ["#3f7a3a", "#5b8a3c", "#8a7a4a", "#2f6a36"];
  for (let k = 0; k < 7; k++) {
    const cx = rand() * 512;
    const cy = 50 + rand() * 156;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = land[Math.floor(rand() * land.length)];
      ctx.beginPath();
      ctx.arc(cx + (rand() - 0.5) * 90, cy + (rand() - 0.5) * 50, 4 + rand() * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#eef3f7";
  ctx.fillRect(0, 0, 512, 16);
  ctx.fillRect(0, 240, 512, 16);
  return toTexture(c);
}

/** Concentric ring bands. RingGeometry UVs are planar, so draw circles. */
export function ringTexture(inner: number, outer: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  let s = 11;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const r0 = (inner / outer) * 256;
  for (let r = r0; r < 256; r += 1.5) {
    const a = 0.25 + rand() * 0.6;
    const t = (r - r0) / (256 - r0);
    // Cassini division around 60% of the way out.
    const gap = Math.abs(t - 0.6) < 0.04 ? 0.1 : 1;
    ctx.strokeStyle = `rgba(${220 - t * 40}, ${200 - t * 50}, ${160 - t * 60}, ${a * gap})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  return toTexture(c);
}
