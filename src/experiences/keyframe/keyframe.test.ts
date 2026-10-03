import { describe, expect, it } from "vitest";
import { EASINGS } from "./easing";
import { keyframeExperience } from "./KeyframeExperience";
import { SceneParseError, parseScene } from "./parse";
import { sampleScene } from "./sample";

function scene(overrides: Record<string, unknown> = {}) {
  return {
    id: "mock",
    name: "Test scene",
    minTime: 0,
    maxTime: 10,
    mapping: { kind: "linear" },
    timeFormat: "minutes",
    labels: { start: "Start", end: "End" },
    baseDurationSeconds: 10,
    warpPresets: [1, 2],
    events: [
      { id: "a", time: 0, title: "A", when: "0 min", description: "", keyPoints: [] },
      { id: "b", time: 5, title: "B", when: "5 min", description: "", keyPoints: [] },
    ],
    cameraPresets: [{ id: "front", name: "Front", position: [0, 0, 10], target: [0, 0, 0] }],
    hover: {
      ball: {
        name: "Ball",
        descriptions: [
          { from: 0, text: "Resting." },
          { from: 4, text: "Rolling." },
        ],
      },
    },
    objects: [
      {
        id: "ball",
        primitive: "sphere",
        hover: "ball",
        color: [
          { t: 0, v: "#000000" },
          { t: 10, v: "#ffffff" },
        ],
        position: [
          { t: 2, v: [0, 0, 0] },
          { t: 4, v: [4, 0, 0] },
          { t: 8, v: [4, 2, 0], ease: "easeInOut" },
        ],
        visible: [
          { t: 0, v: true },
          { t: 6, v: false },
        ],
      },
      { id: "lamp", primitive: "group", parent: "ball", position: [0, 1, 0], scale: 2 },
      {
        id: "sign",
        primitive: "box",
        scale: [
          { t: 0, v: 1 },
          { t: 5, v: 3, ease: "step" },
        ],
        opacity: [
          { t: 0, v: 0 },
          { t: 10, v: 0.5 },
        ],
      },
      { id: "anchor-a", primitive: "group", position: [0, 0, 0] },
      { id: "anchor-b", primitive: "group", position: [3, 4, 0] },
      {
        id: "rope",
        primitive: "cylinder",
        params: { radiusTop: 0.05, radiusBottom: 0.05 },
        between: { from: "anchor-a", to: "anchor-b" },
        scale: [
          { t: 0, v: [1, 0.5, 1] },
          { t: 10, v: [1, 1, 1] },
        ],
      },
    ],
    ...overrides,
  };
}

const def = parseScene(scene());
const pose = (t: number, id: string) => sampleScene(def, t).objects.find((o) => o.id === id)!;

describe("easing table", () => {
  it("pins both ends of every curve", () => {
    for (const ease of Object.values(EASINGS)) {
      expect(ease(0)).toBeCloseTo(0, 9);
      expect(ease(1)).toBeCloseTo(1, 9);
    }
  });

  it("shapes the middle as named", () => {
    expect(EASINGS.linear(0.25)).toBe(0.25);
    expect(EASINGS.easeInOut(0.5)).toBe(0.5);
    expect(EASINGS.easeIn(0.5)).toBe(0.125);
    expect(EASINGS.backOut(0.7)).toBeGreaterThan(1);
  });
});

describe("sampleScene", () => {
  it("holds the first key before it and the last key after it", () => {
    expect(pose(0, "ball").position).toEqual([0, 0, 0]);
    expect(pose(10, "ball").position).toEqual([4, 2, 0]);
  });

  it("interpolates linearly by default", () => {
    expect(pose(3, "ball").position).toEqual([2, 0, 0]);
  });

  it("applies the arriving key's easing", () => {
    expect(pose(6, "ball").position).toEqual([4, 1, 0]);
    expect(pose(5, "ball").position[1]).toBeCloseTo(2 * EASINGS.easeInOut(0.25), 9);
  });

  it("holds a step track until the key, then jumps", () => {
    expect(pose(4.99, "sign").scale).toEqual([1, 1, 1]);
    expect(pose(5, "sign").scale).toEqual([3, 3, 3]);
  });

  it("blends colours in sRGB", () => {
    expect(pose(5, "ball").color).toEqual([0.5, 0.5, 0.5]);
  });

  it("treats visible as a step and hides fully faded objects", () => {
    expect(pose(5.9, "ball").visible).toBe(true);
    expect(pose(6, "ball").visible).toBe(false);
    expect(pose(0, "sign").visible).toBe(false);
    expect(pose(10, "sign").opacity).toBe(0.5);
  });

  it("keeps child transforms local to the parent", () => {
    expect(pose(10, "lamp").position).toEqual([0, 1, 0]);
    expect(pose(10, "lamp").scale).toEqual([2, 2, 2]);
  });

  it("stretches a between object from its anchor toward the other", () => {
    const half = pose(0, "rope");
    expect(half.scale[1]).toBeCloseTo(2.5, 9);
    half.position.forEach((v, i) => expect(v).toBeCloseTo([0.75, 1, 0][i], 9));
    const full = pose(10, "rope");
    expect(full.scale[1]).toBeCloseTo(5, 9);
    expect(full.rotation[2]).toBeCloseTo(-36.8699, 3);
  });

  it("clamps time to the scene range", () => {
    expect(sampleScene(def, -5).time).toBe(0);
    expect(sampleScene(def, 50).time).toBe(10);
  });
});

