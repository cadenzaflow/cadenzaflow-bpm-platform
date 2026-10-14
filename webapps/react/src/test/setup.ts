import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// The tests run in parallel; under that load, loading an embedded form or a
// debounced check can take longer than the default second of findBy/waitFor.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no matchMedia; Carbon uses it for responsive behaviour.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no ResizeObserver; Carbon's Tabs observe their size.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// jsdom does not implement scrolling; the router scrolls on navigation.
window.scrollTo = () => {};
