// src/ui/ObjectInfo.tsx
//
// Tooltip for the hovered object. Hover text can depend on time, so the card
// re-reads the metadata on every time change but renders only when its text
// changes; the card follows the cursor by writing a transform directly.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { FourDExperience, ObjectMetadata } from "../core/types";
import { useTime, useUi } from "./runtime";
import "./ObjectInfo.css";

const OFFSET = 18;
const pointer = { x: -1000, y: -1000 };
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    },
    { passive: true, capture: true },
  );
}

function place(el: HTMLElement | null): void {
  if (!el) return;
  const { x, y } = pointer;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const left = x + OFFSET + w > window.innerWidth - 8 ? x - OFFSET - w : x + OFFSET;
  const top = y + OFFSET + h > window.innerHeight - 8 ? y - OFFSET - h : y + OFFSET;
  el.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
}

export function ObjectInfo({ experience }: { experience: FourDExperience }) {
  const hoveredId = useUi((s) => s.hoveredId);
  const ref = useRef<HTMLDivElement | null>(null);
  // getHoveredObject returns a fresh object each call; its JSON is a snapshot
  // React can compare, so playback re-renders the card only when text changes.
  const json = useTime(() => JSON.stringify(hoveredId ? experience.getHoveredObject(hoveredId) : null));
  const meta = useMemo(() => JSON.parse(json) as ObjectMetadata | null, [json]);
  const shown = meta !== null;

  useLayoutEffect(() => place(ref.current), [meta]);

  useEffect(() => {
    if (!shown) return;
    const onMove = () => place(ref.current);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [shown]);

  if (!meta) return null;
  const props = Object.entries(meta.properties ?? {});

  return (
    <div className="card tip" ref={ref} role="tooltip">
      <div className="tip__name">{meta.name}</div>
      {meta.description && <p className="tip__desc">{meta.description}</p>}
      {props.length > 0 && (
        <dl className="tip__props">
          {props.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
