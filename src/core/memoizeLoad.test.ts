import { describe, expect, it } from "vitest";
import { memoizeLoad } from "./memoizeLoad";

describe("memoizeLoad", () => {
  it("loads each key once and retries after a failure", async () => {
    const calls: string[] = [];
    let failNext = true;
    const load = memoizeLoad(async (id: string) => {
      calls.push(id);
      if (failNext) {
        failNext = false;
        throw new Error(`offline: ${id}`);
      }
      return `scene ${id}`;
    });

    await expect(load("solar")).rejects.toThrow("offline: solar");
    expect(await load("solar")).toBe("scene solar");
    expect(await load("solar")).toBe("scene solar");
    expect(await load("iphone")).toBe("scene iphone");
    expect(calls).toEqual(["solar", "solar", "iphone"]);
  });

  it("shares one request between callers that ask while it is in flight", async () => {
    let resolve!: (v: string) => void;
    let count = 0;
    const load = memoizeLoad(() => {
      count++;
      return new Promise<string>((r) => (resolve = r));
    });
    const a = load("x");
    const b = load("x");
    resolve("ready");
    expect(await Promise.all([a, b])).toEqual(["ready", "ready"]);
    expect(count).toBe(1);
  });
});
