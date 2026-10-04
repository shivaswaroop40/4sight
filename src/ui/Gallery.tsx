// src/ui/Gallery.tsx
//
// The experience picker in the top bar and the gallery it opens. The gallery
// is a native modal <dialog>: the page behind it is inert and Esc closes it.
// Cards read as a ladder of timescales, shortest first, each with a rung
// that places its span between one second and the age of the universe.
// Picking a card keeps the gallery open on that card's loading state until
// the experience mounts.

import { useEffect, useId, useRef } from "react";
import type { ExperienceId } from "../core/types";
import { formatSpan, rungPosition } from "../core/timescale";
import { entryFor, experiences, type ExperienceEntry } from "../experiences/index";
import { ChevronIcon, CloseIcon } from "./icons";
import { getUi, setUi, showExperience, useUi, type LoadState } from "./runtime";
import "./Gallery.css";

const PICKER_ID = "experience-picker";

export function ExperiencePicker() {
  const experience = useUi((s) => s.experience);
  const load = useUi((s) => s.load);
  const open = useUi((s) => s.galleryOpen);
  const entry = experience ? entryFor(experience.id) : load.status !== "ready" ? entryFor(load.id) : undefined;

  return (
    <button
      type="button"
      id={PICKER_ID}
      className="picker"
      data-hud-edge="top"
      aria-haspopup="dialog"
      aria-expanded={open}
      title="All experiences (G)"
      onClick={() => setUi({ galleryOpen: true })}
    >
      <span className="picker__name">{entry?.name ?? "Experiences"}</span>
      {entry && <span className="picker__span">{formatSpan(entry.spanSeconds)}</span>}
      {load.status === "loading" ? <span className="spinner" aria-label="Loading" /> : <ChevronIcon up={false} />}
    </button>
  );
}

export function Gallery() {
  const open = useUi((s) => s.galleryOpen);
  const currentId = useUi((s) => s.experience?.id ?? null);
  const load = useUi((s) => s.load);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const current = gridRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]');
      (current ?? gridRef.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const onClose = () => {
    setUi({ galleryOpen: false });
    document.getElementById(PICKER_ID)?.focus();
  };

  const pick = (id: ExperienceId) => {
    void showExperience(id).then(() => {
      if (getUi().experience?.id === id) setUi({ galleryOpen: false });
    });
  };

  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const grid = e.currentTarget;
    const cards = Array.from(grid.querySelectorAll<HTMLButtonElement>(".gcard"));
    const i = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    const next: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: i + columns,
      ArrowUp: i - columns,
      Home: 0,
      End: cards.length - 1,
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    cards[Math.min(cards.length - 1, Math.max(0, next[e.key]))].focus();
  };

  return (
    <dialog
      ref={dialogRef}
      className="gallery"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && setUi({ galleryOpen: false })}
    >
      <div className="card gallery__sheet">
        <header className="gallery__head">
          <div>
            <span className="caps">Experiences</span>
            <h2 className="gallery__title" id={titleId}>
              Pick a timescale
            </h2>
            <p className="gallery__lede">From seconds to billions of years. Each one is a world you can scrub.</p>
          </div>
          <button
            type="button"
            className="btn gallery__close"
            aria-label="Close"
            title="Close (Esc)"
            onClick={() => setUi({ galleryOpen: false })}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="gallery__grid" ref={gridRef} onKeyDown={onGridKey}>
          {experiences.map((entry, i) => (
            <Card
              key={entry.id}
              entry={entry}
              color={i % 4}
              current={entry.id === currentId}
              state={cardState(entry.id, load)}
              onPick={() => pick(entry.id)}
            />
          ))}
        </div>
      </div>
    </dialog>
  );
}

type CardState = "idle" | "loading" | "failed";

function cardState(id: ExperienceId, load: LoadState): CardState {
  if (load.status === "ready" || load.id !== id) return "idle";
  return load.status;
}

interface CardProps {
  entry: ExperienceEntry;
  color: number;
  current: boolean;
  state: CardState;
  onPick: () => void;
}

function Card({ entry, color, current, state, onPick }: CardProps) {
  const span = formatSpan(entry.spanSeconds);
  return (
    <button
      type="button"
      className="gcard"
      data-color={color}
      data-state={state}
      aria-current={current ? "true" : undefined}
      aria-busy={state === "loading"}
      aria-label={`${entry.name}. ${entry.tagline}. Spans ${span}.${current ? " Now showing." : ""}`}
      onClick={onPick}
    >
      <span className="gcard__top">
        <span className="badge">{span}</span>
        {current && <span className="gcard__now">Now showing</span>}
        {state === "loading" && (
          <span className="gcard__status">
            <span className="spinner" aria-hidden="true" /> Loading
          </span>
        )}
        {state === "failed" && <span className="gcard__status gcard__status--error">Couldn't load. Try again</span>}
      </span>
      <span className="gcard__name">{entry.name}</span>
      <span className="gcard__tagline">{entry.tagline}</span>
      <span className="rung" aria-hidden="true" style={{ "--x": rungPosition(entry.spanSeconds) } as React.CSSProperties}>
        <span className="rung__track">
          <span className="rung__dot" />
        </span>
        <span className="rung__ends">
          <span>1 second</span>
          <span>Age of the universe</span>
        </span>
      </span>
    </button>
  );
}
