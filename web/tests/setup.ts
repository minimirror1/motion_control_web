import '@testing-library/jest-dom'

// uPlot probes matchMedia at import time; jsdom does not ship it.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom has no canvas backend: getContext('2d') returns null and Path2D is
// missing, so uPlot throws on its first draw. These no-op shims let the chart
// components mount and redraw in tests without pulling in a native canvas build.
if (!globalThis.Path2D) {
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    closePath() {}
    rect() {}
    arc() {}
    addPath() {}
  } as unknown as typeof Path2D
}

const noopContext = new Proxy(
  { canvas: null, measureText: () => ({ width: 0 }) },
  {
    get: (target, key) => (key in target ? Reflect.get(target, key) : () => undefined),
    set: () => true,
  },
)
HTMLCanvasElement.prototype.getContext = (() =>
  noopContext) as unknown as typeof HTMLCanvasElement.prototype.getContext
