type StorageFailureMethod = 'getItem' | 'key' | 'length' | 'removeItem' | 'setItem'

type WebLockRelease = () => void

export type SalesMutationStorageHarness = {
  activeTabId: () => string
  advanceClock: (milliseconds: number) => number
  closeTab: (tabId: string) => void
  disableWebLocks: () => void
  dispose: () => void
  enableWebLocks: () => void
  failNextLocalStorage: (method: StorageFailureMethod) => void
  holdWebLock: (name: string) => WebLockRelease
  localStorage: Storage
  openTab: (tabId: string) => void
  runAsTab: <T>(tabId: string, callback: () => T) => T
  selectTab: (tabId: string) => void
  sessionStorageFor: (tabId: string) => Storage
  setClock: (value: number) => void
}

export function installSalesMutationStorageHarness(
  initialTabId: string = 'tab-a',
  initialNow: number = Date.now(),
): SalesMutationStorageHarness {
  const sessions = new Map<string, MemoryStorage>()
  const storageListeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const localDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  const sessionDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
  const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
  const nativeAddEventListener = window.addEventListener.bind(window)
  const nativeRemoveEventListener = window.removeEventListener.bind(window)
  const nativeDateNow = Date.now
  let activeTabId = initialTabId
  let clock = initialNow
  const webLocks = new TestWebLockManager(() => activeTabId, (tabId, callback) => {
    const previous = activeTabId
    activeTabId = tabId

    try {
      return callback()
    } finally {
      activeTabId = previous
    }
  })
  const localStorage = new SharedLocalStorage(
    () => activeTabId,
    (sourceTabId, key, oldValue, newValue) => {
      for (const [targetTabId, listeners] of storageListeners) {
        if (targetTabId === sourceTabId) {
          continue
        }

        const previous = activeTabId
        activeTabId = targetTabId

        try {
          const event = new Event('storage') as StorageEvent
          Object.defineProperties(event, {
            key: { configurable: true, value: key },
            newValue: { configurable: true, value: newValue },
            oldValue: { configurable: true, value: oldValue },
            storageArea: { configurable: true, value: localStorage },
            url: { configurable: true, value: window.location.href },
          })

          for (const listener of [...listeners]) {
            if (typeof listener === 'function') {
              listener.call(window, event)
            } else {
              listener.handleEvent(event)
            }
          }
        } finally {
          activeTabId = previous
        }
      }
    },
  )

  sessions.set(initialTabId, new MemoryStorage())
  Date.now = () => clock
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => localStorage,
  })
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get: () => getSession(activeTabId),
  })
  installWebLocks()

  window.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type === 'storage' && listener) {
      getStorageListeners(activeTabId).add(listener)
      return
    }

    nativeAddEventListener(type, listener as EventListenerOrEventListenerObject, options)
  }) as typeof window.addEventListener
  window.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) => {
    if (type === 'storage' && listener) {
      getStorageListeners(activeTabId).delete(listener)
      return
    }

    nativeRemoveEventListener(type, listener as EventListenerOrEventListenerObject, options)
  }) as typeof window.removeEventListener

  function getSession(tabId: string): MemoryStorage {
    let session = sessions.get(tabId)

    if (!session) {
      session = new MemoryStorage()
      sessions.set(tabId, session)
    }

    return session
  }

  function getStorageListeners(tabId: string): Set<EventListenerOrEventListenerObject> {
    let listeners = storageListeners.get(tabId)

    if (!listeners) {
      listeners = new Set()
      storageListeners.set(tabId, listeners)
    }

    return listeners
  }

  function installWebLocks(): void {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: webLocks,
    })
  }

  function disableWebLocks(): void {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })
  }

  return {
    activeTabId: () => activeTabId,
    advanceClock: (milliseconds) => {
      clock += milliseconds
      return clock
    },
    closeTab: (tabId) => {
      sessions.delete(tabId)
      storageListeners.delete(tabId)
    },
    disableWebLocks,
    dispose: () => {
      window.addEventListener = nativeAddEventListener
      window.removeEventListener = nativeRemoveEventListener
      Date.now = nativeDateNow
      restorePropertyDescriptor(window, 'localStorage', localDescriptor)
      restorePropertyDescriptor(window, 'sessionStorage', sessionDescriptor)
      restorePropertyDescriptor(navigator, 'locks', locksDescriptor)
      storageListeners.clear()
      webLocks.dispose()
    },
    enableWebLocks: installWebLocks,
    failNextLocalStorage: (method) => localStorage.failNext(method),
    holdWebLock: (name) => webLocks.hold(name),
    localStorage,
    openTab: (tabId) => {
      getSession(tabId)
      activeTabId = tabId
    },
    runAsTab: (tabId, callback) => {
      const previous = activeTabId
      getSession(tabId)
      activeTabId = tabId

      try {
        return callback()
      } finally {
        activeTabId = previous
      }
    },
    selectTab: (tabId) => {
      getSession(tabId)
      activeTabId = tabId
    },
    sessionStorageFor: getSession,
    setClock: (value) => {
      clock = value
    },
  }
}

