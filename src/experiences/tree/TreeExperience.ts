// src/experiences/tree/TreeExperience.ts
//
// An English oak from a jay's buried acorn to a 150-year-old veteran on a
// floating hill. The skeleton is generated once at full size; setTime only
// writes instance matrices, colours and visibility from the pure pose
// functions, so scrubbing back regrows nothing: it just reads the tree at t.
// The whole world slides down as the tree grows (viewCenter) so the camera
// presets, which all look at the origin, keep the tree framed while
// cameraDistanceScale pulls the camera back.

import * as THREE from "three";
import { smoothstep } from "../../core/interpolate";
import { THEME, addWarmLights, disposeObject, makeToonMaterial } from "../../core/theme";
import { eventAt } from "../../core/Timeline";
import type {
  CameraPreset,
  FourDExperience,
  ObjectMetadata,
  SceneContext,
  TimelineEvent,
  VisualizationFilter,
} from "../../core/types";
import { EVENTS, hoverInfo } from "./treeData";
import { ISLAND_RADIUS, buildGrass, buildIsland, buildLitter, groundY, inNotch } from "./treeIsland";
import {
  PALETTE,
  blobGeometry,
  instancedOutline,
  leafInkGeometry,
  oakLeafGeometry,
  taperedCylinder,
  taperedToonMaterial,
} from "./treeMaterials";
import { STORY, cameraScale, foliageAt, frameSize, mapping, seasonPhase, viewCenter } from "./treeModel";
import { clumpPose, leafy, segmentPose, standing } from "./treePose";
import { buildProps, type Prop } from "./treeProps";
import { SKELETON, axisLength, pointAlong, type Segment } from "./treeSkeleton";
import { acornsAt, treeStateAt, type TreeState } from "./treeState";

const CAMERA_PRESETS: CameraPreset[] = [
  { id: "three-quarter", name: "Three-quarter", position: [36, 18, 36], target: [0, 0, 0] },
  { id: "rings", name: "Trunk and rings", position: [21, -1.8, 3], target: [0, 0, 0] },
  { id: "below", name: "Below the canopy", position: [4.4, -5.1, 1.9], target: [0, 0, 0] },
];

