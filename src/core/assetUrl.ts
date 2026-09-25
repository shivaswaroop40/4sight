// src/core/assetUrl.ts
//
// The site is deployed under a sub-path (base: "/4sight/" in vite.config.ts).
// Fetching "/data/iphone.json" with a leading slash resolves to the domain
// root and 404s on GitHub Pages. Build every fetch URL with this helper
// instead so it works both in dev (base "/") and in the deployed build
// (base "/4sight/").
//
// Usage: fetch(assetUrl("data/iphone.json"))

export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL; // e.g. "/" or "/4sight/"
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}