class MemoryStorage implements Storage {
  protected readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(String(key)) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.values.set(String(key), String(value))
  }
}

class SharedLocalStorage extends MemoryStorage {
  readonly #dispatch: (
    sourceTabId: string,
    key: string | null,
    oldValue: string | null,
    newValue: string | null,
  ) => void
  readonly #getActiveTabId: () => string
  readonly #failures = new Map<StorageFailureMethod, number>()

  constructor(
    getActiveTabId: () => string,
    dispatch: (
      sourceTabId: string,
      key: string | null,
      oldValue: string | null,
      newValue: string | null,
    ) => void,
  ) {
    super()
    this.#getActiveTabId = getActiveTabId
    this.#dispatch = dispatch
  }

  override get length(): number {
    this.throwIfRequested('length')
    return super.length
  }

  override clear(): void {
    const sourceTabId = this.#getActiveTabId()
    super.clear()
    this.#dispatch(sourceTabId, null, null, null)
  }

  override getItem(key: string): string | null {
    this.throwIfRequested('getItem')
    return super.getItem(key)
  }

  override key(index: number): string | null {
    this.throwIfRequested('key')
    return super.key(index)
  }

  override removeItem(key: string): void {
    this.throwIfRequested('removeItem')
    const normalizedKey = String(key)
    const oldValue = super.getItem(normalizedKey)
    super.removeItem(normalizedKey)
    this.#dispatch(this.#getActiveTabId(), normalizedKey, oldValue, null)
  }

  override setItem(key: string, value: string): void {
    this.throwIfRequested('setItem')
    const normalizedKey = String(key)
    const normalizedValue = String(value)
    const oldValue = super.getItem(normalizedKey)
    super.setItem(normalizedKey, normalizedValue)
    this.#dispatch(this.#getActiveTabId(), normalizedKey, oldValue, normalizedValue)
  }

  failNext(method: StorageFailureMethod): void {
    this.#failures.set(method, (this.#failures.get(method) ?? 0) + 1)
  }

  private throwIfRequested(method: StorageFailureMethod): void {
    const remaining = this.#failures.get(method) ?? 0

    if (remaining <= 0) {
      return
    }

    this.#failures.set(method, remaining - 1)
    throw new DOMException(`Injected localStorage ${method} failure`, 'SecurityError')
  }
}

type QueuedWebLock = {
  callback: () => Promise<unknown>
  reject: (reason?: unknown) => void
  resolve: (value: unknown) => void
  tabId: string
}

class TestWebLockManager {
  readonly #active = new Set<string>()
  readonly #getActiveTabId: () => string
  readonly #holds = new Map<string, number>()
  readonly #queues = new Map<string, QueuedWebLock[]>()
  readonly #runAsTab: <T>(tabId: string, callback: () => T) => T

  constructor(
    getActiveTabId: () => string,
    runAsTab: <T>(tabId: string, callback: () => T) => T,
  ) {
    this.#getActiveTabId = getActiveTabId
    this.#runAsTab = runAsTab
  }

  request<T>(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queue = this.#queues.get(name) ?? []
      queue.push({
        callback: () => Promise.resolve(callback({ mode: 'exclusive', name } as Lock)),
        reject,
        resolve: resolve as (value: unknown) => void,
        tabId: this.#getActiveTabId(),
      })
      this.#queues.set(name, queue)
      this.drain(name)
    })
  }

  hold(name: string): WebLockRelease {
    this.#holds.set(name, (this.#holds.get(name) ?? 0) + 1)
    let released = false

    return () => {
      if (released) {
        return
      }

      released = true
      const remaining = (this.#holds.get(name) ?? 1) - 1

      if (remaining > 0) {
        this.#holds.set(name, remaining)
      } else {
        this.#holds.delete(name)
      }

      this.drain(name)
    }
  }

  dispose(): void {
    this.#active.clear()
    this.#holds.clear()
    this.#queues.clear()
  }

  private drain(name: string): void {
    if (this.#active.has(name) || (this.#holds.get(name) ?? 0) > 0) {
      return
    }

    const queue = this.#queues.get(name)
    const next = queue?.shift()

    if (!next) {
      this.#queues.delete(name)
      return
    }

    this.#active.add(name)
    let result: Promise<unknown>

    try {
      result = this.#runAsTab(next.tabId, next.callback)
    } catch (error) {
      result = Promise.reject(error)
    }

    result.then(next.resolve, next.reject).finally(() => {
      this.#active.delete(name)
      this.drain(name)
    })
  }
}

function restorePropertyDescriptor(
  target: Window | Navigator,
  property: 'localStorage' | 'locks' | 'sessionStorage',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
  } else {
    Reflect.deleteProperty(target, property)
  }
}
