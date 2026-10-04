// src/experiences/keyframe/parse.ts
//
// The boundary between authored JSON and the engine. parseScene checks every
// field once, fills in defaults, and returns a SceneDef the rest of the
// engine trusts. Errors name the exact path, e.g.
// `objects[3] ("mill-wheel").rotation[1].ease: unknown easing "bounce"`.
//
// Authoring format, per object: each of position, rotation (degrees),
// scale, color, opacity and visible is either one static value or a list
// of keys { t, v, ease? }. Colours are a THEME name or "#RRGGBB". Defaults:
// position 0, rotation 0, scale 1, colour cream, opacity 1, visible true,
// toon shading, outline on (true = 0.03, or a thickness, or false), ease
// "linear".

import type { CameraPreset, TimelineEvent, TimeTick } from "../../core/types";
import { THEME } from "../../core/theme";
import type { SliderKnot } from "../../core/mappings";
import { isEasingName } from "./easing";
import { COMMON_PARAMS, PRIMITIVES, isPrimitiveName } from "./primitives";
import { isTimeFormatName } from "./timeFormats";
import type {
  Between,
  HoverDef,
  HoverText,
  Key,
  MappingSpec,
  Rgb,
  SceneDef,
  SceneObjectDef,
  Shading,
  Track,
  Tracks,
  Vec3,
} from "./types";

export class SceneParseError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "SceneParseError";
  }
}

type Raw = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new SceneParseError(path, message);
}

function obj(v: unknown, path: string): Raw {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(path, "expected an object");
  return v as Raw;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, "expected an array");
  return v;
}

function num(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(path, `expected a number, got ${JSON.stringify(v)}`);
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string") fail(path, `expected a string, got ${JSON.stringify(v)}`);
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") fail(path, `expected true or false, got ${JSON.stringify(v)}`);
  return v;
}

function optional<T>(raw: Raw, key: string, path: string, read: (v: unknown, p: string) => T): T | undefined {
  return raw[key] === undefined ? undefined : read(raw[key], `${path}.${key}`);
}

