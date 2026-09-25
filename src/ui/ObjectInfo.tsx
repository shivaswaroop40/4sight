// src/ui/ObjectInfo.tsx
//
// Tooltip for the hovered object. React renders only when the hovered id
// changes; the card follows the cursor by writing a transform directly.

import { useEffect, useRef } from "react";
import type { FourDExperience } from "../core/types";
import { useUi } from "./runtime";

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

export function ObjectInfo({ experience }: { experience: FourDExperience }) {
  const hoveredId = useUi((s) => s.hoveredId);
  const ref = useRef<HTMLDivElement | null>(null);
  const meta = hoveredId ? experience.getHoveredObject(hoveredId) : null;

  useEffect(() => {
    const place = () => {
      const { x, y } = pointer;
      const el = ref.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = x + OFFSET + w > window.innerWidth - 8 ? x - OFFSET - w : x + OFFSET;
      const top = y + OFFSET + h > window.innerHeight - 8 ? y - OFFSET - h : y + OFFSET;
      el.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    };
    const onMove = () => place();
    window.addEventListener("pointermove", onMove, { passive: true });
    place();
    return () => window.removeEventListener("pointermove", onMove);
  }, [meta]);

  if (!meta) return null;
  const props = Object.entries(meta.properties ?? {}).slice(0, 3);

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
