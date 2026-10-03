// src/ui/StatusRail.tsx
//
// Transient chips under the top bar, centered: the guided tour's bar, a
// failed experience load with Retry, and the result of Copy link. "Link
// copied" fades on its own; a failed copy stays, with the link selectable,
// until dismissed. The tour bar shows where the tour is (one dot per event)
// with Next and Exit, then "Tour complete" for a moment. While the tour
// holds on an event, Next fills up over the hold, so the viewer can see
// when it moves on.
//
// StageNotice covers the one case the rail cannot: nothing is mounted yet,
// so the first load's progress or failure takes the stage.

import { useEffect } from "react";
import type { FourDExperience } from "../core/types";
import { entryFor } from "../experiences/index";
import { CloseIcon, LinkIcon, NextIcon, ResetIcon, TourIcon } from "./icons";
import { getUi, setUi, showExperience, useUi } from "./runtime";
import { holdMs } from "./tour/tourMachine";
import { dispatchTour } from "./tour/tourRunner";

const COPIED_MS = 2000;

export function StatusRail() {
  const load = useUi((s) => s.load);
  const mounted = useUi((s) => s.experience !== null);
  const failed = mounted && load.status === "failed" ? load : null;
  const toast = useUi((s) => s.toast);

  useEffect(() => {
    if (toast?.kind !== "copied") return;
    const timer = window.setTimeout(() => {
      if (getUi().toast === toast) setUi({ toast: null });
    }, COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="rail" role="status">
      <TourBar />
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
      {toast?.kind === "copied" && (
        <div className="sticker toast toast--ok">
          <LinkIcon />
          <span>Link copied</span>
        </div>
      )}
      {toast?.kind === "copyFailed" && (
        <div className="sticker toast toast--error">
          <span>Couldn't copy. Here's the link:</span>
          <input
            className="toast__url"
            readOnly
            value={toast.url}
            aria-label="Link to this moment"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className="toast__dismiss" aria-label="Dismiss" onClick={() => setUi({ toast: null })}>
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function TourBar() {
  const tour = useUi((s) => s.tour);
  const experience = useUi((s) => s.experience);
  if (tour.phase === "done") {
    return (
      <div className="sticker toast toast--ok">
        <TourIcon />
        <span>Tour complete</span>
      </div>
    );
  }
  if (tour.phase === "idle" || !experience) return null;
  return <TourProgress experience={experience} index={tour.index} reading={tour.phase === "reading"} />;
}

function TourProgress({ experience, index, reading }: { experience: FourDExperience; index: number; reading: boolean }) {
  const { events } = experience;
  return (
    <div className="sticker tourbar" role="group" aria-label="Guided tour">
      <span className="tourbar__count">
        <span className="tourbar__word">Event </span>
        {index + 1} of {events.length}
      </span>
      <span className="tourbar__dots" aria-hidden="true">
        {events.map((e, i) => (
          <span
            key={e.id}
            className="tourbar__dot"
            data-state={i < index ? "past" : i > index ? "ahead" : reading ? "here" : "heading"}
          />
        ))}
      </span>
      <button
        type="button"
        className="chip tourbar__next"
        onClick={() => dispatchTour({ type: "next" })}
      >
        {reading && (
          <span
            key={index}
            className="tourbar__hold"
            aria-hidden="true"
            style={{ animationDuration: `${holdMs(events[index])}ms` }}
          />
        )}
        <span>Next</span>
        <NextIcon />
      </button>
      <button
        type="button"
        className="tourbar__icon"
        aria-label="Exit tour"
        title="Exit tour (Esc)"
        onClick={() => dispatchTour({ type: "exit" })}
      >
        <CloseIcon />
      </button>
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
