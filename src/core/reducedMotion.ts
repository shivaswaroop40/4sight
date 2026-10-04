// src/core/reducedMotion.ts
//
// The viewer's "reduce motion" setting. Camera moves and tour travel jump
// instead of gliding while it is on.

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
