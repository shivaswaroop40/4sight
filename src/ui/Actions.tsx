// src/ui/Actions.tsx
//
// The actions cluster in the top bar: Tour, Filters (only when the
// experience has any) and the More menu. Copy link copies a link to the
// current moment. Export video, shown once this browser is known to encode
// a codec export uses, renders u 0 to 1 into a file. Each popup closes on
// Esc (focus returns to its button) and on a press outside it. The menu
// also closes on Tab; the filters popover closes once focus leaves it.

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { isDefaultFilterState, isFilterOn } from "../core/filters";
import { formatMoment } from "../core/moment";
import type { FilterState, VisualizationFilter } from "../core/types";
import { checkExportSupport, startExport } from "./exportRunner";
import { FiltersIcon, LinkIcon, MoreIcon, TourIcon, VideoIcon } from "./icons";
import { currentMoment, pressFilter, setUi, useUi } from "./runtime";
import { isTouring } from "./tour/tourMachine";
import { dispatchTour } from "./tour/tourRunner";
import "./Actions.css";

export function Actions() {
  const experience = useUi((s) => s.experience);
  return (
    <div className="actions" role="group" aria-label="Actions" data-hud-edge="top">
      <TourButton disabled={(experience?.events.length ?? 0) === 0} />
      {experience?.filters && <FiltersPopover key={experience.id} options={experience.filters.options} />}
      <MoreMenu />
    </div>
  );
}

/** Starts the guided tour, or ends the one running. */
function TourButton({ disabled }: { disabled: boolean }) {
  const running = useUi((s) => isTouring(s.tour));
  return (
    <button
      type="button"
      className="actions__btn actions__btn--tour"
      aria-pressed={running}
      title="Tour (T)"
      disabled={disabled}
      onClick={() => dispatchTour({ type: running ? "exit" : "start" })}
    >
      <TourIcon />
      <span className="actions__label">Tour</span>
    </button>
  );
}

/** Closes an open popup on a press outside `root` (focus stays put) and on Esc anywhere (focus returns to its button). */
function useDismiss(open: boolean, root: RefObject<HTMLElement | null>, close: (refocus: boolean) => void): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, root, close]);
}

/** Copies the link with the exact current u, even mid-playback. */
async function copyLink(): Promise<void> {
  const moment = currentMoment();
  if (!moment) return;
  const url = formatMoment(window.location.href, moment);
  try {
    await navigator.clipboard.writeText(url);
    setUi({ toast: { kind: "copied" } });
  } catch {
    setUi({ toast: { kind: "copyFailed", url } });
  }
}

/** Ungrouped filters each get a switch; a group gets one radio group. Declaration order is kept. */
type FilterSection = { kind: "switch"; filter: VisualizationFilter } | { kind: "radio"; group: string; options: VisualizationFilter[] };

function sections(filters: readonly VisualizationFilter[]): FilterSection[] {
  const out: FilterSection[] = [];
  for (const filter of filters) {
    if (filter.group === undefined) {
      out.push({ kind: "switch", filter });
      continue;
    }
    const section = out.find((s) => s.kind === "radio" && s.group === filter.group);
    if (section?.kind === "radio") section.options.push(filter);
    else out.push({ kind: "radio", group: filter.group, options: [filter] });
  }
  return out;
}

function FiltersPopover({ options: filters }: { options: readonly VisualizationFilter[] }) {
  const state = useUi((s) => s.filters);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const changed = !isDefaultFilterState(filters, state);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);
  useDismiss(open, rootRef, close);

  useEffect(() => {
    if (open) rootRef.current?.querySelector<HTMLButtonElement>('[role="switch"], [role="radio"]')?.focus();
  }, [open]);

  return (
    <div
      className="popover-anchor"
      ref={rootRef}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        ref={buttonRef}
        className="actions__btn"
        aria-label={changed ? "Filters (changed)" : "Filters"}
        title="Filters"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <FiltersIcon />
        {changed && <span className="actions__dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="card filters" role="dialog" id={panelId} aria-label="Filters">
          <p className="filters__title caps" aria-hidden="true">
            Show
          </p>
          {sections(filters).map((section) =>
            section.kind === "switch" ? (
              <FilterRow key={section.filter.id} filter={section.filter} kind="switch" on={isFilterOn(filters, state, section.filter.id)} />
            ) : (
              <FilterRadios key={section.group} group={section.group} options={section.options} state={state} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** One filter control: the name is its label and the hint its description, so a screen reader says "Orbits, switch, on". */
function FilterRow({ filter, kind, on, tabIndex }: { filter: VisualizationFilter; kind: "switch" | "radio"; on: boolean; tabIndex?: number }) {
  const nameId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role={kind}
      aria-checked={on}
      aria-labelledby={nameId}
      aria-describedby={filter.description ? hintId : undefined}
      tabIndex={tabIndex}
      className="filters__row"
      onClick={() => pressFilter(filter.id)}
    >
      <span className="filters__text">
        <span className="filters__name" id={nameId}>
          {filter.name}
        </span>
        {filter.description && (
          <span className="filters__hint" id={hintId}>
            {filter.description}
          </span>
        )}
      </span>
      <span className={kind} aria-hidden="true" />
    </button>
  );
}

/** Arrow keys move the selection, as in a native radio group; only the selected option is in the tab order. */
function FilterRadios({ group, options, state }: { group: string; options: VisualizationFilter[]; state: FilterState }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    const next = (i + step + radios.length) % radios.length;
    radios[next]?.focus();
    pressFilter(options[next].id);
  };
  return (
    <div className="filters__group" role="radiogroup" aria-label={group} onKeyDown={onKeyDown}>
      <p className="filters__title caps" aria-hidden="true">
        {group}
      </p>
      {options.map((option) => {
        const on = isFilterOn(options, state, option.id);
        return <FilterRow key={option.id} filter={option} kind="radio" on={on} tabIndex={on ? 0 : -1} />;
      })}
    </div>
  );
}

function MoreMenu() {
  const exportable = useUi((s) => s.exportable);
  const loading = useUi((s) => s.load.status === "loading");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);
  useDismiss(open, rootRef, close);

  useEffect(() => {
    if (open) rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(i + step + items.length) % items.length]?.focus();
    }
  };

  return (
    <div className="popover-anchor" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="actions__btn"
        aria-label="More"
        title="More"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onPointerEnter={checkExportSupport}
        onFocus={checkExportSupport}
        onClick={() => {
          checkExportSupport();
          setOpen((o) => !o);
        }}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="card menu" role="menu" id={menuId} aria-label="More" onKeyDown={onMenuKey}>
          <button
            type="button"
            role="menuitem"
            className="menu__item"
            onClick={() => {
              close(true);
              void copyLink();
            }}
          >
            <LinkIcon />
            <span>Copy link</span>
          </button>
          {exportable && (
            <button
              type="button"
              role="menuitem"
              className="menu__item"
              aria-disabled={loading}
              title={loading ? "Available once the experience has loaded" : undefined}
              onClick={() => {
                if (loading) return;
                // Focus on More first, so the export dialog hands it back there when it closes.
                close(true);
                void startExport();
              }}
            >
              <VideoIcon />
              <span>Export video</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