describe("keyframeExperience", () => {
  const exp = keyframeExperience("mock", scene());

  it("reads metadata from the definition", () => {
    expect(exp.name).toBe("Test scene");
    expect(exp.mapping.format(75)).toBe("1 h 15 min");
    expect(exp.getCameraPresets().map((p) => p.name)).toEqual(["Front"]);
    expect(exp.getCurrentEvent(7)?.id).toBe("b");
    expect(exp.cameraDistanceScale(3)).toBe(1);
  });

  it("changes hover text with time", () => {
    exp.setTime(1);
    expect(exp.getHoveredObject("ball")?.description).toBe("Resting.");
    exp.setTime(4);
    expect(exp.getHoveredObject("ball")?.description).toBe("Rolling.");
    expect(exp.getHoveredObject("nope")).toBeNull();
  });

  it("is a pure function of time", () => {
    const a = exp.getState(6.3);
    exp.getState(2);
    expect(exp.getState(6.3)).toEqual(a);
  });

  it("refuses a scene whose id does not match", () => {
    expect(() => keyframeExperience("iphone", scene())).toThrow('scene id "mock" does not match experience id "iphone"');
  });
});

describe("parseScene validation", () => {
  const bad = (overrides: Record<string, unknown>) => () => parseScene(scene(overrides));
  const withObject = (o: Record<string, unknown>) => bad({ objects: [o] });

  it("names an unknown primitive", () => {
    expect(withObject({ id: "x", primitive: "teapot" })).toThrow(
      /objects\[0\] \("x"\)\.primitive: unknown primitive "teapot" \(one of group, sphere, box/,
    );
  });

  it("names an unknown geometry parameter", () => {
    expect(withObject({ id: "x", primitive: "sphere", params: { width: 2 } })).toThrow(
      'objects[0] ("x").params.width: "sphere" has no parameter "width"',
    );
  });

  it("names an unknown easing", () => {
    expect(withObject({ id: "x", primitive: "box", opacity: [{ t: 0, v: 1 }, { t: 1, v: 0, ease: "bounce" }] })).toThrow(
      'objects[0] ("x").opacity[1].ease: unknown easing "bounce"',
    );
  });

  it("rejects keys out of order", () => {
    expect(withObject({ id: "x", primitive: "box", position: [{ t: 2, v: [0, 0, 0] }, { t: 1, v: [1, 0, 0] }] })).toThrow(
      "keys must be in increasing time order",
    );
  });

  it("rejects bad colours, values and unknown fields", () => {
    expect(withObject({ id: "x", primitive: "box", color: "blue" })).toThrow('got "blue"');
    expect(withObject({ id: "x", primitive: "box", position: [1, 2] })).toThrow("expected [x, y, z], got 2 numbers");
    expect(withObject({ id: "x", primitive: "box", colour: "ink" })).toThrow('objects[0] ("x").colour: unknown field');
    expect(withObject({ id: "x", primitive: "box", opacity: 2 })).toThrow("opacity must be in [0, 1], got 2");
  });

  it("requires parents and between anchors to come first", () => {
    expect(withObject({ id: "x", primitive: "box", parent: "later" })).toThrow('"later" must be defined earlier');
    expect(withObject({ id: "x", primitive: "box", between: { from: "x", to: "y" } })).toThrow('"x" must be defined earlier');
  });

  it("rejects duplicate ids and missing hover entries", () => {
    expect(bad({ objects: [{ id: "x", primitive: "box" }, { id: "x", primitive: "box" }] })).toThrow("duplicate object id");
    expect(withObject({ id: "x", primitive: "box", hover: "ghost" })).toThrow('no hover entry "ghost"');
  });

  it("rejects unsorted or out-of-range events and bad mappings", () => {
    expect(bad({ events: [{ id: "a", time: 11, title: "", when: "", description: "", keyPoints: [] }] })).toThrow(
      "events[0].time: 11 is outside [0, 10]",
    );
    expect(bad({ mapping: { kind: "spiral" } })).toThrow('unknown mapping "spiral"');
    expect(bad({ mapping: { kind: "knots", knots: [{ u: 0, time: 0, label: "" }, { u: 1, time: 9, label: "" }] } })).toThrow(
      "must run from minTime to maxTime",
    );
    expect(bad({ timeFormat: "fortnights" })).toThrow('unknown time format "fortnights"');
  });

  it("throws SceneParseError", () => {
    expect(withObject({ id: "x", primitive: "nope" })).toThrow(SceneParseError);
  });
});
