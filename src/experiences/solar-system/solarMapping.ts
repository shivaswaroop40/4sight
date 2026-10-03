// src/experiences/solar-system/solarMapping.ts
//
// Readout format for the solar system's slider. The mapping itself is
// knotMapping in core/mappings.ts.

// Each unit hands over half a step early, so rounding never shows "1000 thousand years".
export function formatYears(t: number): string {
  if (t < 1) return "0 years";
  if (t < 999.5) return `${Math.round(t)} years`;
  if (t < 999_500) return `${(t / 1e3).toFixed(t < 1e4 ? 1 : 0)} thousand years`;
  if (t < 999.5e6) return `${(t / 1e6).toFixed(t < 1e7 ? 1 : 0)} million years`;
  return `${(t / 1e9).toFixed(2)} billion years`;
}
