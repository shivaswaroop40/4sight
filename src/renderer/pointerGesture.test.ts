import { describe, expect, it } from "vitest";
import { NO_PRESS, stepPress, type Press, type PressInput, type PressOutcome } from "./pointerGesture";

function run(inputs: [PressInput["type"], number, number][]): { press: Press; outcomes: PressOutcome[] } {
  let press: Press = NO_PRESS;
  const outcomes: PressOutcome[] = [];
  for (const [type, x, y] of inputs) {
    const step = stepPress(press, { type, x, y });
    press = step.press;
    outcomes.push(step.outcome);
  }
  return { press, outcomes };
}

describe("click vs drag", () => {
  it("reads a press that comes up where it went down as a click", () => {
    expect(run([["down", 100, 100], ["up", 100, 100]])).toEqual({ press: NO_PRESS, outcomes: ["none", "click"] });
  });

  it("allows a 5 px wobble in a click", () => {
    expect(run([["down", 100, 100], ["move", 103, 104], ["up", 103, 104]]).outcomes).toEqual(["none", "none", "click"]);
  });

  it("turns into a drag once the pointer travels past 5 px, and says so once", () => {
    expect(run([["down", 100, 100], ["move", 104, 104], ["move", 140, 100], ["up", 140, 100]])).toEqual({
      press: NO_PRESS,
      outcomes: ["none", "drag", "none", "none"],
    });
  });

  it("reads a press that comes up far away without moves as a drag", () => {
    expect(run([["down", 100, 100], ["up", 120, 100]]).outcomes).toEqual(["none", "drag"]);
  });

  it("treats a second finger as a pinch, and waits for both to lift", () => {
    expect(run([["down", 100, 100], ["down", 200, 200], ["up", 100, 100]])).toEqual({
      press: { kind: "dragging", pointers: 1 },
      outcomes: ["none", "drag", "none"],
    });
    expect(run([["down", 100, 100], ["down", 200, 200], ["up", 100, 100], ["up", 200, 200]]).press).toEqual(NO_PRESS);
  });

  it("ignores hover moves and a cancelled press", () => {
    expect(run([["move", 10, 10], ["up", 10, 10]])).toEqual({ press: NO_PRESS, outcomes: ["none", "none"] });
    expect(run([["down", 100, 100], ["cancel", 100, 100]])).toEqual({ press: NO_PRESS, outcomes: ["none", "none"] });
  });
});
