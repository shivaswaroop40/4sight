// src/experiences/keyframe/timeFormats.ts
//
// How a scene's experience time reads in the HUD and on the slider, by name.

export const TIME_FORMATS = {
  /** Calendar year, e.g. "1834". */
  year: (t: number) => `${Math.round(t)}`,
  /** Elapsed minutes, e.g. "7 min", "1 h 05 min". */
  minutes: (t: number) => {
    const m = Math.max(0, Math.round(t));
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  },
  percent: (t: number) => `${Math.round(t * 100)}%`,
} as const satisfies Record<string, (t: number) => string>;

export type TimeFormatName = keyof typeof TIME_FORMATS;

export function isTimeFormatName(name: string): name is TimeFormatName {
  return Object.hasOwn(TIME_FORMATS, name);
}
