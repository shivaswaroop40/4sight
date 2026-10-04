// src/ui/hudBand.ts
//
// The free band: the part of the stage the HUD leaves uncovered, where camera
// presets frame their subject (see renderer/stageFit.ts). HUD chrome declares
// itself in markup instead of being looked up by class name:
//
//   data-hud-edge="top"     covers the stage from the top down to its bottom edge
//   data-hud-edge="bottom"  covers the stage from the bottom up to its top edge
//   data-hud-rest           marks the part of a bottom piece that stays when it
//                           is collapsed, like a sheet's head: the piece counts at
//                           that height, so opening the sheet to read does not
//                           move the camera
//
// Status chips come and go, so they declare nothing.

import type { FreeBand } from "../renderer/stageFit";

export interface HudPiece {
  edge: "top" | "bottom";
  /** The piece's extent in viewport pixels; a collapsible piece's top is its collapsed top. */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The band between the lowest top piece and the highest bottom piece, as
 * fractions of the stage height. A bottom piece that does not reach across
 * the stage's middle is a side panel, like the info card on a desktop, and
 * leaves the band alone.
 */
export function freeBand(stage: Box, pieces: readonly HudPiece[]): FreeBand {
  const middle = (stage.left + stage.right) / 2;
  let top = stage.top;
  let bottom = stage.bottom;
  for (const p of pieces) {
    if (p.edge === "top") top = Math.max(top, p.bottom);
    else if (p.left < middle && p.right > middle) bottom = Math.min(bottom, p.top);
  }
  const height = stage.bottom - stage.top;
  return { top: (top - stage.top) / height, bottom: (bottom - stage.top) / height };
}

/** Every element that declares a HUD edge, and the resting parts inside them: what to observe for size changes. */
export function hudElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-hud-edge], [data-hud-rest]"));
}

/** The declared HUD pieces under `root`, measured now. */
export function measureHud(root: ParentNode): HudPiece[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-hud-edge]"), (el) => {
    const r = el.getBoundingClientRect();
    const rest = el.querySelector<HTMLElement>("[data-hud-rest]");
    const borders = el.offsetHeight - el.clientHeight;
    return {
      edge: el.dataset.hudEdge === "top" ? "top" : "bottom",
      top: rest ? r.bottom - rest.offsetHeight - borders : r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
    };
  });
}
