import { afterEach, describe, expect, it, vi } from 'vitest'
import { guardUiAction, guardUiActionProps, trackUiActionResult } from './uiActionGuard'

function event(element: HTMLElement, token: Event = new Event('click')) {
  return { type: 'click', target: element, currentTarget: element, nativeEvent: token, preventDefault: vi.fn(), stopPropagation: vi.fn() }
}
function eventHandler<T>(handler: () => T): (input: ReturnType<typeof event>) => T {
  return handler
}
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

afterEach(() => vi.unstubAllGlobals())

describe('UI action lifetime', () => {
  it('releases on rejection and reports an otherwise unhandled failure once', async () => {
    const request = deferred(), reportError = vi.fn(), button = document.createElement('button')
    vi.stubGlobal('reportError', reportError)
    const callback = vi.fn(() => request.promise), handler = guardUiAction(eventHandler(callback))
    handler(event(button)); handler(event(button))
    const failure = new Error('Failed')
    request.reject(failure)
    await request.promise.catch(() => undefined)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(button.hasAttribute('aria-busy')).toBe(false)
    callback.mockResolvedValue(undefined)
    await handler(event(button))
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('propagates synchronous exceptions and never leaves a stale lock', () => {
    const button = document.createElement('button'), fail = vi.fn(() => { throw new Error('Invalid') })
    const handler = guardUiAction(eventHandler(fail))
    expect(() => handler(event(button))).toThrow('Invalid')
    expect(() => handler(event(button))).toThrow('Invalid')
    expect(fail).toHaveBeenCalledTimes(2)
  })

  it('allows capture and bubble handlers for the first event and blocks a subsequent event', async () => {
    const request = deferred(), button = document.createElement('button'), token = new Event('click')
    const capture = guardUiAction(eventHandler(() => request.promise)), clicked = vi.fn(), bubble = guardUiAction(clicked)
    capture(event(button, token))
    bubble(event(button, token))
    const duplicate = event(button)
    bubble(duplicate)
    expect(clicked).toHaveBeenCalledOnce()
    expect(duplicate.preventDefault).toHaveBeenCalledOnce()
    request.resolve(); await request.promise
  })

  it('preserves callbacks, custom payloads, return values and refs through spreads', () => {
    const callback = vi.fn((value: string) => value.toUpperCase()), ref = { current: null }
    const guarded = guardUiAction(callback)
    expect(guardUiAction(callback)).toBe(guarded)
    expect(guardUiAction(guarded)).toBe(guarded)
    expect(guarded('value')).toBe('VALUE')
    expect(guardUiActionProps({ ref, onClick: callback })).toEqual({ ref, onClick: guarded })
    expect(guardUiActionProps(null)).toBeNull()
    expect(trackUiActionResult('unrelated')).toBe('unrelated')
  })

  it('restores prior attributes and preserves application changes made while pending', async () => {
    const request = deferred(), button = document.createElement('button')
    button.setAttribute('aria-busy', 'false')
    const callback = guardUiAction(eventHandler(() => request.promise))
    callback(event(button))
    button.setAttribute('aria-disabled', 'false')
    request.resolve(); await request.promise
    expect(button.getAttribute('aria-busy')).toBe('false')
    expect(button.getAttribute('aria-disabled')).toBe('false')
  })

  it('does not report a failure already handled inside the action', async () => {
    const reportError = vi.fn(), button = document.createElement('button')
    vi.stubGlobal('reportError', reportError)
    const handler = guardUiAction(eventHandler(async () => {
      try { await Promise.reject(new Error('Handled')) } catch { /* existing UI handles it */ }
    }))
    await handler(event(button))
    expect(reportError).not.toHaveBeenCalled()
  })
})
