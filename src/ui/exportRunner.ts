// src/ui/exportRunner.ts
//
// Side effects of Export video. The encoder, and mediabunny with it, is a
// chunk of its own (renderer/videoExport.ts), first loaded when the More
// menu checks whether this browser can encode a codec export uses.
//
// startExport ends the tour, pauses, borrows the renderer and drives the
// TimeController through every frame from u = 0 to u = 1, one setParam per
// frame, as fast as the encoder takes them. However it ends (saved, failed
// or cancelled), the viewer gets back the same moment, play state,
// direction, warp, camera and canvas. ExportDialog renders the progress.

import type { TimeState } from "../core/types";
import { exportPlan, frameParam } from "../renderer/exportPlan";
import type { ExportStage } from "../renderer/SceneManager";
import { controller, EXPORT_IDLE, getUi, runtime, setUi, type ExportState, type Toast } from "./runtime";
import { dispatchTour } from "./tour/tourRunner";

const FPS = 30;
/** Revoking the object URL at once can cancel the download in some browsers. */
const REVOKE_MS = 60_000;

type Encoder = typeof import("../renderer/videoExport");

let encoder: Promise<Encoder> | null = null;
let checked = false;
let abort: AbortController | null = null;

function loadEncoder(): Promise<Encoder> {
  encoder ??= import("../renderer/videoExport").catch((error: unknown) => {
    encoder = null;
    throw error;
  });
  return encoder;
}

/**
 * Sets `exportable` once a codec encodes here at this stage's export size.
 * Browsers without WebCodecs never download the encoder chunk.
 */
export function checkExportSupport(): void {
  const manager = runtime.manager;
  if (checked || !manager || typeof VideoEncoder === "undefined") return;
  checked = true;
  const { width, height } = manager.viewport;
  loadEncoder()
    .then((m) => m.pickCodec(exportPlan(1, width / height, FPS)))
    .then((codec) => setUi({ exportable: codec !== null }))
    .catch(() => {
      checked = false;
    });
}

export async function startExport(): Promise<void> {
  const manager = runtime.manager;
  const { experience, exporting } = getUi();
  if (!manager || !experience || exporting.phase !== "idle") return;
  dispatchTour({ type: "exit" });
  const before = controller.state;
  controller.pause();
  const viewport = manager.viewport;
  const plan = exportPlan(experience.baseDurationSeconds, viewport.width / viewport.height, FPS);
  const cancel = new AbortController();
  abort = cancel;
  setUi({ exporting: { phase: "rendering", frame: 0, plan } });

  let stage: ExportStage | null = null;
  let outcome: ExportState = EXPORT_IDLE;
  let toast: Toast | null = null;
  try {
    const m = await loadEncoder();
    const codec = await m.pickCodec(plan);
    if (!codec) throw new Error("This browser can't encode video at this size.");
    if (cancel.signal.aborted) return;
    const held = manager.holdForExport(plan.width, plan.height);
    stage = held;
    const blob = await m.encodeVideo({
      plan,
      codec,
      drawFrame: (i) => {
        controller.setParam(frameParam(plan, i));
        return held.render();
      },
      scale: plan.width / viewport.width,
      signal: cancel.signal,
      onFrame: (frame) => setUi({ exporting: { phase: "rendering", frame, plan } }),
    });
    if (blob) {
      const fileName = `4sight-${experience.id}.${m.fileExtension(codec)}`;
      download(blob, fileName);
      toast = { kind: "saved", fileName };
    }
  } catch (error) {
    outcome = { phase: "failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    stage?.release();
    restoreTime(before);
    abort = null;
    setUi(toast ? { exporting: outcome, toast } : { exporting: outcome });
    if (!controller.state.isPlaying) runtime.urlSync?.flush();
  }
}

/** Stops before the next frame. The restore runs as for any other ending. */
export function cancelExport(): void {
  abort?.abort();
}

/** Restores u and, when an event jump set it, the exact time (see TimeController.setTime). */
function restoreTime(before: TimeState): void {
  controller.setParam(before.param);
  if (controller.state.time !== before.time) controller.setTime(before.time);
  if (controller.state.direction !== before.direction) controller.reverse();
  controller.setPlaybackSpeed(before.playbackSpeed);
  if (before.isPlaying) controller.play();
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
}
