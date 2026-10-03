// src/experiences/tree/treeRings.ts
//
// A slice through the trunk near the ground, drawn as a floating "tree
// cookie". The rings are computed in the fragment shader from a table of
// ring radii, so setTime only moves one uniform (the age). Oak is
// ring-porous: each ring shows pale spring wood with large pores, then
// denser summer wood. Rays run out from the centre, the outer 25 rings are
// pale sapwood, and the rings after the storm are narrow.

import * as THREE from "three";
import { THEME, addOutline, makeToonMaterial } from "../../core/theme";
import { STORY, ringWidth } from "./treeModel";
import { PALETTE } from "./treeMaterials";

const YEARS = Math.ceil(STORY.end) + 1;

/** Cumulative ring radius after each year, normalised so the 150-year slice has radius 1. */
export function ringRadii(): number[] {
  const r = [0];
  for (let y = 1; y <= YEARS; y++) r.push(r[y - 1] + ringWidth(y));
  const scale = r[Math.floor(STORY.end)];
  return r.map((x) => x / scale);
}

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function rgb(hex: string): string {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

const fragment = /* glsl */ `
uniform float uAge;
uniform float uR[${YEARS + 1}];
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float rho = length(p);
  if (rho > 1.0) discard;
  float theta = atan(p.y, p.x);

  // Bark band, with fissures, and an ink rim.
  float px = fwidth(rho);
  float barkEdge = 0.9 + 0.025 * sin(theta * 23.0) * sin(theta * 7.0);
  float fissure = smoothstep(0.6, 0.95, abs(sin(theta * 37.0 + rho * 9.0)));
  vec3 bark = mix(${rgb(PALETTE.barkDark)}, ${rgb(PALETTE.bark)}, fissure);
  bark = mix(bark, ${rgb(THEME.ink)}, smoothstep(0.975 - px, 0.975 + px, rho));
  float inBark = smoothstep(barkEdge - px, barkEdge + px, rho);

  float age = max(uAge, 0.0);
  int whole = int(floor(age));
  float now = uR[whole] + (uR[min(whole + 1, ${YEARS})] - uR[whole]) * fract(age);
  float r = rho / 0.9 * now;

  float year = 0.0;
  float inRing = 0.0;
  for (int i = 1; i <= ${YEARS}; i++) {
    if (r < uR[i] || i == ${YEARS}) {
      year = float(i);
      inRing = (r - uR[i - 1]) / max(uR[i] - uR[i - 1], 1e-5);
      break;
    }
  }
  // Continuous ring position and how many rings one pixel spans. When rings
  // get thinner than a few pixels, single-year detail fades to its average
  // so the slice never shimmers; the decade rings stay.
  float yc = year - 1.0 + inRing;
  float w = fwidth(yc);
  float fine = 1.0 - smoothstep(0.25, 0.6, w);

  float heart = 1.0 - smoothstep(age - 25.0 - w, age - 25.0 + w, yc);
  vec3 early = mix(${rgb("#F2DDB4")}, ${rgb("#D2A46C")}, heart);
  vec3 late = mix(${rgb("#DFC08C")}, ${rgb("#B07E48")}, heart);
  vec3 col = mix(mix(early, late, 0.45), mix(early, late, smoothstep(0.3, 0.55, inRing)), fine);

  // Big spring pores along the start of each ring.
  vec2 cell = vec2(theta * 60.0, year * 3.0 + inRing * 6.0);
  float pore = step(0.78, hash(floor(cell))) * (1.0 - smoothstep(0.0, 0.3, inRing));
  col *= 1.0 - 0.18 * pore * fine;

  // The ring boundary: the last dense wood of the year against the next spring.
  float toEdge = 1.0 - inRing;
  float line = 1.0 - smoothstep(0.07, 0.07 + w, toEdge);
  col = mix(col, ${rgb("#7A5636")}, line * 0.8 * fine);

  // Every tenth ring drawn bolder, so the slice can be counted at any size.
  float toDecade = abs(yc - 10.0 * floor(yc / 10.0 + 0.5));
  float decade = (1.0 - smoothstep(0.12 + 0.6 * w, 0.12 + 1.6 * w, toDecade)) * step(5.0, yc);
  col = mix(col, ${rgb("#5E3F27")}, decade * 0.9);

  // Rays: oak's "silver grain".
  float rays = smoothstep(0.985, 1.0, cos(theta * 28.0 + 3.0 * hash(vec2(floor(theta * 4.4), 1.0))));
  col = mix(col, ${rgb("#F7E8C8")}, rays * step(0.06, rho) * 0.7);

  // Pith.
  col = mix(${rgb("#6E4A2E")}, col, smoothstep(0.015, 0.03, rho));

  gl_FragColor = vec4(mix(col, bark, inBark), 1.0);
  #include <colorspace_fragment>
}
`;

export interface RingCookie {
  group: THREE.Group;
  /** The disc the viewer hovers. */
  disc: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function buildRingCookie(): RingCookie {
  const material = new THREE.ShaderMaterial({
    uniforms: { uAge: { value: 0 }, uR: { value: ringRadii() } },
    vertexShader: vertex,
    fragmentShader: fragment,
  });
  const side = makeToonMaterial(PALETTE.barkDark);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.14, 96), [side, material, side]);
  disc.name = "rings";
  addOutline(disc, 0.03);
  const group = new THREE.Group();
  group.add(disc);
  return { group, disc, material };
}
