// src/ui/InfoPanel.tsx
//
// "What's happening?" card for the current event. Re-renders only when the
// current event changes. Crossfades between events; collapses to a header.
// Below 900px it is a bottom sheet (see index.css).

import { useId, useState } from "react";
import type { FourDExperience } from "../core/types";
import { ChevronIcon } from "./icons";
import { useTime } from "./runtime";

export function InfoPanel({ experience }: { experience: FourDExperience }) {
  const eventId = useTime((s) => experience.getCurrentEvent(s.time)?.id ?? null);
  const event = eventId ? experience.events.find((e) => e.id === eventId) : null;
  const [open, setOpen] = useState(() => !window.matchMedia("(max-width: 899px)").matches);
  const bodyId = useId();
  const index = event ? experience.events.indexOf(event) : -1;

  return (
    <aside className="card info" data-open={open ? "1" : "0"} aria-label="What's happening">
      <button
        type="button"
        className="info__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="caps">What's happening?</span>
        <span className="info__peek">{!open && event ? event.title : ""}</span>
        <span className="info__count">
          {index >= 0 ? `${index + 1} / ${experience.events.length}` : ""}
        </span>
        <ChevronIcon up={open} />
      </button>
      <div className="info__body" id={bodyId} hidden={!open}>
        {event ? (
          <div className="info__event" key={event.id}>
            <span className="badge">{event.when}</span>
            <h2 className="info__title">{event.title}</h2>
            {event.description && <p className="info__desc">{event.description}</p>}
            {event.keyPoints.length > 0 && (
              <ul className="info__points">
                {event.keyPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="info__desc">Press play or drag the timeline to begin.</p>
        )}
      </div>
    </aside>
  );
}
