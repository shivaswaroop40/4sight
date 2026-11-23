// src/renderer/videoExport.ts
//
// Encodes a video export with mediabunny over WebCodecs. It is a dynamic
// import, and mediabunny with it, so neither is in the main chunk; the
// first export loads it.
//
// The caller draws each frame; this module lays it over the flat paper the
// page shows behind the transparent WebGL canvas (.stage in index.css). The
// UI chrome is never drawn. Each add() is awaited, so a slow encoder slows
// the loop instead of queueing frames, and every frame is encoded whatever
// the speed.

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

/** .stage's background in index.css. */
const PAPER = "#f3e9d7";

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
  signal: AbortSignal;
  onFrame(encoded: number): void;
}

/** Resolves with the finished file, or null if the signal aborted at any point before it resolves. */
export async function encodeVideo(job: EncodeJob): Promise<Blob | null> {
  const { plan, codec } = job;
  const frame = makeCanvas(plan.width, plan.height);
  const ctx = frame.getContext("2d")!;
  ctx.fillStyle = PAPER;

  const format = codec === "avc" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const source = new CanvasSource(frame, { codec, quality: QUALITY });
  output.addVideoTrack(source, { frameRate: plan.fps });

  try {
    await output.start();
    for (let i = 0; i < plan.frames; i++) {
      if (job.signal.aborted) return null;
      ctx.fillRect(0, 0, plan.width, plan.height);
      ctx.drawImage(job.drawFrame(i), 0, 0, plan.width, plan.height);
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
