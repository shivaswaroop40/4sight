// src/core/timescale.ts
//
// Plain-language lengths of time for the gallery: "10 seconds", "4.6 billion
// years". Also orders experiences on the ladder of timescales and places a
// span on a log scale that runs from one second to the age of the universe.

export const YEAR_SECONDS = 365.25 * 86_400;

/** The top rung of the gallery's log scale: the age of the universe. */
export const UNIVERSE_SECONDS = 13.8e9 * YEAR_SECONDS;

const UNITS: [name: string, seconds: number][] = [
  ["billion years", 1e9 * YEAR_SECONDS],
  ["million years", 1e6 * YEAR_SECONDS],
  ["year", YEAR_SECONDS],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/** "0.8 seconds", "65 minutes", "250,000 years", "4.6 billion years". Three significant digits. */
export function formatSpan(seconds: number): string {
  let i = UNITS.findIndex(([, size]) => seconds >= size);
  if (i < 0) i = UNITS.length - 1;
  // "1.08 hours" reads worse than "65 minutes": step down a unit while the
  // value needs two decimals and the smaller unit still reads in hundreds.
  while (i < UNITS.length - 1 && !atMostOneDecimal(seconds / UNITS[i][1]) && seconds / UNITS[i + 1][1] < 1000) i++;
  const [unit, size] = UNITS[i];
  const value = Number((seconds / size).toPrecision(3));
  const text = value.toLocaleString("en-US");
  if (unit.endsWith("years")) return `${text} ${unit}`;
  return `${text} ${unit}${value === 1 ? "" : "s"}`;
}

function atMostOneDecimal(value: number): boolean {
  const tenths = Number(value.toPrecision(3)) * 10;
  return Math.abs(tenths - Math.round(tenths)) < 1e-9;
}

/** Shortest span first. Stable, so equal spans keep their registry order. */
export function byTimescale<T extends { spanSeconds: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.spanSeconds - b.spanSeconds);
}

/** Where a span sits between 1 second (0) and the age of the universe (1), on a log scale. */
export function rungPosition(seconds: number): number {
  if (!(seconds > 1)) return 0;
  return Math.min(1, Math.log10(seconds) / Math.log10(UNIVERSE_SECONDS));
}
