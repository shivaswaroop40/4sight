import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeController } from "../core/TimeController";
import { fakeExperience } from "../test/fakeExperience";
import { installFakeWindow, type FakeWindow } from "../test/fakeWindow";
import { startUrlSync, type UrlSync } from "./urlSync";

const START = "https://example.test/4sight/?x=iphone";

describe("urlSync", () => {
  let win: FakeWindow;
  let controller: TimeController;
  let held: boolean;
  let sync: UrlSync;

  beforeEach(() => {
    vi.useFakeTimers();
    win = installFakeWindow(START);
    controller = new TimeController();
    controller.attach(fakeExperience("iphone"));
    held = false;
    sync = startUrlSync(controller, () => ({ id: "iphone", u: controller.state.param }), () => held);
  });

  afterEach(() => {
    sync.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("writes the paused moment once, 350 ms after the last change", () => {
    controller.setParam(0.2);
    vi.advanceTimersByTime(200);
    controller.setParam(0.25);
    vi.advanceTimersByTime(149);
    expect(win.replaced).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(win.replaced).toEqual(["https://example.test/4sight/?x=iphone&u=0.25"]);
  });

  it("never writes while playing, and writes where playback paused", () => {
    controller.play();
    for (let i = 0; i < 10; i++) {
      controller.tick(0.1);
      vi.advanceTimersByTime(400);
    }
    expect(win.replaced).toEqual([]);
    controller.pause();
    vi.advanceTimersByTime(350);
    expect(win.replaced).toEqual(["https://example.test/4sight/?x=iphone&u=0.1"]);
  });

  it("drops a write that lands while something holds u, such as an export that started after the pause", () => {
    controller.setParam(0.3);
    held = true;
    vi.advanceTimersByTime(350);
    sync.flush();
    expect(win.replaced).toEqual([]);
    held = false;
    sync.flush();
    expect(win.replaced).toEqual(["https://example.test/4sight/?x=iphone&u=0.3"]);
  });

  it("survives replaceState throwing and writes on the next pause", () => {
    win.failNextReplace();
    controller.setParam(0.4);
    expect(() => vi.advanceTimersByTime(350)).not.toThrow();
    expect(win.location.href).toBe(START);
    controller.setParam(0.5);
    vi.advanceTimersByTime(350);
    expect(win.replaced).toEqual(["https://example.test/4sight/?x=iphone&u=0.5"]);
  });
});
