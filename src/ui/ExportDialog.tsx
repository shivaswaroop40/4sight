// src/ui/ExportDialog.tsx
//
// The progress of a video export, as a native modal <dialog>: the page
// behind it is inert, so nothing can move time or the camera mid-export.
// It counts frames, then says it is saving while the file is finished.
// Cancel and Esc stop the export; a failure stays up with its reason until
// closed. The runner (exportRunner.ts) owns everything this shows.

import { useEffect, useId, useRef } from "react";
import { cancelExport } from "./exportRunner";
import { CloseIcon, VideoIcon } from "./icons";
import { EXPORT_IDLE, setUi, useUi, type ExportState } from "./runtime";

export function ExportDialog() {
  const exporting = useUi((s) => s.exporting);
  const name = useUi((s) => s.experience?.name ?? "");
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const open = exporting.phase !== "idle";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismiss = () => {
    if (exporting.phase === "rendering") cancelExport();
    else setUi({ exporting: EXPORT_IDLE });
  };

  return (
    <dialog
      ref={dialogRef}
      className="exporter"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <div className="card exporter__sheet">
        <p className="exporter__eyebrow caps">
          <VideoIcon />
          Export video
        </p>
        <Body state={exporting} name={name} titleId={titleId} />
        <button type="button" className="chip exporter__action" onClick={dismiss}>
          {exporting.phase === "failed" ? (
            "Close"
          ) : (
            <>
              <CloseIcon />
              <span>Cancel</span>
            </>
          )}
        </button>
      </div>
    </dialog>
  );
}

function Body({ state, name, titleId }: { state: ExportState; name: string; titleId: string }) {
  if (state.phase === "failed") {
    return (
      <>
        <h2 className="exporter__title" id={titleId}>
          Couldn't export
        </h2>
        <p className="exporter__detail">{state.message}</p>
      </>
    );
  }
  if (state.phase === "idle") return null;
  const { frame, plan } = state;
  const status = frame === 0 ? "Getting ready" : frame < plan.frames ? `Frame ${frame} of ${plan.frames}` : "Saving the file";
  return (
    <>
      <h2 className="exporter__title" id={titleId}>
        {name}
      </h2>
      <p className="exporter__detail">
        {plan.width} x {plan.height}, {Math.round(plan.frames / plan.fps)} seconds
      </p>
      <div
        className="exporter__bar"
        role="progressbar"
        aria-label="Frames rendered"
        aria-valuemin={0}
        aria-valuemax={plan.frames}
        aria-valuenow={frame}
        aria-valuetext={status}
      >
        <span className="exporter__fill" style={{ transform: `scaleX(${frame / plan.frames})` }} />
      </div>
      <p className="exporter__status">{status}</p>
    </>
  );
}
