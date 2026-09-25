// src/ui/useShortcuts.ts
//
// Space play/pause, R reverse, Left/Right nudge u by 0.01, 0 reset.
// Ignored while typing in a form control; Space on a focused button is
// left to the button so it does not toggle twice.

import { useEffect } from "react";
import { controller } from "./runtime";

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
