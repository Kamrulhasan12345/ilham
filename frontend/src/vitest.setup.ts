import { configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ponytail: generous async budget, not slower tests — the shadcn/Radix tree
// pulls far more modules per route than the old hand-rolled UI, and a cold
// parallel worker can need over the 1s default for a lazy route + query to
// paint. This buys time, not behavior; drop it if the suite gets faster.
configure({ asyncUtilTimeout: 8000 });

// jsdom has no layout, so it refuses window.scrollTo and prints a
// "Not implemented" stack for every call. TanStack Router calls it on each
// navigation to restore scroll position, which buries real output under a
// dozen fake errors per run. Stub it: no test asserts on scroll position, and
// a no-op is exactly what a headless DOM should do here.
window.scrollTo = () => {};

// jsdom has no scrollIntoView. cmdk calls it on the active option whenever
// the palette list changes; stub it like scrollTo above.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// jsdom has no ResizeObserver. Radix roving-focus (radio groups) reads it
// on mount and throws without this. Tests never assert on layout.
window.ResizeObserver =
  window.ResizeObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
// jsdom has no matchMedia. shadcn's sidebar reads it through useIsMobile to
// pick the desktop or mobile layout, so every Shell render throws without
// this. Desktop (matches: false) is the layout the tests assert against.
window.matchMedia =
  window.matchMedia ??
  ((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
