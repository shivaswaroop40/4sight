// src/ui/TimeControls.tsx
//
// Play/pause, direction, reset, and the current-time readout.

import type { FourDExperience } from "../core/types";
import { DirectionIcon, PauseIcon, PlayIcon, ResetIcon } from "./icons";
import { controller, useTime } from "./runtime";

export function TimeControls() {
  const isPlaying = useTime((s) => s.isPlaying);
  const direction = useTime((s) => s.direction);

  return (
    <div className="controls" role="group" aria-label="Playback">
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => controller.toggle()}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        className={direction === -1 ? "btn btn--on" : "btn"}
        onClick={() => controller.reverse()}
        aria-label={direction === 1 ? "Direction: forward. Switch to reverse" : "Direction: reverse. Switch to forward"}
        aria-pressed={direction === -1}
        title={`${direction === 1 ? "Forward" : "Reverse"} (R to flip)`}
      >
        <DirectionIcon direction={direction} />
      </button>
      <button type="button" className="btn" onClick={() => controller.reset()} aria-label="Reset" title="Reset (0)">
        <ResetIcon />
      </button>
    </div>
  );
}

export function TimeReadout({ experience }: { experience: FourDExperience }) {
  const text = useTime((s) => experience.mapping.format(s.time));
  const direction = useTime((s) => s.direction);
  return (
    <div className="readout" aria-live="off">
      <span className="readout__label">
        {experience.name} · {direction === 1 ? "forward" : "reverse"}
      </span>
      <span className="readout__time">{text}</span>
    </div>
  );
}
