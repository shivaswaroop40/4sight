import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { fakeSceneContext } from "../../test/fakeSceneContext";
import {
  atrialSqueeze,
  BEAT_MS,
  chamberVolume,
  ecg,
  PHASES,
  phaseAt,
  pressure,
  valveIsOpen,
  type PressureSite,
  type ValveId,
} from "./heartCycle";
import { formatMs } from "./heartData";
import { parcelsAt } from "./heartFlow";
import { deform } from "./heartLayout";
import { heartExperience as heart } from "./HeartExperience";

const VALVES: ValveId[] = ["tricuspid", "mitral", "pulmonary", "aortic"];
const openValves = (t: number) => VALVES.filter((v) => valveIsOpen(v, t));

/** Upstream and downstream of each valve. */
const ACROSS: Record<ValveId, [PressureSite, PressureSite]> = {
  tricuspid: ["rightAtrium", "rightVentricle"],
  pulmonary: ["rightVentricle", "pulmonaryArtery"],
  mitral: ["leftAtrium", "leftVentricle"],
  aortic: ["leftVentricle", "aorta"],
};

const EVERY_MS = Array.from({ length: BEAT_MS + 1 }, (_, t) => t);
const isovolumetric = (t: number) => phaseAt(t).id.startsWith("isovolumetric");

/** The ms ranges, as "start-end", on which the predicate holds. */
function spans(holds: (t: number) => boolean): string[] {
  const out: string[] = [];
  let start = -1;
  for (const t of EVERY_MS) {
    if (holds(t) && start < 0) start = t;
    if (!holds(t) && start >= 0) {
      out.push(`${start}-${t - 1}`);
      start = -1;
    }
  }
  if (start >= 0) out.push(`${start}-${BEAT_MS}`);
  return out;
}

function blood(t: number) {
  return (heart.getState(t) as { blood: Record<string, number> }).blood;
}

describe("heartbeat timeline", () => {
  it("runs one 800 ms beat and reads out milliseconds", () => {
    expect(heart.mapping.toTime(0.5)).toBe(400);
    expect(heart.mapping.toParam(210)).toBeCloseTo(0.2625, 9);
    expect(heart.mapping.format(heart.mapping.toTime(0.25))).toBe("200 ms");
    expect(formatMs(79.6)).toBe("80 ms");
  });

  it("keeps events sorted and inside the beat", () => {
    const times = heart.events.map((e) => e.time);
    expect(times).toEqual([0, 50, 90, 160, 210, 260, 380, 540, 620, 720]);
    for (const e of heart.events) {
      expect(e.time).toBeGreaterThanOrEqual(heart.minTime);
      expect(e.time).toBeLessThanOrEqual(heart.maxTime);
    }
  });

  it("names the lub and dub at the valve closures", () => {
    expect(heart.getCurrentEvent(215)!.title).toBe("Lub: inflow valves snap shut");
    expect(heart.getCurrentEvent(545)!.title).toBe("Dub: outflow valves snap shut");
  });

  it("has no one-day clock: a single beat is not a span worth squeezing", () => {
    expect(heart.elapsedSpanSeconds).toBeUndefined();
  });

  it("offers the three camera views", () => {
    expect(heart.getCameraPresets().map((p) => p.name)).toEqual(["Front cutaway", "Side", "Valves"]);
  });
});

