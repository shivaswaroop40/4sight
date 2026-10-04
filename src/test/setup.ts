// src/test/setup.ts
//
// Runs before every test file (vitest.config.ts). Tests run in Node, where
// experiences still draw canvas textures at mount, so `document` is an inert
// stand-in: createElement returns a canvas whose 2D context accepts every
// call and returns itself, so chains like
// ctx.createLinearGradient(...).addColorStop(...) work.

const inert: object = new Proxy(() => inert, {
  get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : inert),
  set: () => true,
});

const createElement = () => ({ width: 0, height: 0, style: {}, getContext: () => inert });

(globalThis as unknown as { document: unknown }).document = { createElement };
