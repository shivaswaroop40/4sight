// src/ui/useShortcuts.ts
//
// Space play/pause, R reverse, Left/Right nudge u by 0.01, 0 reset,
// G opens the gallery, T starts or ends the guided tour. Esc closes the
// top-most thing: the gallery (a native modal dialog that closes itself),
// then an open menu or popover (which claims the key with preventDefault),
// then the tour.
//
// Ignored while a modal dialog is open (its own keys win) and, except Esc,
// while typing in a form control; Space on a focused button is left to the
// button so it does not toggle twice. Playing, scrubbing, nudging or
// resetting during the tour ends it (see tour/tourRunner.ts). Each shortcut
// is named in its button's title.

import { useEffect } from "react";
import { controller, getUi, setUi } from "./runtime";
import { isTouring } from "./tour/tourMachine";
import { dispatchTour } from "./tour/tourRunner";

const NUDGE = 0.01;

function isFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.matches("input, textarea, select, [role='slider']")
  );
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        if (!e.defaultPrevented) dispatchTour({ type: "exit" });
        return;
      }
      if (isFormControl(e.target)) return;
      const onButton = e.target instanceof HTMLButtonElement;
      switch (e.key) {
        case " ":
          if (onButton) return;
          e.preventDefault();
          controller.toggle();
          break;
        case "r":
        case "R":
          controller.reverse();
          break;
        case "ArrowRight":
          e.preventDefault();
          controller.setParam(controller.state.param + NUDGE);
          break;
        case "ArrowLeft":
          e.preventDefault();
          controller.setParam(controller.state.param - NUDGE);
          break;
        case "0":
          controller.reset();
          break;
        case "g":
        case "G":
          e.preventDefault();
          setUi({ galleryOpen: true });
          break;
        case "t":
        case "T":
          dispatchTour({ type: isTouring(getUi().tour) ? "exit" : "start" });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
