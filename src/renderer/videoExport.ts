// src/renderer/videoExport.ts
//
// Encodes a video export with mediabunny over WebCodecs. It is a dynamic
// import, and mediabunny with it, so neither is in the main chunk; the More
// menu loads it when it first asks whether export is supported.
//
// The caller draws each frame; this module stacks it the way the page does:
// the paper gradient (.stage in index.css), the transparent WebGL canvas,
// then the edge vignette and dot grid (.vignette). The UI chrome is never
// drawn. Each add() is awaited, so a slow encoder slows the loop instead of
// queueing frames, and every frame is encoded whatever the speed.

import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from "mediabunny";
import type { ExportPlan } from "./exportPlan";

/** H.264 in MP4 plays everywhere. VP9 in WebM covers browsers that cannot encode H.264. */
const CONTAINERS = { avc: "mp4", vp9: "webm" } as const;

export type ExportCodec = keyof typeof CONTAINERS;

/** A bitrate target, not a constant quantizer: at constant quality Solar System's gas came out at 18 Mbit/s. */
const QUALITY = new Quality({ quality: "high", preferBitrate: true });

/** The first codec in CONTAINERS order this browser can encode at the plan's size, or null. */
export async function pickCodec(plan: ExportPlan): Promise<ExportCodec | null> {
  const codec = await getFirstEncodableVideoCodec(Object.keys(CONTAINERS) as ExportCodec[], {
    width: plan.width,
    height: plan.height,
    frameRate: plan.fps,
    quality: QUALITY,
  });
  return codec === "avc" || codec === "vp9" ? codec : null;
}

export function fileExtension(codec: ExportCodec): string {
  return CONTAINERS[codec];
}

export interface EncodeJob {
  plan: ExportPlan;
  codec: ExportCodec;
  /** Renders frame i and returns the canvas holding it, transparent where the paper shows through. */
  drawFrame(i: number): HTMLCanvasElement;
  /** Export pixels per CSS pixel of the stage, so the dot grid keeps its on-screen spacing. */
  scale: number;
  signal: AbortSignal;
  onFrame(encoded: number): void;
}

/** Resolves with the finished file, or null if the signal aborted at any point before it resolves. */
export async function encodeVideo(job: EncodeJob): Promise<Blob | null> {
  const { plan, codec } = job;
  const frame = makeCanvas(plan.width, plan.height);
  const ctx = frame.getContext("2d")!;
  const paper = paperLayer(plan.width, plan.height);
  const vignette = vignetteLayer(plan.width, plan.height, job.scale);

  const format = codec === "avc" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(frame, { codec, quality: QUALITY });
  output.addVideoTrack(source, { frameRate: plan.fps });

  try {
    await output.start();
    for (let i = 0; i < plan.frames; i++) {
      if (job.signal.aborted) return null;
      ctx.drawImage(paper, 0, 0);
      ctx.drawImage(job.drawFrame(i), 0, 0, plan.width, plan.height);
      ctx.drawImage(vignette, 0, 0);
      await source.add(i / plan.fps, 1 / plan.fps);
      job.onFrame(i + 1);
    }
    if (job.signal.aborted) return null;
    await output.finalize();
    // Cancel stays live while the file is finished; a cancel then still means no file.
    if (job.signal.aborted) return null;
    return new Blob([target.buffer!], { type: format.mimeType });
  } finally {
    // Frees the encoder. A failure here must not hide the error that got us here.
    if (output.state !== "finalized") await output.cancel().catch(() => undefined);
  }
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

type Stops = [offset: number, color: string][];

/**
 * CSS `radial-gradient(ellipse rx% ry% at cx% cy%, ...)`: radii are fractions
 * of the box's width and height. Past the last stop the last colour holds.
 */
function fillEllipse(g: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, rx: number, ry: number, stops: Stops): void {
  g.save();
  g.translate(cx * w, cy * h);
  g.scale(rx * w, ry * h);
  const gradient = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  g.fillStyle = gradient;
  g.fillRect(-cx / rx, -cy / ry, 1 / rx, 1 / ry);
  g.restore();
}

/** .stage in index.css. */
function paperLayer(w: number, h: number): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  fillEllipse(canvas.getContext("2d")!, w, h, 0.5, 0.42, 0.7, 0.6, [
    [0, "#fdf8ef"],
    [0.55, "#f3e9d7"],
    [1, "#e9dbc2"],
  ]);
  return canvas;
}

/** .vignette in index.css. Its clear stop keeps the vignette's hue: canvas gradients fade through black from "transparent". */
function vignetteLayer(w: number, h: number, scale: number): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const g = canvas.getContext("2d")!;
  fillEllipse(g, w, h, 0.5, 0.45, 0.85, 0.8, [
    [0.6, "rgba(120, 90, 60, 0)"],
    [1, "rgba(120, 90, 60, 0.14)"],
  ]);
  const step = 22 * scale;
  const r = 1.2 * scale;
  g.beginPath();
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  g.fillStyle = "rgba(59, 47, 42, 0.07)";
  g.fill();
  return canvas;
}
