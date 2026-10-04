// src/ui/flagClusters.ts
//
// Event flags that would sit closer than a flag's width share one flag. A
// cluster stands at its first event, and an event joins it while it is less
// than `gapPx` from there, so no two flags on the track overlap however
// dense the events. A cluster counts as passed once its last event has.
//
//   clusterFlags([{ u: 0 }, { u: 0.01 }, { u: 0.5 }], 400, 20)
//   // [{ u: 0, end: 0.01, items: [{ u: 0 }, { u: 0.01 }] }, { u: 0.5, end: 0.5, items: [{ u: 0.5 }] }]

export interface FlagCluster<T> {
  /** Where the flag stands: its first event. */
  u: number;
  /** Its last event: the playhead has passed the cluster once it reaches this. */
  end: number;
  /** In order along the track. */
  items: T[];
}

/** `widthPx` is the track's width. An unmeasured track (0) clusters nothing. */
export function clusterFlags<T extends { u: number }>(markers: readonly T[], widthPx: number, gapPx: number): FlagCluster<T>[] {
  const clusters: FlagCluster<T>[] = [];
  for (const m of [...markers].sort((a, b) => a.u - b.u)) {
    const last = clusters.at(-1);
    if (last && widthPx > 0 && (m.u - last.u) * widthPx < gapPx) {
      last.items.push(m);
      last.end = m.u;
    } else {
      clusters.push({ u: m.u, end: m.u, items: [m] });
    }
  }
  return clusters;
}

/**
 * The open cluster's key, if that cluster still exists. A resize can dissolve
 * the open cluster into single flags; the list then closes for good rather
 * than reopening when a later resize groups the same events again.
 */
export function openClusterKey<T>(clusters: readonly FlagCluster<T>[], openKey: string | null, keyOf: (item: T) => string): string | null {
  if (openKey === null) return null;
  return clusters.some((c) => c.items.length > 1 && keyOf(c.items[0]) === openKey) ? openKey : null;
}
