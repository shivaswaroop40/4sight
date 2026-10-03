// src/ui/StatusRail.tsx
//
// Transient chips under the top bar, centered: the guided tour's bar, the
// object the camera follows with a stop button, a failed experience load
// with Retry, the result of Copy link, and the file a video export saved.
// "Link copied" and "Saved" fade on their own; a failed copy stays, with
// the link selectable, until dismissed. The tour bar shows where the tour
// is (one dot per event) with Next and Exit, then "Tour complete" for a
// moment. While the tour holds on an event, Next fills up over the hold,
// so the viewer can see when it moves on.
//
// StageNotice covers the one case the rail cannot: nothing is mounted yet,
// so the first load's progress or failure takes the stage.

import { useEffect, useRef } from "react";
import type { FourDExperience } from "../core/types";
import { entryFor } from "../experiences/index";
import { CloseIcon, FollowIcon, LinkIcon, NextIcon, ResetIcon, TourIcon, VideoIcon } from "./icons";
import { getUi, runtime, setUi, showExperience, useUi } from "./runtime";
import { holdMs } from "./tour/tourMachine";
import { dispatchTour } from "./tour/tourRunner";

const FADE_MS = { copied: 2000, saved: 3500 } as const;

export function StatusRail() {
  const load = useUi((s) => s.load);
  const mounted = useUi((s) => s.experience !== null);
  const failed = mounted && load.status === "failed" ? load : null;
  const toast = useUi((s) => s.toast);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (toast?.kind !== "copied" && toast?.kind !== "saved") return;
    const timer = window.setTimeout(() => {
      if (getUi().toast === toast) setUi({ toast: null });
    }, FADE_MS[toast.kind]);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // The mobile info sheet stops short of the rail, whatever chips it holds.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty("--rail-bottom", `${el.getBoundingClientRect().bottom}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rail" role="status" ref={ref}>
      <TourBar />
      <FollowChip />
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
      {toast?.kind === "saved" && (
        <div className="sticker toast toast--ok">
          <VideoIcon />
          <span>Saved {toast.fileName}</span>
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

function FollowChip() {
  const camera = useUi((s) => s.camera);
  const experience = useUi((s) => s.experience);
  if (camera.mode !== "follow" || !experience) return null;
  const name = experience.getHoveredObject(camera.id)?.name ?? camera.id;
  return (
    <div className="sticker toast follow">
      <FollowIcon />
      <span className="follow__label">
        Following <b>{name}</b>
      </span>
      {!camera.shown && <span className="follow__hidden">Hidden now</span>}
      <button
        type="button"
        className="toast__dismiss"
        aria-label={`Stop following ${name}`}
        title="Stop following (Esc)"
        onClick={() => runtime.manager?.stopFollowing()}
      >
        <CloseIcon />
      </button>
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