function vec3(v: unknown, path: string): Vec3 {
  const a = arr(v, path);
  if (a.length !== 3) fail(path, `expected [x, y, z], got ${a.length} numbers`);
  return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`), num(a[2], `${path}[2]`)];
}

function scaleValue(v: unknown, path: string): Vec3 {
  if (typeof v === "number") return [num(v, path), v, v];
  return vec3(v, path);
}

function colorValue(v: unknown, path: string): Rgb {
  const s = str(v, path);
  const hex = Object.hasOwn(THEME, s) ? THEME[s as keyof typeof THEME] : s;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) fail(path, `expected a THEME colour name or "#RRGGBB", got "${s}"`);
  const channel = (i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return [channel(0), channel(1), channel(2)];
}

function isKeyList(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && !Array.isArray(v[0]);
}

/** A static value or a list of keys, as a sorted track. */
function track<V>(v: unknown, fallback: V, path: string, read: (v: unknown, p: string) => V): Track<V> {
  if (v === undefined) return [{ t: 0, v: fallback, ease: "linear" }];
  if (!isKeyList(v)) return [{ t: 0, v: read(v, path), ease: "linear" }];
  const keys: Key<V>[] = v.map((rawKey, i) => {
    const p = `${path}[${i}]`;
    const k = obj(rawKey, p);
    const ease = k.ease === undefined ? "linear" : str(k.ease, `${p}.ease`);
    if (!isEasingName(ease)) fail(`${p}.ease`, `unknown easing "${ease}"`);
    return { t: num(k.t, `${p}.t`), v: read(k.v, `${p}.v`), ease };
  });
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].t <= keys[i - 1].t) fail(`${path}[${i}].t`, `keys must be in increasing time order (${keys[i].t} after ${keys[i - 1].t})`);
  }
  return keys;
}

function mappingSpec(v: unknown, minTime: number, maxTime: number, path: string): MappingSpec {
  const m = obj(v, path);
  const kind = str(m.kind, `${path}.kind`);
  if (kind === "linear") {
    const ticks = optional(m, "ticks", path, (t, p) =>
      arr(t, p).map((raw, i): TimeTick => {
        const tick = obj(raw, `${p}[${i}]`);
        return { u: num(tick.u, `${p}[${i}].u`), label: str(tick.label, `${p}[${i}].label`) };
      }),
    );
    return ticks ? { kind, ticks } : { kind };
  }
  if (kind === "knots") {
    const knots = arr(m.knots, `${path}.knots`).map((raw, i): SliderKnot => {
      const p = `${path}.knots[${i}]`;
      const k = obj(raw, p);
      return { u: num(k.u, `${p}.u`), time: num(k.time, `${p}.time`), label: str(k.label, `${p}.label`) };
    });
    if (knots.length < 2) fail(`${path}.knots`, "needs at least two knots");
    const first = knots[0];
    const last = knots[knots.length - 1];
    if (first.u !== 0 || last.u !== 1) fail(`${path}.knots`, "must run from u = 0 to u = 1");
    if (first.time !== minTime || last.time !== maxTime) fail(`${path}.knots`, "must run from minTime to maxTime");
    for (let i = 1; i < knots.length; i++) {
      if (knots[i].u <= knots[i - 1].u || knots[i].time <= knots[i - 1].time) {
        fail(`${path}.knots[${i}]`, "u and time must both increase");
      }
    }
    const interpolate = optional(m, "interpolate", path, str) ?? "log";
    if (interpolate !== "log" && interpolate !== "linear") {
      fail(`${path}.interpolate`, `expected "log" or "linear", got "${interpolate}"`);
    }
    return { kind, knots, interpolate };
  }
  return fail(`${path}.kind`, `unknown mapping "${kind}" (expected "linear" or "knots")`);
}

function events(v: unknown, minTime: number, maxTime: number, path: string): TimelineEvent[] {
  const list = arr(v, path).map((raw, i): TimelineEvent => {
    const p = `${path}[${i}]`;
    const e = obj(raw, p);
    const time = num(e.time, `${p}.time`);
    if (time < minTime || time > maxTime) fail(`${p}.time`, `${time} is outside [${minTime}, ${maxTime}]`);
    const event: TimelineEvent = {
      id: str(e.id, `${p}.id`),
      time,
      title: str(e.title, `${p}.title`),
      when: str(e.when, `${p}.when`),
      description: str(e.description, `${p}.description`),
      keyPoints: arr(e.keyPoints, `${p}.keyPoints`).map((k, j) => str(k, `${p}.keyPoints[${j}]`)),
    };
    const category = optional(e, "category", p, str);
    return category === undefined ? event : { ...event, category };
  });
  for (let i = 1; i < list.length; i++) {
    if (list[i].time < list[i - 1].time) fail(`${path}[${i}].time`, "events must be sorted by time");
  }
  return list;
}

function cameraPresets(v: unknown, path: string): CameraPreset[] {
  return arr(v, path).map((raw, i) => {
    const p = `${path}[${i}]`;
    const c = obj(raw, p);
    return {
      id: str(c.id, `${p}.id`),
      name: str(c.name, `${p}.name`),
      position: vec3(c.position, `${p}.position`),
      target: vec3(c.target, `${p}.target`),
    };
  });
}

function properties(v: unknown, path: string): Record<string, string | number> {
  const raw = obj(v, path);
  const out: Record<string, string | number> = {};
  for (const [k, value] of Object.entries(raw)) {
    out[k] = typeof value === "number" ? value : str(value, `${path}.${k}`);
  }
  return out;
}

function hoverDef(v: unknown, path: string): HoverDef {
  const h = obj(v, path);
  let descriptions: HoverText[];
  if (h.descriptions !== undefined) {
    descriptions = arr(h.descriptions, `${path}.descriptions`).map((raw, i) => {
      const p = `${path}.descriptions[${i}]`;
      const d = obj(raw, p);
      return { from: num(d.from, `${p}.from`), text: str(d.text, `${p}.text`) };
    });
    if (descriptions.length === 0) fail(`${path}.descriptions`, "needs at least one entry");
    for (let i = 1; i < descriptions.length; i++) {
      if (descriptions[i].from <= descriptions[i - 1].from) fail(`${path}.descriptions[${i}].from`, "must increase");
    }
  } else {
    descriptions = [{ from: -Infinity, text: str(h.description, `${path}.description`) }];
  }
  const def: HoverDef = { name: str(h.name, `${path}.name`), descriptions };
  const category = optional(h, "category", path, str);
  if (category !== undefined) def.category = category;
  const props = optional(h, "properties", path, properties);
  if (props !== undefined) def.properties = props;
  return def;
}

const OBJECT_KEYS = new Set([
  "id", "parent", "primitive", "params", "shading", "outline", "renderOrder", "hover", "between",
  "position", "rotation", "scale", "color", "opacity", "visible",
]);

function sceneObject(
  v: unknown,
  path: string,
  seen: Map<string, SceneObjectDef>,
  hover: Record<string, HoverDef>,
): SceneObjectDef {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`);
  const at = `${path} ("${id}")`;
  if (seen.has(id)) fail(`${at}.id`, "duplicate object id");
  for (const key of Object.keys(o)) {
    if (!OBJECT_KEYS.has(key)) fail(`${at}.${key}`, "unknown field");
  }

  const parent = optional(o, "parent", at, str) ?? null;
  if (parent !== null && !seen.has(parent)) fail(`${at}.parent`, `"${parent}" must be defined earlier in the list`);

  const primitive = str(o.primitive, `${at}.primitive`);
  if (!isPrimitiveName(primitive)) {
    fail(`${at}.primitive`, `unknown primitive "${primitive}" (one of ${Object.keys(PRIMITIVES).join(", ")})`);
  }
  const defaults: Record<string, number> = { ...COMMON_PARAMS, ...PRIMITIVES[primitive].params };
  const params = { ...defaults };
  if (o.params !== undefined) {
    for (const [k, value] of Object.entries(obj(o.params, `${at}.params`))) {
      if (!Object.hasOwn(defaults, k)) fail(`${at}.params.${k}`, `"${primitive}" has no parameter "${k}"`);
      params[k] = num(value, `${at}.params.${k}`);
    }
  }

  const shading = (optional(o, "shading", at, str) ?? "toon") as Shading;
  if (shading !== "toon" && shading !== "flat") fail(`${at}.shading`, `expected "toon" or "flat", got "${shading}"`);

  const rawOutline = o.outline ?? primitive !== "group";
  const outline = typeof rawOutline === "boolean" ? (rawOutline ? 0.03 : 0) : num(rawOutline, `${at}.outline`);

  const hoverId = optional(o, "hover", at, str) ?? null;
  if (hoverId !== null && !Object.hasOwn(hover, hoverId)) fail(`${at}.hover`, `no hover entry "${hoverId}"`);

  let between: Between | null = null;
  if (o.between !== undefined) {
    const b = obj(o.between, `${at}.between`);
    between = {
      from: str(b.from, `${at}.between.from`),
      to: str(b.to, `${at}.between.to`),
      fromOffset: b.fromOffset === undefined ? [0, 0, 0] : vec3(b.fromOffset, `${at}.between.fromOffset`),
      toOffset: b.toOffset === undefined ? [0, 0, 0] : vec3(b.toOffset, `${at}.between.toOffset`),
    };
    for (const end of ["from", "to"] as const) {
      const other = seen.get(between[end]);
      if (!other) fail(`${at}.between.${end}`, `"${between[end]}" must be defined earlier in the list`);
      if (other.parent !== parent) fail(`${at}.between.${end}`, `"${between[end]}" must share this object's parent`);
    }
  }

  const tracks: Tracks = {
    position: track(o.position, [0, 0, 0] as Vec3, `${at}.position`, vec3),
    rotation: track(o.rotation, [0, 0, 0] as Vec3, `${at}.rotation`, vec3),
    scale: track(o.scale, [1, 1, 1] as Vec3, `${at}.scale`, scaleValue),
    color: track(o.color, colorValue(THEME.cream, "default"), `${at}.color`, colorValue),
    opacity: track(o.opacity, 1, `${at}.opacity`, (x, p) => {
      const n = num(x, p);
      if (n < 0 || n > 1) fail(p, `opacity must be in [0, 1], got ${n}`);
      return n;
    }),
    visible: track(o.visible, true, `${at}.visible`, bool),
  };

  return {
    id,
    parent,
    primitive,
    params,
    shading,
    outline,
    renderOrder: optional(o, "renderOrder", at, num) ?? 0,
    hover: hoverId,
    between,
    transparent: tracks.opacity.some((k) => k.v < 1),
    tracks,
  };
}

