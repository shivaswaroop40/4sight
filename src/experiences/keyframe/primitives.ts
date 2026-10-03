// src/experiences/keyframe/primitives.ts
//
// The fixed table of shapes a scene object can be. Each entry lists its
// geometry parameters with defaults (the parser fills in and checks names
// against these) and builds the geometry. Every primitive also takes
// `bottom`: 1 moves the geometry so its lowest point sits at local y = 0,
// which makes scale.y grow a shape up out of the ground instead of from its
// middle.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

interface PrimitiveSpec {
  params: Record<string, number>;
  /** Null for a group: an empty node that only carries a transform. */
  build(p: Record<string, number>): THREE.BufferGeometry | null;
  /** Flat faces meet at hard edges, so the ink hull needs smoothed normals. */
  hardEdges: boolean;
}

const deg = THREE.MathUtils.degToRad;

export const PRIMITIVES = {
  group: { params: {}, build: () => null, hardEdges: false },
  sphere: {
    params: { radius: 0.5, widthSegments: 32, heightSegments: 20 },
    build: (p) => new THREE.SphereGeometry(p.radius, p.widthSegments, p.heightSegments),
    hardEdges: false,
  },
  box: {
    params: { width: 1, height: 1, depth: 1 },
    build: (p) => new THREE.BoxGeometry(p.width, p.height, p.depth),
    hardEdges: true,
  },
  roundedBox: {
    params: { width: 1, height: 1, depth: 1, radius: 0.08, segments: 3 },
    build: (p) => new RoundedBoxGeometry(p.width, p.height, p.depth, p.segments, p.radius),
    hardEdges: false,
  },
  cylinder: {
    params: { radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 24 },
    build: (p) => new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, p.radialSegments),
    hardEdges: true,
  },
  cone: {
    params: { radius: 0.5, height: 1, radialSegments: 24 },
    build: (p) => new THREE.ConeGeometry(p.radius, p.height, p.radialSegments),
    hardEdges: true,
  },
  torus: {
    params: { radius: 0.5, tube: 0.15, radialSegments: 16, tubularSegments: 48, arc: 360 },
    build: (p) => new THREE.TorusGeometry(p.radius, p.tube, p.radialSegments, p.tubularSegments, deg(p.arc)),
    hardEdges: false,
  },
  capsule: {
    params: { radius: 0.25, length: 1, capSegments: 6, radialSegments: 16 },
    build: (p) => new THREE.CapsuleGeometry(p.radius, p.length, p.capSegments, p.radialSegments),
    hardEdges: false,
  },
  /** Lies flat on XZ, facing up. */
  plane: {
    params: { width: 1, depth: 1 },
    build: (p) => new THREE.PlaneGeometry(p.width, p.depth).rotateX(-Math.PI / 2),
    hardEdges: true,
  },
} as const satisfies Record<string, PrimitiveSpec>;

export type PrimitiveName = keyof typeof PRIMITIVES;

export const COMMON_PARAMS: Record<string, number> = { bottom: 0 };

export function isPrimitiveName(name: string): name is PrimitiveName {
  return Object.hasOwn(PRIMITIVES, name);
}

export function buildGeometry(primitive: PrimitiveName, params: Record<string, number>): THREE.BufferGeometry | null {
  const spec: PrimitiveSpec = PRIMITIVES[primitive];
  const geometry = spec.build(params);
  if (geometry && params.bottom) {
    geometry.computeBoundingBox();
    geometry.translate(0, -geometry.boundingBox!.min.y, 0);
  }
  return geometry;
}

/** Geometry for the ink hull: the same shape with normals averaged across hard edges, so the hull has no gaps. */
export function hullGeometry(primitive: PrimitiveName, geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const spec: PrimitiveSpec = PRIMITIVES[primitive];
  if (!spec.hardEdges) return geometry;
  const bare = geometry.clone();
  bare.deleteAttribute("normal");
  bare.deleteAttribute("uv");
  const smooth = mergeVertices(bare, 1e-4);
  bare.dispose();
  smooth.computeVertexNormals();
  return smooth;
}