describe("heart cycle", () => {
  it("opens and shuts the valves in order", () => {
    expect(openValves(100)).toEqual(["tricuspid", "mitral"]);
    expect(openValves(235)).toEqual([]);
    expect(openValves(400)).toEqual(["pulmonary", "aortic"]);
    expect(openValves(580)).toEqual([]);
    expect(openValves(700)).toEqual(["tricuspid", "mitral"]);
  });

  it("opens each valve once per beat and never inside an isovolumetric phase", () => {
    expect(spans(isovolumetric)).toEqual(["210-259", "540-619"]);
    for (const v of ["tricuspid", "mitral"] as const) expect(spans((t) => valveIsOpen(v, t))).toEqual(["0-207", "623-800"]);
    for (const v of ["pulmonary", "aortic"] as const) expect(spans((t) => valveIsOpen(v, t))).toEqual(["262-536"]);
    for (const t of EVERY_MS) if (isovolumetric(t)) expect(openValves(t), `${t} ms`).toEqual([]);
  });

  it("crosses the pressures where the valves move", () => {
    const above = (a: PressureSite, b: PressureSite) => spans((t) => pressure(a, t) > pressure(b, t));
    expect(above("leftVentricle", "leftAtrium")).toEqual(["211-619"]);
    expect(above("rightVentricle", "rightAtrium")).toEqual(["211-619"]);
    expect(above("leftVentricle", "aorta")).toEqual(["261-539"]);
    expect(above("rightVentricle", "pulmonaryArtery")).toEqual(["261-539"]);
  });

  it("pushes blood downhill through every open valve, and holds it back while all four are shut", () => {
    for (const t of EVERY_MS) {
      for (const v of VALVES) {
        const [up, down] = ACROSS[v];
        if (valveIsOpen(v, t)) expect(pressure(up, t), `${v} at ${t} ms`).toBeGreaterThan(pressure(down, t));
      }
      // Both sides are equal at the instant a valve shuts, which starts the phase.
      if (isovolumetric(t) && t !== phaseAt(t).start) {
        for (const v of VALVES) {
          const [up, down] = ACROSS[v];
          expect(pressure(down, t), `${v} at ${t} ms`).toBeGreaterThan(pressure(up, t));
        }
      }
    }
  });

  it("squeezes the atria through the whole atrialSystole phase and at no other time", () => {
    const atrial = PHASES.find((p) => p.id === "atrialSystole")!;
    expect(spans((t) => atrialSqueeze(t) > 0)).toEqual(["51-209"]);
    for (const t of EVERY_MS) expect(atrialSqueeze(t) > 0, `${t} ms`).toBe(t > atrial.start && t < atrial.end);
  });

  it("fills the left ventricle to 120 mL and pumps out 70 mL", () => {
    expect(chamberVolume("leftVentricle", 230)).toBeCloseTo(120, 6);
    expect(chamberVolume("leftVentricle", 580)).toBeCloseTo(50, 6);
    expect(chamberVolume("rightVentricle", 230)).toBeCloseTo(130, 6);
    expect(chamberVolume("leftVentricle", 800)).toBeCloseTo(chamberVolume("leftVentricle", 0), 9);
  });

  it("draws P, a tall R, and a flat line while the AV node holds the signal", () => {
    expect(ecg(45)).toBeCloseTo(0.15, 2);
    expect(ecg(190)).toBeCloseTo(1.3, 1);
    expect(Math.abs(ecg(125))).toBeLessThan(0.005);
    expect(ecg(470)).toBeCloseTo(0.32, 2);
  });

  it("reports live readouts in the hover cards", () => {
    heart.setTime(580);
    const lv = heart.getHoveredObject("leftVentricle")!.properties!;
    expect(lv["Volume now"]).toBe("50 mL");
    // Live values lead the card.
    expect(Object.keys(lv).slice(0, 2)).toEqual(["Volume now", "Pressure now"]);
    expect(heart.getHoveredObject("aortic")!.properties!["Right now"]).toBe("Shut");
    heart.setTime(400);
    expect(heart.getHoveredObject("aortic")!.properties!["Right now"]).toBe("Open");
  });
});

