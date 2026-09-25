// src/ui/ExperienceNav.tsx
//
// Sticker-style tabs with a sliding active indicator. Selecting a tab asks
// App to switch experiences; the nav itself holds no state.

import { useLayoutEffect, useRef, useState } from "react";
import type { ExperienceId, FourDExperience } from "../core/types";
import { useUi } from "./runtime";

interface Props {
  experiences: FourDExperience[];
  onSelect: (id: ExperienceId) => void;
}

export function ExperienceNav({ experiences, onSelect }: Props) {
  const current = useUi((s) => s.experienceId);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [current, experiences]);

  return (
    <div className="tabs" role="tablist" aria-label="Experience" ref={listRef}>
      {indicator && (
        <span
          className="tabs__indicator"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
          aria-hidden="true"
        />
      )}
      {experiences.map((e) => (
        <button
          key={e.id}
          type="button"
          role="tab"
          aria-selected={e.id === current}
          className="tabs__tab"
          onClick={() => e.id !== current && onSelect(e.id)}
        >
          {e.name}
        </button>
      ))}
    </div>
  );
}