interface BranchSet {
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
  /** A sphere at each segment's base, rounding off bends. */
  joints: THREE.InstancedMesh;
  jointOutline: THREE.InstancedMesh;
  segments: Segment[];
  quaternions: THREE.Quaternion[];
  taper: THREE.InstancedBufferAttribute;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpC = new THREE.Color();
const tmpE = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

const C = {
  spring: new THREE.Color(PALETTE.leafSpring),
  summer: new THREE.Color(PALETTE.leafSummer),
  summerDeep: new THREE.Color(PALETTE.leafSummerDeep),
  autumn: new THREE.Color(PALETTE.leafAutumn),
  autumnLate: new THREE.Color(PALETTE.leafAutumnLate),
  dead: new THREE.Color(PALETTE.leafDead),
  acornGreen: new THREE.Color(PALETTE.acornGreen),
  acornRipe: new THREE.Color(PALETTE.acornRipe),
  bark: new THREE.Color(PALETTE.bark),
  deadwood: new THREE.Color(PALETTE.deadwood),
};

const MAX_TREE_ACORNS = 520;
const GROUND_ACORNS = 260;

/** The storm limb's pivot and resting pose on the ground, fixed once. */
const fall = (() => {
  const limb = SKELETON.axes[SKELETON.stormLimb];
  const dir = new THREE.Vector3(...limb.points[1]).sub(new THREE.Vector3(...limb.points[0])).normalize();
  const pivot = new THREE.Vector3(...pointAlong(limb, SKELETON.stormBreakS));
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const lying = flat.clone().setY(-0.04).normalize();
  const rest = new THREE.Quaternion().setFromUnitVectors(dir, lying);
  rest.premultiply(new THREE.Quaternion().setFromAxisAngle(lying, 0.5));
  const r0 = Math.hypot(pivot.x, pivot.z) + 1.4;
  const landing = new THREE.Vector3(flat.x * r0, groundY(r0) + 0.22, flat.z * r0);
  return { pivot, rest, landing };
})();

/** Rigid transform of the torn-off limb at t: hinge, drop, then slowly sink into the grass. */
function fallMatrix(t: number, out: THREE.Matrix4): THREE.Matrix4 {
  if (t <= STORY.storm) return out.identity();
  const e = smoothstep(STORY.storm, STORY.stormLanded, t) ** 2;
  const q = new THREE.Quaternion().slerp(fall.rest, e);
  const p = fall.pivot.clone().lerp(fall.landing, e);
  p.y -= 0.18 * smoothstep(STORY.stormLanded, STORY.stormLanded + 50, t);
  return out
    .makeTranslation(p.x, p.y, p.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
    .multiply(new THREE.Matrix4().makeTranslation(-fall.pivot.x, -fall.pivot.y, -fall.pivot.z));
}

class TreeExperienceImpl implements FourDExperience {
  id = "tree" as const;
  name = "Oak tree";

  minTime = 0;
  maxTime = STORY.end;
  mapping = mapping;
  baseDurationSeconds = 48;
  warpPresets = [0.25, 0.5, 1, 2, 4];
  labels = { start: "Acorn", end: "150 years" };
  events: TimelineEvent[] = EVENTS;

  private ctx: SceneContext | null = null;
  private root: THREE.Group | null = null;
  private tree: THREE.Group | null = null;
  private lights: THREE.Group | null = null;
  private sets: { trunk: BranchSet; limbs: BranchSet; lost: BranchSet; roots: BranchSet } | null = null;
  private clumps: THREE.InstancedMesh | null = null;
  private clumpOutline: THREE.InstancedMesh | null = null;
  private leaves: THREE.InstancedMesh | null = null;
  private leafInk: THREE.InstancedMesh | null = null;
  private nuts: THREE.InstancedMesh | null = null;
  private cups: THREE.InstancedMesh | null = null;
  private groundAcorns: { position: THREE.Vector3; rank: number; spin: number }[] = [];
  private props: Prop[] = [];
  private hoverables: THREE.Object3D[] = [];
  private currentTime = 0;

  mount(ctx: SceneContext): void {
    this.ctx = ctx;
    this.lights = addWarmLights(ctx.scene);

    const root = new THREE.Group();
    root.name = "oak-world";
    this.root = root;
    ctx.scene.add(root);

    const island = buildIsland();
    root.add(island.group, buildGrass(), buildLitter());

    const tree = new THREE.Group();
    tree.name = "oak";
    this.tree = tree;
    root.add(tree);

    const kindOf = (s: Segment) => SKELETON.axes[s.axis].kind;
    const lost = (s: Segment) => SKELETON.axes[s.axis].lost === true && !(s.axis === SKELETON.stormLimb && s.s0 === 0);
    const all = SKELETON.segments;
    this.sets = {
      trunk: this.branchSet(all.filter((s) => kindOf(s) === "trunk"), PALETTE.bark, 0.07, "trunk"),
      limbs: this.branchSet(all.filter((s) => (kindOf(s) === "limb" || kindOf(s) === "twig") && !lost(s)), PALETTE.bark, 0.1, "limbs"),
      lost: this.branchSet(all.filter(lost), PALETTE.bark, 0.1, "storm-limb"),
      roots: this.branchSet(all.filter((s) => kindOf(s) === "root"), PALETTE.root, 0.1, "roots"),
    };
    for (const set of Object.values(this.sets)) tree.add(set.mesh, set.outline, set.joints, set.jointOutline);

    const clumps = new THREE.InstancedMesh(blobGeometry(), new THREE.MeshToonMaterial(), SKELETON.clumps.length);
    (clumps.material as THREE.MeshToonMaterial).gradientMap = (this.sets.trunk.mesh.material as THREE.MeshToonMaterial).gradientMap;
    clumps.name = "canopy";
    clumps.setColorAt(0, tmpC.set("#ffffff"));
    this.clumps = clumps;
    this.clumpOutline = instancedOutline(clumps, 0.045);
    tree.add(clumps, this.clumpOutline);

    // Flat leaves cannot use a hull outline, so each sits on a slightly larger
    // ink card; polygon offset lets the leaf win where they overlap.
    const leafMaterial = new THREE.MeshToonMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    leafMaterial.gradientMap = (clumps.material as THREE.MeshToonMaterial).gradientMap;
    const leafGeometry = oakLeafGeometry();
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, SKELETON.leaves.length);
    leaves.name = "leaves";
    leaves.setColorAt(0, tmpC.set("#ffffff"));
    this.leaves = leaves;
    const leafInk = new THREE.InstancedMesh(
      leafInkGeometry(leafGeometry),
      new THREE.MeshBasicMaterial({ color: THEME.ink, side: THREE.DoubleSide }),
      SKELETON.leaves.length,
    );
    leafInk.instanceMatrix = leaves.instanceMatrix;
    leafInk.raycast = () => {};
    leafInk.frustumCulled = false;
    this.leafInk = leafInk;
    tree.add(leaves, leafInk);

    this.buildAcornCrop(tree);

    this.props = buildProps();
    for (const prop of this.props) tree.add(prop.object);

    this.hover(this.sets.trunk.mesh, "trunk");
    this.hover(this.sets.limbs.mesh, "canopy");
    this.hover(this.sets.lost.mesh, "storm-limb");
    this.hover(clumps, "canopy");
    this.hover(leaves, "canopy");
    this.hover(this.sets.roots.mesh, "roots");
    this.hover(this.nuts!, "acorns");
    for (const prop of this.props) if (prop.hover) this.hover(prop.hover.target, prop.hover.id);
    for (const g of island.ground) this.hover(g, "hill");

    this.setTime(0);
  }

  setTime(time: number): void {
    const t = Math.min(this.maxTime, Math.max(this.minTime, time));
    this.currentTime = t;
    if (!this.root || !this.sets || !this.tree) return;
    this.root.position.y = -viewCenter(t);
    // The gale pushes the crown over a little while it blows.
    const gale = smoothstep(STORY.storm - 1, STORY.storm, t) * (1 - smoothstep(STORY.storm, STORY.stormLanded + 0.6, t));
    this.tree.rotation.set(0.05 * gale, 0, -0.03 * gale);

    const lostMatrix = fallMatrix(t, new THREE.Matrix4());
    this.poseBranches(this.sets.trunk, t);
    this.poseBranches(this.sets.limbs, t);
    this.poseBranches(this.sets.roots, t);
    this.poseBranches(this.sets.lost, t, lostMatrix);
    this.tintFallenLimb(t);
    this.poseFoliage(t, lostMatrix);
    this.poseAcorns(t, lostMatrix);
    for (const prop of this.props) prop.pose(t);
  }

  getState(time: number): TreeState {
    return treeStateAt(time);
  }

  getCurrentEvent(time: number): TimelineEvent | null {
    return eventAt(this.events, time);
  }

  getHoveredObject(id: string): ObjectMetadata | null {
    return hoverInfo(id, this.currentTime);
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
    this.setTime(0);
  }

  dispose(): void {
    if (this.ctx) for (const o of this.hoverables) this.ctx.unregisterHoverable(o);
    if (this.root) disposeObject(this.root);
    if (this.lights) disposeObject(this.lights);
    this.hoverables = [];
    this.props = [];
    this.groundAcorns = [];
    this.root = this.tree = this.lights = null;
    this.sets = null;
    this.clumps = this.clumpOutline = this.leaves = this.leafInk = this.nuts = this.cups = null;
    this.ctx = null;
  }

  private hover(object: THREE.Object3D, id: string): void {
    object.userData.id = id;
    // The raycaster ignores `visible`, and hidden instanced meshes keep stale
    // instances, so a hidden part must not answer.
    const raycast = object.raycast.bind(object);
    object.raycast = (raycaster, hits) => {
      if (object.visible) raycast(raycaster, hits);
    };
    this.ctx!.registerHoverable(object, id);
    this.hoverables.push(object);
  }

  private branchSet(segments: Segment[], color: string, outline: number, name: string): BranchSet {
    const geometry = taperedCylinder(segments.length, name === "trunk" ? 20 : 8);
    const mesh = new THREE.InstancedMesh(geometry, taperedToonMaterial(color), segments.length);
    mesh.name = name;
    const quaternions = segments.map((s) => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...s.dir)));
    const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, name === "trunk" ? 20 : 10, name === "trunk" ? 14 : 8), makeToonMaterial(color), segments.length);
    joints.name = `${name}-joints`;
    joints.raycast = () => {};
    return {
      mesh,
      outline: instancedOutline(mesh, outline, true),
      joints,
      jointOutline: instancedOutline(joints, outline),
      segments,
      quaternions,
      taper: geometry.getAttribute("aTaper") as THREE.InstancedBufferAttribute,
    };
  }

  private poseBranches(set: BranchSet, t: number, transform?: THREE.Matrix4): void {
    set.segments.forEach((seg, i) => {
      const pose = segmentPose(SKELETON, seg, t);
      if (pose.length <= 0) {
        set.mesh.setMatrixAt(i, ZERO);
        set.joints.setMatrixAt(i, ZERO);
        return;
      }
      tmpP.set(...seg.start);
      tmpS.set(pose.rBottom, pose.length, pose.rBottom);
      tmpM.compose(tmpP, set.quaternions[i], tmpS);
      if (transform) tmpM.premultiply(transform);
      set.mesh.setMatrixAt(i, tmpM);
      set.taper.setX(i, pose.rTop / pose.rBottom);
      tmpM.compose(tmpP, set.quaternions[i], tmpS.setScalar(pose.rBottom));
      if (transform) tmpM.premultiply(transform);
      set.joints.setMatrixAt(i, tmpM);
    });
    set.mesh.instanceMatrix.needsUpdate = true;
    set.joints.instanceMatrix.needsUpdate = true;
    set.taper.needsUpdate = true;
    set.mesh.computeBoundingSphere();
    set.joints.computeBoundingSphere();
  }

  /** Bark on the fallen limb greys and greens with moss as it rots. */
  private tintFallenLimb(t: number): void {
    const set = this.sets!.lost;
    const k = smoothstep(STORY.stormLanded + 2, STORY.stormLanded + 30, t);
    (set.mesh.material as THREE.MeshToonMaterial).color.copy(C.bark).lerp(C.deadwood, k);
    (set.joints.material as THREE.MeshToonMaterial).color.copy(C.bark).lerp(C.deadwood, k);
  }

  private poseFoliage(t: number, lostMatrix: THREE.Matrix4): void {
    const clumps = this.clumps!;
    const leaves = this.leaves!;
    const phase = seasonPhase(t);
    const leaf = foliageAt(phase, t);
    const S = frameSize(t);
    const clumpShow = smoothstep(0.9, 1.8, S);
    const leafShow = 1 - smoothstep(1.4, 2.8, S);

    const leafColor = new THREE.Color();
    if (leaf.kept) leafColor.copy(C.dead);
    else {
      leafColor.copy(C.summer).lerp(C.spring, leaf.fresh);
      leafColor.lerp(C.autumn, leaf.turn).lerp(C.autumnLate, smoothstep(0.86, 0.92, phase));
    }

    SKELETON.clumps.forEach((site, i) => {
      const axis = SKELETON.axes[site.axis];
      const { position, radius } = clumpPose(SKELETON, site, t);
      // Leaves on the torn-off limb wilt brown before they shrivel.
      const wilt = axis.lost ? smoothstep(STORY.storm, STORY.stormLanded + 0.3, t) : 0;
      const r = radius * Math.pow(leaf.amount * leafy(axis, t), 0.6) * clumpShow;
      // Deeper green low in the crown, lighter on top: cheap depth.
      const lift = THREE.MathUtils.clamp(position[1] / Math.max(1, S), 0, 1);
      tmpC.copy(leafColor).lerp(C.summerDeep, (1 - lift) * 0.4 * (1 - leaf.turn));
      tmpC.offsetHSL((site.tint - 0.5) * 0.03, 0, (site.tint - 0.5) * 0.07);
      if (wilt > 0) tmpC.lerp(C.dead, wilt);
      clumps.setColorAt(i, tmpC);
      if (r < 0.004) {
        clumps.setMatrixAt(i, ZERO);
        return;
      }
      tmpP.set(...position);
      tmpQ.setFromEuler(tmpE.set(0, site.tint * 6.28, 0));
      tmpS.setScalar(r);
      tmpM.compose(tmpP, tmpQ, tmpS);
      if (axis.lost) tmpM.premultiply(lostMatrix);
      clumps.setMatrixAt(i, tmpM);
    });
    clumps.instanceMatrix.needsUpdate = true;
    clumps.instanceColor!.needsUpdate = true;
    clumps.computeBoundingSphere();
    clumps.visible = clumpShow > 0.001;
    this.clumpOutline!.visible = clumps.visible;

    leaves.visible = leafShow > 0.001 && t > STORY.shoot;
    this.leafInk!.visible = leaves.visible;
    if (!leaves.visible) return;
    const leafSize = 0.05 + 0.04 * smoothstep(0.6, 4, t);
    SKELETON.leaves.forEach((site, i) => {
      const axis = SKELETON.axes[site.axis];
      const len = axisLength(axis, t);
      // Oak leaves grow on this year's shoot; last year's fell in autumn.
      const shootStart = axisLength(axis, t - 1);
      const onShoot = site.s <= len && site.s >= shootStart - 0.02;
      const grow = smoothstep(0, 0.03, len - site.s);
      const k = onShoot ? leaf.amount * leafy(axis, t) * standing(axis, t) * leafShow * grow : 0;
      tmpC.copy(leafColor).offsetHSL(0, 0, (site.size - 1) * 0.15);
      leaves.setColorAt(i, tmpC);
      if (k < 0.01) {
        leaves.setMatrixAt(i, ZERO);
        return;
      }
      tmpP.set(...pointAlong(axis, site.s));
      tmpQ.setFromEuler(tmpE.set(site.rotation[0], site.rotation[1], site.rotation[2], "YXZ"));
      tmpS.setScalar(leafSize * site.size * k);
      tmpM.compose(tmpP, tmpQ, tmpS);
      leaves.setMatrixAt(i, tmpM);
    });
    leaves.instanceMatrix.needsUpdate = true;
    leaves.instanceColor!.needsUpdate = true;
    leaves.computeBoundingSphere();
  }

  private buildAcornCrop(tree: THREE.Group): void {
    const nutGeo = new THREE.SphereGeometry(0.38, 12, 8);
    nutGeo.scale(1, 1.35, 1);
    const cupGeo = new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cupGeo.translate(0, 0.3, 0);
    const count = MAX_TREE_ACORNS + GROUND_ACORNS;
    const nuts = new THREE.InstancedMesh(nutGeo, new THREE.MeshToonMaterial(), count);
    (nuts.material as THREE.MeshToonMaterial).gradientMap = (this.clumps!.material as THREE.MeshToonMaterial).gradientMap;
    nuts.name = "acorns";
    nuts.setColorAt(0, tmpC.set("#ffffff"));
    const cups = new THREE.InstancedMesh(cupGeo, new THREE.MeshToonMaterial({ color: PALETTE.cup }), count);
    (cups.material as THREE.MeshToonMaterial).gradientMap = (nuts.material as THREE.MeshToonMaterial).gradientMap;
    cups.instanceMatrix = nuts.instanceMatrix;
    cups.raycast = () => {};
    cups.frustumCulled = false;
    this.nuts = nuts;
    this.cups = cups;
    tree.add(nuts, cups, instancedOutline(nuts, 0.08));

    let s = 11;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    while (this.groundAcorns.length < GROUND_ACORNS) {
      const r = 1.2 + Math.sqrt(rand()) * (ISLAND_RADIUS * 0.72);
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (inNotch(x, z)) continue;
      this.groundAcorns.push({ position: new THREE.Vector3(x, groundY(r), z), rank: rand(), spin: rand() * 6.28 });
    }
  }

  private poseAcorns(t: number, lostMatrix: THREE.Matrix4): void {
    const nuts = this.nuts!;
    const crop = acornsAt(t);
    const size = 0.026 * THREE.MathUtils.clamp(frameSize(t) / 4, 1, 4.5);
    tmpC.copy(C.acornGreen).lerp(C.acornRipe, crop.ripe);
    const sites = SKELETON.acorns;
    for (let i = 0; i < MAX_TREE_ACORNS; i++) {
      const site = sites[i];
      const clump = SKELETON.clumps[site.clump];
      const axis = SKELETON.axes[clump.axis];
      const { position, radius } = clumpPose(SKELETON, clump, t);
      // Only on clumps that have grown: an unborn twig's site sits where it will one day reach.
      const shown = site.rank < crop.onTree && radius > 0.5 * clump.maxRadius && !(axis.lost && t > STORY.storm);
      nuts.setColorAt(i, tmpC);
      if (!shown) {
        nuts.setMatrixAt(i, ZERO);
        continue;
      }
      tmpP.set(...position).addScaledVector(tmpS.set(...site.offset), radius * 0.92);
      tmpQ.setFromEuler(tmpE.set(Math.PI, site.rank * 40, 0.3));
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(size));
      if (axis.lost) tmpM.premultiply(lostMatrix);
      nuts.setMatrixAt(i, tmpM);
    }
    this.groundAcorns.forEach((g, j) => {
      const i = MAX_TREE_ACORNS + j;
      nuts.setColorAt(i, C.acornRipe);
      if (g.rank >= crop.onGround) {
        nuts.setMatrixAt(i, ZERO);
        return;
      }
      tmpP.copy(g.position).setY(g.position.y + size * 0.3);
      tmpQ.setFromEuler(tmpE.set(Math.PI / 2, g.spin, 0));
      tmpM.compose(tmpP, tmpQ, tmpS.setScalar(size));
      nuts.setMatrixAt(i, tmpM);
    });
    nuts.instanceMatrix.needsUpdate = true;
    nuts.instanceColor!.needsUpdate = true;
    nuts.computeBoundingSphere();
    this.cups!.visible = nuts.visible = crop.onTree > 0 || crop.onGround > 0;
  }
}

export const treeExperience: FourDExperience = new TreeExperienceImpl();
