import { describe, expect, it } from "vitest";
import { clusterFlags, openClusterKey } from "./flagClusters";

const ids = (clusters: { items: { id: string }[] }[]) => clusters.map((c) => c.items.map((m) => m.id).join("+"));
const key = (m: { id: string }) => m.id;

describe("clusterFlags", () => {
  const markers = [
    { id: "a", u: 0 },
    { id: "b", u: 0.04 },
    { id: "c", u: 0.45 },
    { id: "d", u: 0.46 },
    { id: "e", u: 0.47 },
    { id: "f", u: 0.52 },
  ];

  it("keeps every flag on its own on a wide track", () => {
    expect(ids(clusterFlags(markers, 2000, 18))).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("shares a flag between events closer than the gap on a phone, standing at the first and passed at the last", () => {
    const clusters = clusterFlags(markers, 330, 18);
    expect(ids(clusters)).toEqual(["a+b", "c+d+e", "f"]);
    expect(clusters.map((c) => [c.u, c.end])).toEqual([
      [0, 0.04],
      [0.45, 0.47],
      [0.52, 0.52],
    ]);
  });

  it("measures from the cluster's first event, so a chain of close events still splits", () => {
    const chain = [0, 0.02, 0.04, 0.06, 0.08].map((u, i) => ({ id: String(i), u }));
    expect(ids(clusterFlags(chain, 500, 18))).toEqual(["0+1", "2+3", "4"]);
  });

  it("orders the markers itself", () => {
    const shuffled = [markers[4], markers[0], markers[5], markers[2], markers[1], markers[3]];
    expect(ids(clusterFlags(shuffled, 330, 18))).toEqual(["a+b", "c+d+e", "f"]);
  });

  it("clusters nothing before the track is measured", () => {
    expect(clusterFlags(markers, 0, 18)).toHaveLength(6);
  });
});

describe("openClusterKey", () => {
  const markers = [
    { id: "c", u: 0.45 },
    { id: "d", u: 0.46 },
    { id: "f", u: 0.52 },
  ];

  it("keeps the open cluster open while it exists", () => {
    expect(openClusterKey(clusterFlags(markers, 330, 18), "c", key)).toBe("c");
  });

  it("closes it once a wider track splits it into single flags", () => {
    expect(openClusterKey(clusterFlags(markers, 2000, 18), "c", key)).toBe(null);
  });

  it("stays closed when nothing was open", () => {
    expect(openClusterKey(clusterFlags(markers, 330, 18), null, key)).toBe(null);
  });
});
