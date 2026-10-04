// src/ui/Timeline.tsx
//
// Custom timeline bound to u. The thumb and fill follow u through a CSS
// variable written from a controller subscription, so playback never
// re-renders React. Tick labels come from mapping.ticks() and thin out when
// the track is narrow; event flags sit at mapping.toParam(event.time) and
// jump there on click. Events too close to tell apart share one flag with a
// count, which opens a small list of them. The flags are siblings of the
// slider, not children: a slider's children are presentational, which hides
// them from assistive tech.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FourDExperience, TimelineEvent, TimeTick } from "../core/types";
import { clusterFlags, openClusterKey, type FlagCluster } from "./flagClusters";
import { controller, runtime } from "./runtime";
import "./Timeline.css";

const NUDGE = 0.01;
/** A flag's hit area is 24 px wide: closer than that, two flags overlap. */
const FLAG_GAP = 24;

interface Marker {
  event: TimelineEvent;
  u: number;
  color: number;
}

const markerKey = (m: Marker) => m.event.id;

export function Timeline({ experience }: { experience: FourDExperience }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const flagsRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const ticks = useMemo(() => experience.mapping.ticks(), [experience]);
  const markers = useMemo<Marker[]>(
    () => experience.events.map((e, i) => ({ event: e, u: experience.mapping.toParam(e.time), color: i % 3 })),
    [experience],
  );
  const clusters = useMemo(() => clusterFlags(markers, trackWidth, FLAG_GAP), [markers, trackWidth]);
  if (openClusterKey(clusters, openId, markerKey) !== openId) setOpenId(null);
  const shown = useMemo(
    () => visibleTicks(ticks.map((t) => ({ u: t.u, label: endLabel(t.u, experience) ?? t.label })), width),
    [ticks, width, experience],
  );

  // Follow u without React renders.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const flags = Array.from(rootRef.current!.querySelectorAll<HTMLElement>("[data-u]"));
    const apply = () => {
      const { param, time } = controller.state;
      rail.style.setProperty("--u", String(param));
      rail.setAttribute("aria-valuenow", param.toFixed(3));
      rail.setAttribute("aria-valuetext", experience.mapping.format(time));
      for (const f of flags) {
        const passed = param + 1e-6 >= Number(f.dataset.u);
        if ((f.dataset.passed === "1") !== passed) f.dataset.passed = passed ? "1" : "0";
      }
    };
    apply();
    return controller.subscribe(apply);
  }, [experience, clusters, openId]);

  useEffect(() => {
    const rail = railRef.current;
    const flags = flagsRef.current;
    if (!rail || !flags) return;
    const ro = new ResizeObserver(() => {
      setWidth(rail.clientWidth);
      setTrackWidth(flags.clientWidth);
    });
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);

  const jump = (id: string) => {
    controller.jumpToEvent(id);
    runtime.urlSync?.flush();
  };

  const paramFromEvent = (clientX: number) => {
    const rail = railRef.current!;
    const inner = rail.querySelector<HTMLElement>(".timeline__inner")!.getBoundingClientRect();
    return (clientX - inner.left) / inner.width;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rail = e.currentTarget;
    rail.setPointerCapture(e.pointerId);
    rail.dataset.dragging = "1";
    controller.setScrubbing(true);
    controller.setParam(paramFromEvent(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.dataset.dragging !== "1") return;
    controller.setParam(paramFromEvent(e.clientX));
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.dataset.dragging !== "1") return;
    e.currentTarget.dataset.dragging = "0";
    controller.setScrubbing(false);
    runtime.urlSync?.flush();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? NUDGE * 10 : NUDGE;
    const u = controller.state.param;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = u + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = u - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    controller.setParam(next);
  };

  return (
    <div className="timeline" ref={rootRef}>
      <div
        className="timeline__rail"
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className="timeline__inner">
          <div className="timeline__track">
            <div className="timeline__fill" />
            {ticks.map((t) => (
              <span key={`n${t.u}`} className="timeline__notch" style={{ left: `${t.u * 100}%` }} />
            ))}
          </div>
          <div className="timeline__thumb" />
        </div>
      </div>
      <div className="timeline__flags" role="group" aria-label="Events" ref={flagsRef}>
        {clusters.map((c) =>
          c.items.length === 1 ? (
            <EventFlag key={markerKey(c.items[0])} marker={c.items[0]} onPick={jump} />
          ) : (
            <ClusterFlag
              key={markerKey(c.items[0])}
              cluster={c}
              trackWidth={trackWidth}
              open={openId === markerKey(c.items[0])}
              setOpenId={setOpenId}
              onPick={jump}
            />
          ),
        )}
      </div>
      <div className="timeline__ticks" aria-hidden="true">
        {shown.map((t) => (
          <span key={t.u} className="timeline__tick" style={{ left: `${t.u * 100}%` }} data-edge={edge(t.u)}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function flagEdge(u: number): "start" | "end" | undefined {
  return u < 0.04 ? "start" : u > 0.96 ? "end" : undefined;
}

function EventFlag({ marker: { event, u, color }, onPick }: { marker: Marker; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      className="flag"
      data-u={u}
      data-color={color}
      data-edge={flagEdge(u)}
      style={{ left: `${u * 100}%` }}
      title={`${event.title} · ${event.when}`}
      aria-label={`Jump to ${event.title}`}
      onClick={() => onPick(event.id)}
    >
      <span className="flag__tip">{event.title}</span>
    </button>
  );
}

/** One flag for several close events. It opens a list of them; Escape or a click elsewhere closes it. */
function ClusterFlag({
  cluster,
  trackWidth,
  open,
  setOpenId,
  onPick,
}: {
  cluster: FlagCluster<Marker>;
  trackWidth: number;
  open: boolean;
  setOpenId: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [first] = cluster.items;
  const x = cluster.u * trackWidth;

  // Centred on the flag, but kept over the track.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const w = list.offsetWidth;
    list.style.left = `${Math.min(Math.max(x - w / 2, 0), Math.max(0, trackWidth - w))}px`;
  }, [open, x, trackWidth]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("button")?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpenId(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, setOpenId]);

  const close = () => {
    setOpenId(null);
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="flag flag--cluster"
        data-u={cluster.end}
        data-color={first.color}
        data-edge={flagEdge(cluster.u)}
        style={{ left: `${cluster.u * 100}%` }}
        title={cluster.items.map((m) => `${m.event.title} · ${m.event.when}`).join("\n")}
        aria-label={`${cluster.items.length} events: ${cluster.items.map((m) => m.event.title).join("; ")}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpenId(open ? null : first.event.id)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            close();
          }
        }}
      >
        <span className="flag__count" aria-hidden="true">
          {cluster.items.length}
        </span>
        {!open && (
          <span className="flag__tip">
            {first.event.title} +{cluster.items.length - 1}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          className="card flaglist"
          role="menu"
          aria-label="Events here"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
              return;
            }
            const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: -1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            items.at(next % items.length)?.focus();
          }}
        >
          {cluster.items.map((m) => (
            <button
              key={m.event.id}
              type="button"
              role="menuitem"
              className="flaglist__item"
              data-u={m.u}
              data-color={m.color}
              onClick={() => {
                onPick(m.event.id);
                close();
              }}
            >
              <span className="flaglist__title">{m.event.title}</span>
              <span className="flaglist__when">{m.event.when}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** The experience's own end labels replace the ticks at u = 0 and u = 1. */
function endLabel(u: number, experience: FourDExperience): string | undefined {
  if (u <= 0.001) return experience.labels.start;
  if (u >= 0.999) return experience.labels.end;
  return undefined;
}

function edge(u: number): string | undefined {
  if (u <= 0.001) return "start";
  if (u >= 0.999) return "end";
  return undefined;
}

/** Greedy label thinning on real label extents (edge labels are flush), always keeping both ends. */
export function visibleTicks(ticks: TimeTick[], width: number): TimeTick[] {
  if (width <= 0) return ticks;
  const GAP = 10;
  const extent = (t: TimeTick): [number, number] => {
    const w = t.label.length * 7.6 + 4;
    const x = t.u * width;
    if (t.u <= 0.001) return [x - 4, x - 4 + w];
    if (t.u >= 0.999) return [x + 4 - w, x + 4];
    return [x - w / 2, x + w / 2];
  };
  const sorted = [...ticks].sort((a, b) => a.u - b.u);
  const last = sorted.at(-1);
  const kept: TimeTick[] = [];
  for (const t of sorted) {
    const prev = kept.at(-1);
    if (!prev || extent(t)[0] >= extent(prev)[1] + GAP) kept.push(t);
  }
  if (last && kept.at(-1) !== last) {
    while (kept.length > 1 && extent(last)[0] < extent(kept.at(-1)!)[1] + GAP) kept.pop();
    kept.push(last);
  }
  return kept;
}
