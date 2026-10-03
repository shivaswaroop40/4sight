import { describe, expect, it } from "vitest";
import { clusterFlags } from "./flagClusters";

const ids = (clusters: { items: { id: string }[] }[]) => clusters.map((c) => c.items.map((m) => m.id).join("+"));

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

  it("shares a flag between events closer than the gap on a phone", () => {
    const clusters = clusterFlags(markers, 330, 18);
    expect(ids(clusters)).toEqual(["a+b", "c+d+e", "f"]);
    expect(clusters.map((c) => c.u)).toEqual([0, 0.45, 0.52]);
  });

  it("measures from the cluster's first event, so a chain of close events still splits", () => {
    const chain = [0, 0.02, 0.04, 0.06, 0.08].map((u, i) => ({ id: String(i), u }));
    expect(ids(clusterFlags(chain, 500, 18))).toEqual(["0+1", "2+3", "4"]);
  });

  it("clusters nothing before the track is measured", () => {
    expect(clusterFlags(markers, 0, 18)).toHaveLength(6);
  });
});
