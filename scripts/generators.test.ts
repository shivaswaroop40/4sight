import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_SCENE_PATH, cityScene } from "./gen-city.ts";
import { MITOSIS_SCENE_PATH, mitosisScene } from "./gen-mitosis.ts";

const committed = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

describe("committed scene JSON matches its generator", () => {
  it("mitosis", () => {
    expect(committed(MITOSIS_SCENE_PATH)).toEqual(JSON.parse(JSON.stringify(mitosisScene)));
  });

  it("city", () => {
    expect(committed(CITY_SCENE_PATH)).toEqual(JSON.parse(JSON.stringify(cityScene)));
  });
});
