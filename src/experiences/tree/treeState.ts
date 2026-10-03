// src/experiences/tree/treeState.ts
//
// Plain data about the oak at time t, for the HUD, hover text and tests.

import { STORY, acornCapacity, acornSeason, foliageAt, girthAt, heightAt, mastFactor, ringCount, seasonClockAt, seasonName, seasonPhase, type SeasonName } from "./treeModel";
import { drawnSpread } from "./treePose";
import { SKELETON } from "./treeSkeleton";

export type Stage = "acorn" | "germinating" | "seedling" | "sapling" | "young tree" | "mature tree" | "veteran";
export type LimbState = "attached" | "falling" | "fallen";
export type Wildlife = "jay" | "rabbit" | "squirrel" | "woodpecker" | "owl";

/** When each animal is on stage. The squirrel comes for acorns in autumn. */
export const WILDLIFE_WINDOWS: Record<Exclude<Wildlife, "squirrel">, [number, number]> = {
  jay: [0, 0.075],
  rabbit: [2.2, 9],
  woodpecker: [STORY.woodpecker, STORY.woodpeckerLeaves],
  owl: [STORY.owl, STORY.end],
};

export interface TreeState {
  age: number;
  stage: Stage;
  heightM: number;
  girthM: number;
  crownWidthM: number;
  rings: number;
  season: SeasonName;
  leafCover: number;
  acorns: { onTree: number; onGround: number; mast: boolean };
  limb: LimbState;
  wildlife: Wildlife[];
}

function stageAt(t: number): Stage {
  if (t < STORY.radicle) return "acorn";
  if (t < STORY.shoot) return "germinating";
  if (t < 3) return "seedling";
  if (t < 15) return "sapling";
  if (t < STORY.firstAcorns) return "young tree";
  if (t < 120) return "mature tree";
  return "veteran";
}

function limbStateAt(t: number): LimbState {
  if (t < STORY.storm) return "attached";
  if (t < STORY.stormLanded) return "falling";
  return "fallen";
}

/** Acorn crop on the tree and on the ground, 0..1 each, from age, season and the year's mast. */
export function acornsAt(t: number): { onTree: number; onGround: number; ripe: number; mast: boolean } {
  const phase = seasonPhase(t);
  const s = acornSeason(phase);
  const year = Math.floor(seasonClockAt(t));
  const mast = year === MAST_YEAR || mastFactor(year) === 1;
  const crop = acornCapacity(t) * (mast ? 1 : mastFactor(year));
  return { onTree: s.onTree * crop, onGround: s.onGround * crop, ripe: s.ripe, mast: mast && crop > 0 };
}

/** The displayed year of the mast-year event is always a mast year. */
const MAST_YEAR = Math.floor(seasonClockAt(STORY.mast));

function wildlifeAt(t: number): Wildlife[] {
  const out: Wildlife[] = [];
  for (const [id, [a, b]] of Object.entries(WILDLIFE_WINDOWS) as [Wildlife, [number, number]][]) {
    if (t >= a && t <= b) out.push(id);
  }
  if (acornsAt(t).onGround > 0.15) out.push("squirrel");
  return out;
}

export function treeStateAt(t: number): TreeState {
  const phase = seasonPhase(t);
  const a = acornsAt(t);
  return {
    age: t,
    stage: stageAt(t),
    heightM: round(heightAt(t), 2),
    girthM: round(girthAt(t), 2),
    crownWidthM: round(2 * drawnSpread(SKELETON, t), 1),
    rings: ringCount(t),
    season: seasonName(phase),
    leafCover: t < STORY.shoot ? 0 : round(foliageAt(phase, t).amount, 3),
    acorns: { onTree: round(a.onTree, 3), onGround: round(a.onGround, 3), mast: a.mast },
    limb: limbStateAt(t),
    wildlife: wildlifeAt(t),
  };
}

function round(x: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(x * k) / k;
}
