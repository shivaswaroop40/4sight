// src/ui/InfoPanel.tsx
//
// "What's happening?" card for the current event. Re-renders only when the
// current event changes. Crossfades between events; collapses to a header.
// Below 900px it is a bottom sheet (see InfoPanel.css). While the guided tour
// holds on an event the card is highlighted and opens, even if collapsed;
// collapsing it then holds until the next event or the end of the tour.

import { useId, useState } from "react";
import type { FourDExperience } from "../core/types";
import { ChevronIcon } from "./icons";
import { useTime, useUi } from "./runtime";
import "./InfoPanel.css";

export function InfoPanel({ experience }: { experience: FourDExperience }) {
  const eventId = useTime((s) => experience.getCurrentEvent(s.time)?.id ?? null);
  const event = eventId ? experience.events.find((e) => e.id === eventId) : null;
  const [open, setOpen] = useState(() => !window.matchMedia("(max-width: 899px)").matches);
  const reading = useUi((s) => (s.tour.phase === "reading" ? s.tour.index : null));
  const touring = useUi((s) => s.tour.phase !== "idle");
  const [closedDuring, setClosedDuring] = useState<number | null>(null);
  // A collapse holds for one tour: the next tour opens on its first event again.
  if (!touring && closedDuring !== null) setClosedDuring(null);
  const forced = reading !== null && closedDuring !== reading;
  const shown = open || forced;
  const bodyId = useId();
  const index = event ? experience.events.indexOf(event) : -1;

  const toggle = () => {
    setOpen(!shown);
    if (shown && reading !== null) setClosedDuring(reading);
  };

  return (
    <aside
      className="card info"
      data-hud-edge="bottom"
      data-open={shown ? "1" : "0"}
      data-reading={reading !== null ? "1" : undefined}
      aria-label="What's happening"
    >
      <button
        type="button"
        className="info__head"
        data-hud-rest
        onClick={toggle}
        aria-expanded={shown}
        aria-controls={bodyId}
      >
        <span className="caps">What's happening?</span>
        <span className="info__peek">{!shown && event ? event.title : ""}</span>
        <span className="info__count">
          {index >= 0 ? `${index + 1} / ${experience.events.length}` : ""}
        </span>
        <ChevronIcon up={shown} />
      </button>
      <div className="info__body" id={bodyId} hidden={!shown}>
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
