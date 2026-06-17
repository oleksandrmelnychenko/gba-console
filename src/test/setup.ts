import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

const CHART_WIDTH = 640
const CHART_HEIGHT = 320

class ResizeObserverStub {
  private callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: { width: CHART_WIDTH, height: CHART_HEIGHT } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }

  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    top: 0,
    left: 0,
    right: CHART_WIDTH,
    bottom: CHART_HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 640 })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 320 })

afterEach(() => {
  cleanup()
})
