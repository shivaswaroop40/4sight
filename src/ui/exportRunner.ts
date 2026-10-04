// src/ui/exportRunner.ts
//
// Side effects of Export video. The More menu asks WebCodecs directly
// whether this browser can encode a codec export uses. The encoder, and
// mediabunny with it, is a chunk of its own (renderer/videoExport.ts),
// first loaded when an export starts.
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

let checked = false;
let abort: AbortController | null = null;

/**
 * H.264 High and VP9 profile 0, both at level 4.0, which covers 1920x1080
 * either way up. startExport still asks the encoder chunk for the exact
 * codec; this only decides whether to offer Export video.
 */
const PROBE_CODECS = ["avc1.640028", "vp09.00.40.08"];

/** Sets `exportable` once WebCodecs says a codec encodes here at this stage's export size. Loads no chunk. */
export function checkExportSupport(): void {
  const manager = runtime.manager;
  if (checked || !manager || typeof VideoEncoder === "undefined") return;
  checked = true;
  const { width, height } = manager.viewport;
  const { width: w, height: h, fps } = exportPlan(1, width / height, FPS);
  Promise.all(PROBE_CODECS.map((codec) => VideoEncoder.isConfigSupported({ codec, width: w, height: h, framerate: fps })))
    .then((results) => setUi({ exportable: results.some((r) => r.supported === true) }))
    .catch(() => {
      checked = false;
    });
}

export async function startExport(): Promise<void> {
  const manager = runtime.manager;
  const { experience, exporting, load } = getUi();
  // A chunk that lands mid-export would mount into the video.
  if (!manager || !experience || exporting.phase !== "idle" || load.status === "loading") return;
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
    const m = await import("../renderer/videoExport");
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
