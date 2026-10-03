// src/renderer/stageFit.ts
//
// How a camera preset carries over to screens other than the one it was
// authored on. Presets are authored on a 1440x900 layout, where the top bar
// and the transport leave REFERENCE_BAND of the stage free, and a preset
// frames a subject one band tall and DEFAULT_SUBJECT_ASPECT bands wide. On any
// stage the camera fits that subject box into the free band, the way CSS
// `object-fit: contain` would, and keeps the orbit target at the same height
// within the band:
//
//   fitStage(1.6, REFERENCE_BAND)                               // { scale: 1, centerY: 0.5 }
//   fitStage(390 / 844, { top: 114 / 844, bottom: 554 / 844 })  // a phone: { scale: 1.66, centerY: 0.447 }
//
// `scale` multiplies the preset's camera distance; `centerY` is where the
// orbit target lands on screen, as a fraction of the stage height from the top.

/** The part of the stage not covered by the top bar or the bottom chrome, as fractions of its height from the top. */
export interface FreeBand {
  top: number;
  bottom: number;
}

export interface StageFit {
  scale: number;
  centerY: number;
}

/** The free band of the 1440x900 layout: below the top bar (74 px), above the transport (702 px). */
export const REFERENCE_BAND: FreeBand = { top: 74 / 900, bottom: 702 / 900 };

/** A little over square, so a round subject keeps a margin on a narrow screen. */
export const DEFAULT_SUBJECT_ASPECT = 1.1;

/** Below this, as on a phone on its side, the HUD covers the stage and the reference band frames instead. */
const MIN_FREE = 0.3;

/** `subjectAspect` is the width over height of what the preset frames. */
export function fitStage(aspect: number, measured: FreeBand, subjectAspect = DEFAULT_SUBJECT_ASPECT): StageFit {
  const band = measured.bottom - measured.top >= MIN_FREE ? measured : REFERENCE_BAND;
  const subject = REFERENCE_BAND.bottom - REFERENCE_BAND.top;
  const free = band.bottom - band.top;
  const scale = Math.max(subject / free, (subjectAspect * subject) / aspect);
  // On the reference layout the target is at canvas centre, a little below the band's middle.
  const targetInBand = (0.5 - REFERENCE_BAND.top) / subject;
  return { scale, centerY: band.top + targetInBand * free };
}
