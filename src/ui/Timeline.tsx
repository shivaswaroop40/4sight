// src/ui/Timeline.tsx
//
// Custom timeline bound to u. The thumb and fill follow u through a CSS
// variable written from a controller subscription, so playback never
// re-renders React. Tick labels come from mapping.ticks() and thin out when
// the track is narrow; event flags sit at mapping.toParam(event.time) and
// jump there on click.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FourDExperience, TimeTick } from "../core/types";
import { controller } from "./runtime";

const NUDGE = 0.01;

export function Timeline({ experience }: { experience: FourDExperience }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  const ticks = useMemo(() => experience.mapping.ticks(), [experience]);
  const markers = useMemo(
    () => experience.events.map((e) => ({ event: e, u: experience.mapping.toParam(e.time) })),
    [experience],
  );
  const shown = useMemo(
    () => visibleTicks(ticks.map((t) => ({ u: t.u, label: endLabel(t.u, experience) ?? t.label })), width),
    [ticks, width, experience],
  );

  // Follow u without React renders.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const flags = Array.from(rail.querySelectorAll<HTMLElement>("[data-u]"));
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
  }, [experience, markers]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const ro = new ResizeObserver(() => setWidth(rail.clientWidth));
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);

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
    <div className="timeline">
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
          {markers.map(({ event, u }, i) => (
            <button
              key={event.id}
              type="button"
              className="flag"
              data-u={u}
              data-color={i % 3}
              data-edge={u < 0.04 ? "start" : u > 0.96 ? "end" : undefined}
              style={{ left: `${u * 100}%` }}
              title={`${event.title} · ${event.when}`}
              aria-label={`Jump to ${event.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => controller.jumpToEvent(event.id)}
            >
              <span className="flag__tip">{event.title}</span>
            </button>
          ))}
          <div className="timeline__thumb" />
        </div>
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
