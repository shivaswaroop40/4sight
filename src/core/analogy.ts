// src/core/analogy.ts
//
// The timescale analogy: squeeze an experience's whole span into one day
// and read the current moment off a 12-hour clock. 4.6 billion years as a
// day puts the first humans a few seconds before midnight.
//
//   dayClock(0)     // "12:00:00 am"
//   dayClock(0.5)   // "12:00:00 pm"
//   dayClock(1)     // "midnight"

const DAY_SECONDS = 86_400;

/** The time of day at `fraction` of the way through it, floored to the second. Clamped to [0, 1]. */
export function dayClock(fraction: number): string {
  const f = Math.min(1, Math.max(0, fraction));
  if (f === 1) return "midnight";
  const total = Math.floor(f * DAY_SECONDS);
  const h24 = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h12}:${pad(minutes)}:${pad(seconds)} ${h24 < 12 ? "am" : "pm"}`;
}
