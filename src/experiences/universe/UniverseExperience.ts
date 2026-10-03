// src/experiences/universe/UniverseExperience.ts
//
// From the Big Bang to today. The observable universe is drawn as a ball
// centred on us, like a night-sky globe on a picture-book page: a burst at
// time zero, a glowing plasma fog that ripples and then clears into the
// cosmic microwave background, a dark haze that gathers into the cosmic web,
// the first stars, and galaxies popping in along the threads. A pin marks
// where the Milky Way forms, and later the Sun.

import * as THREE from "three";
import { knotMapping } from "../../core/mappings";
import { THEME, addOutline, addWarmLights, disposeObject } from "../../core/theme";
import { eventAt } from "../../core/Timeline";
import type {
  CameraPreset,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import { buildCosmicWeb, mulberry32, type CosmicWeb, type Vec3 } from "./cosmicWeb";
import { UniverseField } from "./UniverseField";
import { EVENTS, KNOTS, TODAY, formatCosmicTime } from "./universeData";
import { hoverInfo, type HoverId } from "./universeHover";
import { cameraScale, universeStateAt, type UniverseState } from "./UniverseState";
import { burstTexture, expansionTexture, galaxyAtlas, milkyWayTexture, pinTexture, sparkleTexture, sunTexture } from "./universeTextures";

const CAMERA_PRESETS: CameraPreset[] = [
  { id: "wide", name: "Wide", position: [20.1, 9.6, 32.7], target: [0, -1.8, 0] },
  { id: "inside-web", name: "Inside the web", position: [-2.2, 1.4, 4.2], target: [3.2, 0.6, 1.4] },
  { id: "galaxy", name: "Galaxy close-up", position: [1.2, 0.8, 2.4], target: [0, -0.15, 0] },
];

const NIGHT_DARK = new THREE.Color("#171A30");
const NIGHT = new THREE.Color("#222B52");
const WHOOSH_HOT = new THREE.Color(THEME.mustard);
const WHOOSH_COOL = new THREE.Color(THEME.cream);

interface Proxy {
  id: HoverId;
  /** Shown (and so hoverable) only while this returns true. */
  active: (s: UniverseState) => boolean;
  group: THREE.Group;
  mesh: THREE.Mesh;
  /** Unit-ball position and size, both scaled by the radius. */
  home: Vec3;
  size: number;
}

class UniverseExperience implements FourDExperience {
  id = "universe" as const;
  name = "Universe";

  minTime = 0;
  maxTime = TODAY;
  mapping = knotMapping(KNOTS, formatCosmicTime);
  baseDurationSeconds = 60;
  warpPresets = [0.25, 0.5, 1, 2, 4];
  labels = { start: "Big Bang", end: "Today" };
  events: TimelineEvent[] = EVENTS;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private lights: THREE.Group | null = null;
  private web: CosmicWeb | null = null;
  private field: UniverseField | null = null;
  private wash: THREE.Mesh | null = null;
  private burst: THREE.Sprite | null = null;
  private whoosh: THREE.Sprite | null = null;
  private starGroup: THREE.Group | null = null;
  private stars: { sprite: THREE.Sprite; home: Vec3; size: number; delay: number }[] = [];
  private milkyWay: THREE.Sprite | null = null;
  private pin: THREE.Sprite | null = null;
  private sun: THREE.Sprite | null = null;
  private proxies: Proxy[] = [];
  private hoverables: THREE.Object3D[] = [];
  private disposables: { dispose(): void }[] = [];
  private current: UniverseState = universeStateAt(0);

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    const root = new THREE.Group();
    root.name = "universe";
    this.root = root;
    ctx.scene.add(root);
    this.lights = addWarmLights(ctx.scene);

    const web = buildCosmicWeb();
    this.web = web;

    // The night inside the ball: back faces only, so everything inside draws over it.
    const wash = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(1, 96, 64)),
      this.track(new THREE.MeshBasicMaterial({ color: NIGHT, side: THREE.BackSide, depthWrite: false })),
    );
    wash.renderOrder = -1;
    const outline = addOutline(wash, 0.012);
    outline.renderOrder = -2;
    this.track(outline.material as THREE.Material);
    wash.raycast = () => {};
    root.add(wash);
    this.wash = wash;

    this.field = new UniverseField(web, ctx.renderer.getPixelRatio(), this.track(galaxyAtlas()));
    root.add(this.field.matter, this.field.galaxies, this.field.veil);

    this.whoosh = this.sprite(this.track(expansionTexture()));
    root.add(this.whoosh);

    // Drawn before the veil so the growing plasma ball covers the burst's heart.
    this.burst = this.sprite(this.track(burstTexture()), { depthTest: false });
    root.add(this.burst);

    const sparkle = this.track(sparkleTexture());
    const rand = mulberry32(100);
    // Hiding the group, not the sprites, is what turns their hover off.
    this.starGroup = new THREE.Group();
    root.add(this.starGroup);
    for (const index of web.firstStarKnots) {
      const sprite = this.sprite(sparkle);
      sprite.renderOrder = 4;
      const home = web.knots[index].position;
      this.starGroup.add(sprite);
      this.register(sprite, "first-stars");
      this.stars.push({ sprite, home, size: 0.5 + rand() * 0.35, delay: rand() * 0.5 });
    }

    this.milkyWay = this.sprite(this.track(milkyWayTexture()));
    this.milkyWay.renderOrder = 4;
    root.add(this.milkyWay);

    this.sun = this.sprite(this.track(sunTexture()), { depthTest: false });
    this.sun.center.set(-1.75, 0.5);
    this.sun.renderOrder = 6;
    root.add(this.sun);

    // Constant on screen, so the pin finds the Milky Way from any distance.
    this.pin = this.sprite(this.track(pinTexture()), { depthTest: false, sizeAttenuation: false });
    this.pin.center.set(0.5, 0);
    this.pin.scale.set(0.032, 0.04, 1);
    this.pin.renderOrder = 7;
    root.add(this.pin);

    const sphere = this.track(new THREE.SphereGeometry(1, 16, 12));
    const hidden = this.track(new THREE.MeshBasicMaterial({ visible: false }));
    const filament = web.filaments[web.showcaseFilament];
    const a = web.knots[filament.from].position;
    const b = web.knots[filament.to].position;
    const filamentLength = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const tube = this.track(new THREE.CylinderGeometry(0.035, 0.035, filamentLength * 0.7, 8));
    tube.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(),
      ),
    );
    const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

    this.addProxy("cmb", () => true, sphere, hidden, [0, 0, 0]).mesh.raycast = this.horizonRaycast;
    this.addProxy("cluster", (s) => s.structure > 0.25, sphere, hidden, web.knots[web.cluster].position, 0.09);
    this.addProxy("filament", (s) => s.structure > 0.2, tube, hidden, mid);

    // The Sun sits on the Milky Way sprite at the same depth; registering it
    // first lets it win the tie in the hover raycast.
    this.register(this.sun, "sun");
    this.register(this.milkyWay, "milky-way");
    this.register(this.pin, "milky-way");

    this.setTime(0);
  }

  setTime(time: number): void {
    const s = universeStateAt(time);
    this.current = s;
    if (!this.field || !this.wash || !this.web) return;
    const R = s.radius;

    this.field.update(s);
    this.wash.scale.setScalar(R);
    (this.wash.material as THREE.MeshBasicMaterial).color.copy(NIGHT_DARK).lerp(NIGHT, s.galaxies);

    const burst = this.burst!;
    burst.visible = s.flash > 0.001;
    burst.scale.setScalar(1.6 + 4 * (1 - s.flash));
    burst.material.opacity = Math.min(1, s.flash * 3);
    burst.material.rotation = (1 - s.flash) * 0.6;

    this.starGroup!.visible = s.firstStars > 0.02;
    for (const star of this.stars) {
      const k = Math.min(1, Math.max(0, (s.firstStars - star.delay) / (1 - star.delay)));
      star.sprite.visible = k > 0.001;
      star.sprite.position.set(star.home[0] * R, star.home[1] * R, star.home[2] * R);
      star.sprite.scale.setScalar(star.size * popIn(k));
      (star.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 3);
    }

    const whoosh = this.whoosh!;
    whoosh.visible = s.flash < 0.999;
    whoosh.scale.setScalar(R * 2.5);
    whoosh.material.color.copy(WHOOSH_COOL).lerp(WHOOSH_HOT, s.fog);
    whoosh.material.opacity = 1 - s.flash;

    const mw = this.milkyWay!;
    mw.visible = s.milkyWay > 0.001;
    mw.scale.setScalar(0.35 + 0.75 * s.milkyWay);
    (mw.material as THREE.SpriteMaterial).opacity = Math.min(1, s.milkyWay * 4);
    mw.material.rotation = -0.4 - 1.2 * s.milkyWay;

    this.pin!.visible = s.fog < 0.02;

    const sun = this.sun!;
    sun.visible = s.sun > 0.001;
    sun.scale.setScalar(0.12 * popIn(s.sun));

    for (const proxy of this.proxies) {
      proxy.group.visible = proxy.active(s);
      proxy.mesh.position.set(proxy.home[0] * R, proxy.home[1] * R, proxy.home[2] * R);
      proxy.mesh.scale.setScalar(proxy.size * R);
    }
  }

  getState(time: number): UniverseState {
    return universeStateAt(time);
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    return hoverInfo(id, this.current.time);
  }

  getAvailableFilters(): VisualizationFilter[] {
    return [];
  }

  getCameraPresets(): CameraPreset[] {
    return CAMERA_PRESETS;
  }

  cameraDistanceScale(time: number): number {
    return cameraScale(time);
  }

  reset(): void {
    // setTime rebuilds everything from t; nothing accumulates.
  }

  dispose(): void {
    if (this.ctx) {
      for (const object of this.hoverables) this.ctx.unregisterHoverable(object);
    }
    this.field?.dispose();
    for (const d of this.disposables) d.dispose();
    if (this.root) this.root.removeFromParent();
    if (this.lights) disposeObject(this.lights);
    this.disposables = [];
    this.hoverables = [];
    this.proxies = [];
    this.stars = [];
    this.starGroup = null;
    this.field = null;
    this.web = null;
    this.wash = null;
    this.burst = null;
    this.whoosh = null;
    this.milkyWay = null;
    this.pin = null;
    this.sun = null;
    this.root = null;
    this.lights = null;
    this.ctx = null;
  }

  /**
   * The CMB horizon is the ball's skin. While the fog is opaque the whole
   * ball answers; once it clears only the rim does, so the web, clusters and
   * stars inside stay hoverable.
   */
  private horizonRaycast = (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void => {
    const R = this.current.radius;
    const ray = raycaster.ray;
    const centre = new THREE.Vector3();
    if (this.current.fog > 0.5) {
      const hit = ray.intersectSphere(new THREE.Sphere(centre, R), new THREE.Vector3());
      if (hit) intersects.push({ distance: ray.origin.distanceTo(hit), point: hit, object: this.proxies[0].mesh });
      return;
    }
    if (ray.origin.length() < R) return;
    const closest = ray.closestPointToPoint(centre, new THREE.Vector3());
    const d = closest.length();
    if (d > R * 0.9 && d < R * 1.03) {
      intersects.push({ distance: ray.origin.distanceTo(closest), point: closest, object: this.proxies[0].mesh });
    }
  };

  private addProxy(
    id: HoverId,
    active: (s: UniverseState) => boolean,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    home: Vec3,
    size = 1,
  ): Proxy {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    this.root!.add(group);
    this.register(mesh, id);
    const proxy = { id, active, group, mesh, home, size };
    this.proxies.push(proxy);
    return proxy;
  }

  private register(object: THREE.Object3D, id: HoverId): void {
    this.ctx!.registerHoverable(object, id);
    this.hoverables.push(object);
  }

  private sprite(map: THREE.Texture, options: THREE.SpriteMaterialParameters = {}): THREE.Sprite {
    const material = this.track(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, ...options }));
    return new THREE.Sprite(material);
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }
}

/** 0 to 1 with a little overshoot, like a sticker slapped onto the page. */
function popIn(k: number): number {
  return k * (1 + 0.35 * Math.sin(Math.PI * k) * (1 - k));
}

export const universeExperience: FourDExperience = new UniverseExperience();
