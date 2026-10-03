// src/ui/StatusRail.tsx
//
// Transient chips under the top bar, centered: today, a failed experience
// load with Retry. StageNotice covers the one case the rail cannot: nothing
// is mounted yet, so the first load's progress or failure takes the stage.

import { entryFor } from "../experiences/index";
import { CloseIcon, ResetIcon } from "./icons";
import { setUi, showExperience, useUi } from "./runtime";

export function StatusRail() {
  const load = useUi((s) => s.load);
  const mounted = useUi((s) => s.experience !== null);
  const failed = mounted && load.status === "failed" ? load : null;

  return (
    <div className="rail" role="status">
      {failed && (
        <div className="sticker toast toast--error">
          <span>Couldn't load {entryFor(failed.id)?.name ?? failed.id}</span>
          <button type="button" className="chip" onClick={() => void showExperience(failed.id)}>
            <ResetIcon />
            <span>Retry</span>
          </button>
          <button
            type="button"
            className="toast__dismiss"
            aria-label="Dismiss"
            onClick={() => setUi({ load: { status: "ready" } })}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}

export function StageNotice() {
  const load = useUi((s) => s.load);
  const mounted = useUi((s) => s.experience !== null);
  if (mounted || load.status === "ready") return null;
  const name = entryFor(load.id)?.name ?? load.id;

  if (load.status === "loading") {
    return (
      <div className="card notice" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="notice__title">Loading {name}</span>
      </div>
    );
  }

  return (
    <div className="card notice notice--error" role="alert">
      <span className="notice__title">Couldn't load {name}</span>
      <p className="notice__detail">{load.message}</p>
      <div className="notice__actions">
        <button type="button" className="chip chip--accent" onClick={() => void showExperience(load.id)}>
          <ResetIcon />
          <span>Retry</span>
        </button>
        <button type="button" className="chip" onClick={() => setUi({ galleryOpen: true })}>
          Pick another
        </button>
      </div>
    </div>
  );
}
