// src/ui/useTimeState.ts
//
// Subscribes a React component to the TimeController without putting any
// state in the render loop. The render loop drives Three.js directly;
// this hook only re-renders the UI (slider, panel, transport bar) when the
// controller's state changes.

import { useEffect, useState } from "react";
import type { TimeController, TimeState } from "../core/types";

export function useTimeState(controller: TimeController): TimeState {
  const [state, setState] = useState<TimeState>(controller.state);

  useEffect(() => {
    setState(controller.state);
    return controller.subscribe(setState);
  }, [controller]);

  return state;
}