describe("blood flow", () => {
  const ventricle = (t: number) =>
    parcelsAt(t)
      .filter((p) => p.region === 2)
      .map((p) => `${p.side}${p.index}:${p.position.map((v) => v.toFixed(5)).join(",")}`);

  it("holds the ventricle blood still while all four valves are shut", () => {
    // 120 + 130 mL at 70 / 26 mL per parcel, give or take one parcel per side.
    expect(ventricle(215).length).toBeGreaterThanOrEqual(92);
    expect(ventricle(215).length).toBeLessThanOrEqual(94);
    expect(ventricle(255)).toEqual(ventricle(215));
  });

  it("empties the ventricles into the arteries during ejection", () => {
    const before = blood(255);
    const after = blood(545);
    // 70 mL per side leaves each ventricle, about 26 parcels per side.
    expect(before.ventricle - after.ventricle).toBe(52);
    expect(after.artery).toBeGreaterThan(before.artery);
  });

  it("ends the beat exactly where it started", () => {
    const shape = (t: number) =>
      parcelsAt(t)
        .map((p) => `${p.side}:${p.position.map((v) => v.toFixed(4)).join(",")}`)
        .sort();
    expect(shape(800)).toEqual(shape(0));
  });

  it("moves the valve ring toward the apex as the ventricles squeeze", () => {
    expect(deform(0, 0.2, 0, { baseShift: 0.3, ventSqueeze: 1, atrialSqueeze: 0 })[1]).toBeCloseTo(-0.1, 9);
    expect(deform(0.8, -2.9, 0, { baseShift: 0.3, ventSqueeze: 0, atrialSqueeze: 0 })).toEqual([0.8, -2.9, 0]);
  });
});

describe("ECG strip", () => {
  it("turns to face the camera from its own panel and leaves the scene's render hook alone", () => {
    const ctx = fakeSceneContext();
    heart.mount(ctx);
    expect(ctx.scene.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
    const panel = [...ctx.hoverables].find(([, id]) => id === "ecg")![0] as THREE.Mesh;
    const strip = ctx.scene.getObjectByName("ecg")!;
    ctx.camera.position.set(12.4, 0.1, 14);
    ctx.camera.lookAt(0.25, -1.6, 0);
    expect(strip.quaternion.angleTo(ctx.camera.quaternion)).toBeGreaterThan(0.5);
    panel.onBeforeRender(ctx.renderer, ctx.scene, ctx.camera, panel.geometry, panel.material as THREE.Material, null as never);
    expect(strip.quaternion.angleTo(ctx.camera.quaternion)).toBe(0);
    heart.dispose();
  });

  it("keeps its panel out of frustum culling, since three skips the render hook of a culled object", () => {
    const ctx = fakeSceneContext();
    heart.mount(ctx);
    const panel = [...ctx.hoverables].find(([, id]) => id === "ecg")![0];
    expect(panel.frustumCulled).toBe(false);
    heart.dispose();
  });
});

describe("heart filters", () => {
  it("offers the electrical signal and blood flow, both on", () => {
    expect(heart.filters!.options.map((f) => [f.id, f.name, f.defaultOn])).toEqual([
      ["electrical", "Electrical signal", true],
      ["blood-flow", "Blood flow", true],
    ]);
  });

  it("hides the spark, the nodes and the flow arrows, and shows them again", () => {
    const ctx = fakeSceneContext();
    heart.mount(ctx);
    const shown = () => [ctx.scene.getObjectByName("electrical")!.visible, ctx.scene.getObjectByName("blood-flow")!.visible];
    heart.filters!.set({ electrical: false, "blood-flow": false });
    heart.setTime(150);
    expect(shown()).toEqual([false, false]);
    heart.filters!.set({ electrical: true, "blood-flow": false });
    heart.setTime(150);
    expect(shown()).toEqual([true, false]);
    heart.dispose();
  });

  it("stops the depolarisation front and tint on the muscle when the electrical signal is off", () => {
    const ctx = fakeSceneContext();
    heart.mount(ctx);
    const wall = [...ctx.hoverables].find(([, id]) => id === "heartWall")![0] as THREE.Mesh;
    const shader = {
      uniforms: {} as Record<string, { value: number }>,
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <opaque_fragment>",
    };
    (wall.material as THREE.Material).onBeforeCompile(shader as never, ctx.renderer);
    const wave = () => ["uAtrialSpread", "uAtrialTint", "uVentSpread", "uVentTint"].map((k) => shader.uniforms[k].value);
    heart.setTime(200);
    expect(wave()).toEqual([1, 0.5, 0.5, 1]);
    heart.filters!.set({ electrical: false, "blood-flow": true });
    heart.setTime(200);
    expect(wave()).toEqual([0, 0, 0, 0]);
    heart.dispose();
  });
});
