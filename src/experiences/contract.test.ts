// The contract every registered experience keeps (docs/CONTRACT.md): the
// scene is a pure function of (t, filter state). Whatever was drawn before,
// and whichever filters were on before, setTime(t) draws what a fresh mount
// draws at t under the same filters. dispose leaves nothing behind.

import { describe, expect, it } from "vitest";
import { defaultFilterState, toggleFilter } from "../core/filters";
import type { FilterState, FourDExperience } from "../core/types";
import { fakeSceneContext } from "../test/fakeSceneContext";
import { captureShaderUniforms, sceneSnapshot } from "../test/sceneSnapshot";
import { experiences } from "./index";

const SAMPLE_U = [0, 0.13, 0.37, 0.5, 0.81, 1];

function sampleTimes(x: FourDExperience): number[] {
  const times = [...SAMPLE_U.map((u) => x.mapping.toTime(u)), ...x.events.map((e) => e.time)];
  return [...new Set(times)].sort((a, b) => a - b);
}

/** The defaults, then each filter switched away from its default on its own. */
function filterStates(x: FourDExperience): FilterState[] {
  const options = x.filters?.options ?? [];
  const defaults = defaultFilterState(options);
  const switchable = options.filter((f) => !f.group || !f.defaultOn);
  return [defaults, ...switchable.map((f) => toggleFilter(options, defaults, f.id))];
}

/** Mounts the way the shell does: filters first, then a time. `at` reads the scene and every hover card. */
function mount(x: FourDExperience, filters: FilterState) {
  const ctx = fakeSceneContext();
  x.mount(ctx);
  x.filters?.set(filters);
  const uniforms = captureShaderUniforms(ctx);
  const ids = [...new Set(ctx.hoverables.values())];
  return {
    ctx,
    at: (t: number) => {
      x.setTime(t);
      return { scene: sceneSnapshot(ctx, uniforms), hover: ids.map((id) => x.getHoveredObject(id)) };
    },
  };
}

describe.each(experiences)("$name keeps the contract", (entry) => {
  it("draws at t what a fresh mount draws, whatever time and filters came before", async () => {
    const x = await entry.load();
    const times = sampleTimes(x);
    const states = filterStates(x);

    const fresh = states.map((filters) => {
      const m = mount(x, filters);
      const forward = times.map((t) => m.at(t));
      expect(times.toReversed().map(m.at), `scrubbing back under ${JSON.stringify(filters)}`).toEqual(forward.toReversed());
      x.dispose();
      return forward;
    });

    const m = mount(x, states[0]);
    const order = times.map((_, i) => (i % 2 ? times.length - 1 - (i >> 1) : i >> 1));
    expect(order.map((i) => m.at(times[i])), "jumping about").toEqual(order.map((i) => fresh[0][i]));
    for (const [s, filters] of states.entries()) {
      x.filters?.set(filters);
      expect(times.map(m.at), `switched to ${JSON.stringify(filters)}`).toEqual(fresh[s]);
    }
    x.filters?.set(states[0]);
    expect(times.map(m.at), "switched back to the defaults").toEqual(fresh[0]);
    x.dispose();
  });

  it("draws a different scene at each sample time, so the check above is not comparing empty frames", async () => {
    const x = await entry.load();
    const times = sampleTimes(x);
    const m = mount(x, filterStates(x)[0]);
    const drawn = new Set(times.map((t) => JSON.stringify(m.at(t).scene)));
    x.dispose();
    expect(drawn.size).toBe(times.length);
  });

  it("leaves no hoverables and nothing in the scene after dispose", async () => {
    const x = await entry.load();
    const { ctx, at } = mount(x, filterStates(x)[0]);
    at(x.mapping.toTime(0.5));
    expect(ctx.hoverables.size).toBeGreaterThan(0);
    x.dispose();
    expect([ctx.hoverables.size, ctx.scene.children.length, ctx.camera.children.length]).toEqual([0, 0, 0]);
  });
});
