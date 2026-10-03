// src/renderer/pointerGesture.ts
//
// Tells a click from a camera drag on the canvas. OrbitControls fires its
// "start" event on pointerdown, before anything has moved, so it cannot tell
// them apart. A press that travels more than DRAG_PX, or picks up a second
// finger, is a drag; one that comes up within DRAG_PX of where it went down
// is a click.

export const DRAG_PX = 5;

export type Press =
  | { kind: "none" }
  | { kind: "still"; x: number; y: number }
  | { kind: "dragging"; pointers: number };

export interface PressInput {
  type: "down" | "move" | "up" | "cancel";
  x: number;
  y: number;
}

/** "drag" is reported once, when the press turns into a drag. */
export type PressOutcome = "none" | "drag" | "click";

export const NO_PRESS: Press = { kind: "none" };

export function stepPress(press: Press, input: PressInput): { press: Press; outcome: PressOutcome } {
  switch (press.kind) {
    case "none":
      return input.type === "down"
        ? { press: { kind: "still", x: input.x, y: input.y }, outcome: "none" }
        : { press, outcome: "none" };
    case "still": {
      const far = Math.hypot(input.x - press.x, input.y - press.y) > DRAG_PX;
      switch (input.type) {
        case "down":
          return { press: { kind: "dragging", pointers: 2 }, outcome: "drag" };
        case "move":
          return far ? { press: { kind: "dragging", pointers: 1 }, outcome: "drag" } : { press, outcome: "none" };
        case "up":
          return { press: NO_PRESS, outcome: far ? "drag" : "click" };
        case "cancel":
          return { press: NO_PRESS, outcome: "none" };
      }
    }
    case "dragging":
      switch (input.type) {
        case "down":
          return { press: { kind: "dragging", pointers: press.pointers + 1 }, outcome: "none" };
        case "move":
          return { press, outcome: "none" };
        case "up":
        case "cancel":
          return {
            press: press.pointers > 1 ? { kind: "dragging", pointers: press.pointers - 1 } : NO_PRESS,
            outcome: "none",
          };
      }
  }
}