/** Parses authored scene JSON. Throws SceneParseError naming the first bad field. */
export function parseScene(json: unknown): SceneDef {
  const root = obj(json, "scene");
  const minTime = num(root.minTime, "minTime");
  const maxTime = num(root.maxTime, "maxTime");
  if (maxTime <= minTime) fail("maxTime", `must be greater than minTime (${minTime})`);

  const timeFormat = str(root.timeFormat, "timeFormat");
  if (!isTimeFormatName(timeFormat)) fail("timeFormat", `unknown time format "${timeFormat}"`);

  const secondsPerUnit = root.secondsPerUnit === undefined ? undefined : num(root.secondsPerUnit, "secondsPerUnit");
  if (secondsPerUnit !== undefined && secondsPerUnit <= 0) fail("secondsPerUnit", "must be greater than 0");

  const labelsRaw = obj(root.labels, "labels");
  const hover: Record<string, HoverDef> = {};
  if (root.hover !== undefined) {
    for (const [id, raw] of Object.entries(obj(root.hover, "hover"))) hover[id] = hoverDef(raw, `hover.${id}`);
  }

  const seen = new Map<string, SceneObjectDef>();
  const objects = arr(root.objects, "objects").map((raw, i) => {
    const def = sceneObject(raw, `objects[${i}]`, seen, hover);
    seen.set(def.id, def);
    return def;
  });

  return {
    id: str(root.id, "id"),
    name: str(root.name, "name"),
    minTime,
    maxTime,
    mapping: mappingSpec(root.mapping, minTime, maxTime, "mapping"),
    timeFormat,
    secondsPerUnit,
    labels: { start: str(labelsRaw.start, "labels.start"), end: str(labelsRaw.end, "labels.end") },
    baseDurationSeconds: num(root.baseDurationSeconds, "baseDurationSeconds"),
    warpPresets: arr(root.warpPresets, "warpPresets").map((w, i) => num(w, `warpPresets[${i}]`)),
    events: events(root.events, minTime, maxTime, "events"),
    cameraPresets: cameraPresets(root.cameraPresets, "cameraPresets"),
    cameraDistanceScale:
      root.cameraDistanceScale === undefined ? [] : track(root.cameraDistanceScale, 1, "cameraDistanceScale", num),
    cameraSubjectAspect:
      root.cameraSubjectAspect === undefined
        ? []
        : track(root.cameraSubjectAspect, 1, "cameraSubjectAspect", (x, p) => {
            const n = num(x, p);
            if (n <= 0) fail(p, "must be greater than 0");
            return n;
          }),
    hover,
    objects,
  };
}
