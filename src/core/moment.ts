// src/core/moment.ts
//
// A moment is an experience plus a position on its timeline. It round-trips
// through the page URL as ?x=<id>&u=<u>, so a copied link opens on the same
// frame. u is rounded up to 4 decimal places (a 10,000-step timeline) and
// left out at 0, the default every experience opens on. Rounding up matters
// on event flags: an event starts exactly at its u, and rounding down would
// open the link on the event before it.

import type { ExperienceId } from "./types";

export interface Moment {
  id: ExperienceId;
  u: number;
}

/** Bad or missing u reads as 0 and u is clamped to [0, 1]; an unknown id becomes the fallback. */
export function parseMoment(search: string, ids: readonly ExperienceId[], fallback: ExperienceId): Moment {
  const params = new URLSearchParams(search);
  const x = params.get("x");
  const id = ids.find((known) => known === x) ?? fallback;
  const raw = params.get("u");
  const u = raw === null ? 0 : Number(raw);
  return { id, u: Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0 };
}

/** href with x and u set for the moment. Every other part of the URL is kept. */
export function formatMoment(href: string, moment: Moment): string {
  const url = new URL(href);
  url.searchParams.set("x", moment.id);
  // The epsilon absorbs float noise such as 0.3 * 1e4 = 3000.0000000000005.
  const u = Math.ceil(moment.u * 1e4 - 1e-6) / 1e4;
  if (u === 0) url.searchParams.delete("u");
  else url.searchParams.set("u", String(u));
  return url.toString();
}
