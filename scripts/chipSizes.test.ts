// vitest hands a test every stylesheet import, ?raw included, as an empty
// string, so this reads the files from disk.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI = "src/ui";
const read = (names: string[]) => Object.fromEntries(names.map((path) => [path, readFileSync(path, "utf8")]));
const inUi = (ext: string) => readdirSync(UI).filter((f) => f.endsWith(ext)).map((f) => join(UI, f));
const COMPONENTS = read(inUi(".tsx"));
const STYLESHEETS = read(["src/index.css", ...inUi(".css")]);

function chipVariants(): Set<string> {
  const variants = new Set<string>();
  for (const source of Object.values(COMPONENTS)) {
    for (const [, classes] of source.matchAll(/className="([^"]*)"/g)) {
      const list = classes.split(/\s+/);
      if (list.includes("chip")) for (const c of list) if (c !== "chip") variants.add(c);
    }
  }
  return variants;
}

interface Rule {
  media: string | null;
  selector: string;
  body: string;
}

function rules(css: string): Rule[] {
  const out: Rule[] = [];
  let media: string | null = null;
  let depth = 0;
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]*)\{|\}/g;
  let open: { selector: string; start: number } | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[0] === "}") {
      depth--;
      if (open) {
        out.push({ media, selector: open.selector, body: text.slice(open.start, m.index) });
        open = null;
      } else if (depth === 0) media = null;
      continue;
    }
    const head = m[1].trim();
    depth++;
    if (open || (head.startsWith("@") && depth > 1)) throw new Error(`rules() reads one level of @media, not "${head}"`);
    if (head.startsWith("@")) media = head;
    else open = { selector: head, start: re.lastIndex };
  }
  return out;
}

describe("chip variants", () => {
  it("size themselves only above the phone breakpoint, so the shared phone chip rule wins below it", () => {
    const variants = chipVariants();
    const offending: string[] = [];
    for (const [file, css] of Object.entries(STYLESHEETS)) {
      for (const rule of rules(css)) {
        if (rule.media?.includes("min-width: 900px")) continue;
        if (!/\b(padding|font-size)\s*:/.test(rule.body)) continue;
        const bare = rule.selector.split(",").map((s) => s.trim());
        for (const v of variants) if (bare.includes(`.${v}`)) offending.push(`${file}: .${v}`);
      }
    }
    expect([...variants].sort()).toEqual(["chip--accent", "exporter__action", "tourbar__next"]);
    expect(offending).toEqual([]);
  });
});
