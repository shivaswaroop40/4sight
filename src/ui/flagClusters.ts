// src/ui/flagClusters.ts
//
// Event flags that would sit closer than a flag's width share one flag. A
// cluster stands at its first event, and an event joins it while it is less
// than `gapPx` from there, so no two flags on the track overlap however
// dense the events.
//
//   clusterFlags([{ u: 0 }, { u: 0.01 }, { u: 0.5 }], 400, 20)
//   // [{ u: 0, items: [{ u: 0 }, { u: 0.01 }] }, { u: 0.5, items: [{ u: 0.5 }] }]

export interface FlagCluster<T> {
  u: number;
  items: T[];
}

/** `markers` sorted by u; `widthPx` is the track's width. An unmeasured track (0) clusters nothing. */
export function clusterFlags<T extends { u: number }>(markers: readonly T[], widthPx: number, gapPx: number): FlagCluster<T>[] {
  const clusters: FlagCluster<T>[] = [];
  for (const m of markers) {
    const last = clusters.at(-1);
    if (last && widthPx > 0 && (m.u - last.u) * widthPx < gapPx) last.items.push(m);
    else clusters.push({ u: m.u, items: [m] });
  }
  return clusters;
}
