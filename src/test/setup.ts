import { cleanup } from '@testing-library/react'
import { DEFAULT_THEME } from '@mantine/core'
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

// jsdom under Node 26 exposes window.sessionStorage but leaves window.localStorage
// undefined, so any code path through window.localStorage.getItem (e.g. i18n's
// getStoredLanguage, table page-size persistence) throws in tests. The real app
// runs in a browser where localStorage always exists; Node is only the test/build
// runtime. Provide a minimal in-memory Storage so the jsdom environment matches a
// browser regardless of the Node/jsdom quirk.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  } as Storage
}

for (const storageKey of ['localStorage', 'sessionStorage'] as const) {
  const existing = (window as unknown as Record<string, unknown>)[storageKey]

  if (!existing || typeof (existing as Partial<Storage>).getItem !== 'function') {
    Object.defineProperty(window, storageKey, {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    })
  }
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

// Test runs do not need animation frames. Mantine only honors the browser's
// reduced-motion preference when it is also enabled in the theme. Set both
// halves of that contract globally so every test provider disables transitions;
// otherwise a late transition timer can dispatch after jsdom has been torn down.
DEFAULT_THEME.respectReducedMotion = true

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })),
})

// jsdom does not implement document.fonts. Mantine's autosizing Textarea
// subscribes to its loading events, so provide the EventTarget contract used
// by the component.
Object.defineProperty(document, 'fonts', {
  configurable: true,
  writable: true,
  value: new EventTarget(),
})

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 640 })
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 320 })

afterEach(() => {
  cleanup()
})
