// src/ui/PerspectiveControls.tsx
//
// Camera presets of the active experience plus an Overview that frames the
// scene's bounding sphere. Presets animate over ~600 ms.

import { getExperience } from "../experiences/index";
import { CameraIcon, OverviewIcon } from "./icons";
import { runtime, useUi } from "./runtime";

export function PerspectiveControls() {
  const id = useUi((s) => s.experienceId);
  const presets = id ? (getExperience(id)?.getCameraPresets() ?? []) : [];

  return (
    <div className="views" role="group" aria-label="Camera views">
      <span className="views__label">
        <CameraIcon />
        <span>View</span>
      </span>
      {presets.map((p) => (
        <button key={p.id} type="button" className="chip" onClick={() => runtime.manager?.applyPreset(p.id)}>
          {p.name}
        </button>
      ))}
      <button type="button" className="chip chip--accent" onClick={() => runtime.manager?.overview()} title="Frame everything">
        <OverviewIcon />
        <span>Overview</span>
      </button>
    </div>
  );
}
