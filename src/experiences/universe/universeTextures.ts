// src/experiences/universe/universeTextures.ts
//
// Hand-drawn looking canvas sprites with ink outlines: spiral and elliptical
// galaxies, a first-star sparkle, and the Big Bang burst. Generated once at
// mount. Browser only.

import * as THREE from "three";
import { THEME } from "../../core/theme";

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Strokes the current path twice: a fat ink line, then the colour on top. */
function inked(ctx: CanvasRenderingContext2D, color: string, width: number, ink: number): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = THEME.ink;
  ctx.lineWidth = width + ink * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A tapered arm, fat at the core and pointed at the tip, as a closed path. */
function spiralArm(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, offset: number): void {
  const steps = 48;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const a = offset + s * 2.6;
    const r = size * (0.06 + 0.36 * s);
    const w = size * (0.2 * Math.pow(1 - s, 0.75) + 0.006);
    outer.push([cx + Math.cos(a) * (r + w / 2), cy + Math.sin(a) * (r + w / 2)]);
    inner.push([cx + Math.cos(a) * (r - w / 2), cy + Math.sin(a) * (r - w / 2)]);
  }
  ctx.beginPath();
  ctx.moveTo(...outer[0]);
  for (const p of outer) ctx.lineTo(...p);
  for (const p of inner.reverse()) ctx.lineTo(...p);
  ctx.closePath();
}

function drawSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, arm: string, core: string): void {
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = arm;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineJoin = "round";
  for (const offset of [0, Math.PI]) {
    spiralArm(ctx, cx, cy, size, offset);
    ctx.fillStyle = arm;
    ctx.fill();
    ctx.lineWidth = size * 0.022;
    ctx.strokeStyle = THEME.ink;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.lineWidth = size * 0.022;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - size * 0.03, cy - size * 0.03, size * 0.035, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
}

function drawElliptical(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.36, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#F6D9A8";
  ctx.fill();
  ctx.lineWidth = size * 0.028;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.2, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FFF3DA";
  ctx.fill();
}

/**
 * Two galaxies side by side in one atlas: a spiral on the left half and an
 * elliptical on the right. Light colours so the shader can tint them.
 */
export function galaxyAtlas(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 256);
  drawSpiral(ctx, 128, 128, 240, "#F4ECFF", "#FFE7B8");
  drawElliptical(ctx, 384, 128, 240);
  return toTexture(c);
}

/** Our galaxy: a bigger, warmer spiral so it reads as special. */
export function milkyWayTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  drawSpiral(ctx, 128, 128, 240, "#E9DDFB", THEME.mustard);
  return toTexture(c);
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number, jitter = 0): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const wobble = jitter ? 1 + jitter * Math.sin(i * 7.3) : 1;
    const r = (i % 2 === 0 ? outer : inner) * wobble;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** A four-point sparkle: a hot young star. */
export function sparkleTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  starPath(ctx, 64, 64, 4, 56, 15);
  ctx.fillStyle = "#B9DBFF";
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 64, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  return toTexture(c);
}

/** A comic-book burst for time zero. */
export function burstTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  starPath(ctx, 128, 128, 14, 122, 70, 0.12);
  ctx.fillStyle = THEME.mustard;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  starPath(ctx, 128, 128, 10, 74, 44, 0.1);
  ctx.fillStyle = THEME.cream;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(128, 128, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  return toTexture(c);
}

/** A map pin whose tip is at the bottom centre: "you are here". */
export function pinTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 160);
  ctx.beginPath();
  ctx.moveTo(64, 154);
  ctx.bezierCurveTo(44, 112, 18, 92, 18, 60);
  ctx.arc(64, 60, 46, Math.PI, 0);
  ctx.bezierCurveTo(110, 92, 84, 112, 64, 154);
  ctx.closePath();
  ctx.fillStyle = THEME.terracotta;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 58, 18, 0, Math.PI * 2);
  ctx.fillStyle = THEME.cream;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.stroke();
  return toTexture(c);
}

/** A small round Sun with stubby rays. */
export function sunTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  starPath(ctx, 64, 64, 10, 60, 40);
  ctx.fillStyle = THEME.mustard;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 64, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#FFE3A3";
  ctx.fill();
  ctx.stroke();
  return toTexture(c);
}

/** A ring of stubby cartoon rays, clear in the middle, for the hot early ball. */
export function raysTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const rays = 28;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const long = i % 2 === 0;
    const r0 = 200;
    const r1 = long ? 250 : 232;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    ctx.lineTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1);
    inked(ctx, long ? THEME.mustard : "#F8DDA8", 11, 3.5);
  }
  return toTexture(c);
}
