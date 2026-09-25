// src/ui/TimeWarp.tsx
//
// Pill segmented control over the experience's usable warp presets, plus
// the effective rate in experience units at the current position.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FourDExperience } from "../core/types";
import { effectiveRate, formatRate, formatWarp, passSeconds, usableWarpPresets } from "../core/warp";
import { controller, useTime } from "./runtime";

export function TimeWarp({ experience }: { experience: FourDExperience }) {
  const speed = useTime((s) => s.playbackSpeed);
  const presets = useMemo(() => usableWarpPresets(experience), [experience]);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const active = group.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      setIndicator(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(group);
    return () => ro.disconnect();
  }, [speed, presets]);

  return (
    <div className="warp">
      <div className="warp__head">
        <span className="caps">Time warp</span>
        <RateText experience={experience} />
      </div>
      <div className="pills" role="radiogroup" aria-label="Time warp" ref={groupRef}>
        {indicator && (
          <span
            className="pills__indicator"
            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
            aria-hidden="true"
          />
        )}
        {presets.map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={w === speed}
            className="pills__pill"
            onClick={() => controller.setPlaybackSpeed(w)}
            title={`Full pass in ${formatSeconds(passSeconds(experience.baseDurationSeconds, w))}`}
          >
            {formatWarp(w)}
          </button>
        ))}
      </div>
    </div>
  );
}

function RateText({ experience }: { experience: FourDExperience }) {
  const text = useTime((s) =>
    formatRate(
      experience.mapping,
      effectiveRate(experience.mapping, experience.baseDurationSeconds, s.param, s.playbackSpeed, s.direction),
    ),
  );
  return (
    <span className="warp__rate" title="Experience time per real second at this point of the timeline">
      {text}
    </span>
  );
}

function formatSeconds(s: number): string {
  if (s >= 60) return `${(s / 60).toFixed(s % 60 === 0 ? 0 : 1)} min`;
  return `${Number(s.toPrecision(3))} s`;
}
