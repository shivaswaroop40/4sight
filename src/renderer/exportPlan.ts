// src/renderer/exportPlan.ts
//
// What a video export renders: one frame per 1/fps of a 1x pass, from u = 0
// to u = 1 inclusive, at a size that keeps the viewport's shape inside
// 1920x1080 (landscape) or 1080x1920 (portrait). Encoders want even sides.

export interface ExportPlan {
  fps: number;
  /** Frame i shows u = i / (frames - 1), so the first frame is u = 0 and the last is u = 1. */
  frames: number;
  width: number;
  height: number;
}

const LONG_SIDE = 1920;
const SHORT_SIDE = 1080;

export function exportPlan(baseDurationSeconds: number, aspect: number, fps = 30): ExportPlan {
  const frames = Math.max(2, Math.round(baseDurationSeconds * fps));
  const [boxW, boxH] = aspect >= 1 ? [LONG_SIDE, SHORT_SIDE] : [SHORT_SIDE, LONG_SIDE];
  const fitsWidth = aspect >= boxW / boxH;
  const width = fitsWidth ? boxW : even(boxH * aspect, boxW);
  const height = fitsWidth ? even(boxW / aspect, boxH) : boxH;
  return { fps, frames, width, height };
}

/** The timeline position of frame `i`. */
export function frameParam(plan: ExportPlan, i: number): number {
  return i / (plan.frames - 1);
}

function even(x: number, max: number): number {
  return Math.min(max, Math.max(2, Math.round(x / 2) * 2));
}
