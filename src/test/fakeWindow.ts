// src/test/fakeWindow.ts
//
// The slice of `window` the UI runtime touches, for tests in Node: an
// address bar whose replaceState records each write, and timers and
// animation frames that go through the globals, so vi.useFakeTimers()
// drives them. Call vi.unstubAllGlobals() after each test.

import { vi } from "vitest";

export interface FakeWindow {
  location: { href: string; replace(href: string): void };
  /** Every href written with history.replaceState, in order. */
  replaced: string[];
  /** Every href navigated to with location.replace (a page reload), in order. */
  reloaded: string[];
  /** The next replaceState throws, as Safari does past its rate limit. */
  failNextReplace(): void;
}

export function installFakeWindow(href: string): FakeWindow {
  let fail = false;
  const fake: FakeWindow = {
    location: {
      href,
      replace: (next) => fake.reloaded.push(next),
    },
    replaced: [],
    reloaded: [],
    failNextReplace: () => {
      fail = true;
    },
  };
  vi.stubGlobal("window", {
    location: fake.location,
    history: {
      state: null,
      replaceState: (_state: unknown, _title: string, next: string) => {
        if (fail) {
          fail = false;
          throw new Error("SecurityError: too many calls to replaceState");
        }
        fake.location.href = next;
        fake.replaced.push(next);
      },
    },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  return fake;
}
