// scripts/sceneKit.ts
//
// Small helpers shared by the scene generators (gen-mitosis.ts,
// gen-city.ts). They build keyframe JSON for src/experiences/keyframe and
// write it in a stable, diff-friendly layout. Run a generator with
// `node scripts/gen-<name>.ts`; add `--check` to fail instead of writing
// when the committed JSON is out of date.

import { readFileSync, writeFileSync } from "node:fs";

export type Vec3 = [number, number, number];
export type Ease = "linear" | "step" | "easeIn" | "easeOut" | "easeInOut" | "smooth" | "backOut";
export interface Key<V> {
  t: number;
  v: V;
  ease?: Ease;
}

export function round(x: number, digits = 4): number {
  const k = 10 ** digits;
  const r = Math.round(x * k) / k;
  return Object.is(r, -0) ? 0 : r;
}

export function v3(x: number, y: number, z: number): Vec3 {
  return [round(x), round(y), round(z)];
}

export function key<V>(t: number, v: V, ease?: Ease): Key<V> {
  return ease && ease !== "linear" ? { t: round(t), v, ease } : { t: round(t), v };
}

/** Keys sampled every `step` from `from` to `to` inclusive, for curves no single easing can follow. */
export function sampled<V>(from: number, to: number, step: number, value: (t: number) => V): Key<V>[] {
  const keys: Key<V>[] = [];
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    keys.push(key(t, value(t)));
  }
  return keys;
}

export function lerp(a: number, b: number, s: number): number {
  return a + (b - a) * s;
}

/** 0 before a, 1 after b, smoothstep between. */
export function smoothWindow(t: number, a: number, b: number): number {
  const s = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
}

export function mixHex(a: string, b: string, s: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ch = (c: number, shift: number) => (c >> shift) & 255;
  const out = [16, 8, 0].map((shift) => Math.round(lerp(ch(ca, shift), ch(cb, shift), s)));
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Deterministic pseudo-random numbers in [0, 1), so reruns write identical JSON. */
export function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** JSON with short arrays and objects kept on one line. */
export function formatJson(value: unknown, indent = ""): string {
  const flat = JSON.stringify(value);
  if (flat.length + indent.length <= 110 || value === null || typeof value !== "object") return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => inner + formatJson(v, inner)).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatJson(v, inner)}`).join(",\n")}\n${indent}}`;
}

export function writeScene(path: string, scene: unknown): void {
  const text = `${formatJson(scene)}\n`;
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      // Missing file counts as out of date.
    }
    if (current !== text) {
      console.error(`${path} is out of date. Rerun without --check.`);
      process.exit(1);
    }
    console.log(`${path} is up to date.`);
    return;
  }
  writeFileSync(path, text);
  console.log(`wrote ${path}`);
}
