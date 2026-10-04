import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExperienceId, FilterState, FourDExperience } from "../core/types";
import type { SceneManager } from "../renderer/SceneManager";
import { fakeExperience } from "../test/fakeExperience";
import { installFakeWindow, type FakeWindow } from "../test/fakeWindow";

/** Each experience's chunk download, settled by the test. */
const chunks = new Map<ExperienceId, { resolve(e: FourDExperience): void; reject(error: Error): void }>();

vi.mock("../experiences/index", () => ({
  loadExperience: (id: ExperienceId) =>
    new Promise<FourDExperience>((resolve, reject) => chunks.set(id, { resolve, reject })),
}));

type Runtime = typeof import("./runtime");
type Tour = typeof import("./tour/tourRunner");

/** SceneManager's mount contract without WebGL: attach the controller, and on a throw leave nothing mounted. */
function fakeManager(rt: Runtime) {
  const mounted: ExperienceId[] = [];
  let current: FourDExperience | null = null;
  const manager = {
    get current() {
      return current;
    },
    mount(experience: FourDExperience, filters: FilterState) {
      current = null;
      experience.mount({} as never);
      experience.filters?.set(filters);
      rt.controller.attach(experience);
      current = experience;
      mounted.push(experience.id);
    },
    setFilters() {},
  };
  rt.runtime.manager = manager as unknown as SceneManager;
  return { mounted };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

let win: FakeWindow;
let rt: Runtime;
let tour: Tour;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  chunks.clear();
  win = installFakeWindow("https://example.test/4sight/?x=iphone");
  rt = await import("./runtime");
  tour = await import("./tour/tourRunner");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("showExperience", () => {
  it("ends on the last pick when picks overlap, whichever chunk lands first", async () => {
    const { mounted } = fakeManager(rt);
    void rt.showExperience("iphone");
    void rt.showExperience("solarSystem", 0.4);
    expect(rt.getUi().load).toEqual({ status: "loading", id: "solarSystem", u: 0.4 });

    chunks.get("iphone")!.resolve(fakeExperience("iphone"));
    await flush();
    expect(mounted).toEqual([]);

    chunks.get("solarSystem")!.resolve(fakeExperience("solarSystem"));
    await flush();
    expect(mounted).toEqual(["solarSystem"]);
    expect([rt.getUi().experience?.id, rt.getUi().load, rt.controller.state.param]).toEqual([
      "solarSystem",
      { status: "ready" },
      0.4,
    ]);
  });

  it("reloads the page at the asked-for moment when a failed chunk is asked for again", async () => {
    fakeManager(rt);
    void rt.showExperience("solarSystem", 0.4);
    chunks.get("solarSystem")!.reject(new Error("Failed to fetch"));
    await flush();
    expect(rt.getUi().load).toEqual({ status: "failed", id: "solarSystem", u: 0.4, stage: "chunk", message: "Failed to fetch" });

    chunks.clear();
    await rt.showExperience("solarSystem", 0.4);
    expect(win.reloaded).toEqual(["https://example.test/4sight/?x=solarSystem&u=0.4"]);
    expect(chunks.size).toBe(0);
  });

  it("leaves nothing mounted after a mount throws, and mounts again on retry without a reload", async () => {
    const { mounted } = fakeManager(rt);
    let fail = true;
    const solar = fakeExperience("solarSystem", {
      mount: () => {
        if (fail) throw new Error("No WebGL2");
      },
    });
    void rt.showExperience("solarSystem", 0.4);
    chunks.get("solarSystem")!.resolve(solar);
    await flush();
    expect([rt.getUi().experience, rt.getUi().load]).toEqual([
      null,
      { status: "failed", id: "solarSystem", u: 0.4, stage: "mount", message: "No WebGL2" },
    ]);

    fail = false;
    void rt.showExperience("solarSystem", 0.4);
    chunks.get("solarSystem")!.resolve(solar);
    await flush();
    expect(win.reloaded).toEqual([]);
    expect(mounted).toEqual(["solarSystem"]);
    expect([rt.getUi().experience?.id, rt.controller.state.param]).toEqual(["solarSystem", 0.4]);
  });

  it("refuses in development to mount an experience whose filter group has two defaults", async () => {
    const { mounted } = fakeManager(rt);
    const broken = fakeExperience("iphone", {
      filters: {
        options: [
          { id: "a", name: "A", group: "colour", defaultOn: true },
          { id: "b", name: "B", group: "colour", defaultOn: true },
        ],
        set() {},
      },
    });
    void rt.showExperience("iphone");
    chunks.get("iphone")!.resolve(broken);
    await flush();
    expect(mounted).toEqual([]);
    expect(rt.getUi().load).toMatchObject({
      status: "failed",
      stage: "mount",
      message: 'Filter group "colour" has 2 options on by default, not 1.',
    });
  });
});

describe("guided tour takeover", () => {
  async function startTour() {
    fakeManager(rt);
    void rt.showExperience("iphone");
    chunks.get("iphone")!.resolve(fakeExperience("iphone"));
    await flush();
    tour.dispatchTour({ type: "start" });
  }

  it("keeps running through its own moves: the hold on event 0 and the 4 s glide to event 1", async () => {
    await startTour();
    expect(rt.getUi().tour).toEqual({ phase: "reading", index: 0 });
    tour.dispatchTour({ type: "next" });
    expect(rt.getUi().tour).toEqual({ phase: "travelling", index: 1 });
    // The 4 s glide starts on the first frame, 16 ms in; halfway through it eases to half of u = 0.5.
    await vi.advanceTimersByTimeAsync(2016);
    expect([rt.getUi().tour, rt.controller.state.param]).toEqual([{ phase: "travelling", index: 1 }, 0.25]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(rt.getUi().tour).toEqual({ phase: "reading", index: 1 });
    expect(rt.controller.state.param).toBe(0.5);
  });

  it("ends when the viewer moves time, but not when they flip direction", async () => {
    await startTour();
    rt.controller.reverse();
    expect(rt.getUi().tour.phase).toBe("reading");
    rt.controller.setParam(0.3);
    expect(rt.getUi().tour.phase).toBe("idle");
  });
});
