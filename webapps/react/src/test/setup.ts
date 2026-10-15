import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// There is no classic app/{module}/scripts/config.js in the tests; a test that
// needs its settings mocks this module itself.
vi.mock('../shared/classic-config', () => ({ importClassicConfig: vi.fn(async () => ({})) }));

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

// jsdom resolves a CSS custom property by walking up all ancestors, which is
// slow; Carbon's Popover (behind every icon button) reads two of them after
// each render. The tests load no stylesheets (css: false), so they are empty.
const getComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element: Element, pseudoElement?: string | null) => {
  const style = getComputedStyle(element, pseudoElement);
  const getPropertyValue = style.getPropertyValue.bind(style);
  style.getPropertyValue = (property: string) => (property.startsWith('--') ? '' : getPropertyValue(property));
  return style;
};
