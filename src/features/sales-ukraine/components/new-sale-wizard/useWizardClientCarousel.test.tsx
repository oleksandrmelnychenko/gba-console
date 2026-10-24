import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../../clients/types'
import { useWizardClientCarousel } from './useWizardClientCarousel'

const client = (id: number): Client => ({ Id: id, NetUid: `client-${id}`, FullName: `Client ${id}`, IsActive: true })
const clients = [client(1), client(2), client(3), client(4)]
function setup() {
  const options = { confirmClient: vi.fn(), unselectClient: vi.fn(), loadMore: vi.fn(async () => {}) }
  return { ...renderHook(useWizardClientCarousel, { initialProps: options }), options }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('client carousel controller', () => {
  it('uses the latest position for consecutive movements before React commits', () => {
    const { result, options } = setup()
    act(() => { result.current.applySearchResults(clients); result.current.move('down'); result.current.move('down') })
    expect(result.current.carousel.selected).toBe(clients[3])
    expect(result.current.carousel.dataTop).toEqual(clients.slice(0, 3))
    expect(result.current.carousel.dataBottom).toEqual([])
    expect(options.confirmClient.mock.calls.map(([item]) => item)).toEqual([clients[2], clients[3]])
    expect(options.loadMore).toHaveBeenCalledOnce()
    act(() => result.current.move('up'))
    expect(result.current.carousel.selected).toBe(clients[2])
    expect(result.current.carousel.dataBottom).toEqual([clients[3]])
  })

  it('retains selection at a boundary and permits retrying failed pagination', () => {
    const { result, options } = setup()
    act(() => { result.current.applySearchResults(clients); result.current.move('down'); result.current.move('down') })
    const current = result.current.carousel
    act(() => result.current.move('down'))
    expect(result.current.carousel).toBe(current)
    expect(options.unselectClient).not.toHaveBeenCalled()
    expect(options.loadMore).toHaveBeenCalledTimes(2)
  })

  it('previews folders without selecting them and expands children only on confirmation', () => {
    const folder: Client = { ...client(5), RegionCode: { Value: 'VI02100' }, SubClients: [{ SubClient: client(6) }] }
    const { result, options } = setup()
    act(() => { result.current.applySearchResults([client(1), folder]); result.current.move('down') })
    expect(result.current.carousel.selected).toBe(folder)
    expect(result.current.carousel.dataBottom).toEqual([])
    expect(options.unselectClient).toHaveBeenCalledOnce()
    expect(options.confirmClient).not.toHaveBeenCalled()
    act(() => { result.current.confirmFocusedClient(); result.current.move('down') })
    expect(result.current.carousel.selected?.Id).toBe(6)
    expect(options.confirmClient).toHaveBeenCalledWith(folder)
    // Child folders are a finite list, not another page of the parent search.
    expect(options.loadMore).toHaveBeenCalledOnce()
    act(() => result.current.appendSearchResults([client(99)]))
    expect(result.current.carousel.dataBottom).toEqual([])
  })

  it('re-centers a clicked row, then navigates from that row and keeps incoming pages ordered', () => {
    const { result } = setup()
    act(() => { result.current.applySearchResults(clients); result.current.pickClient(clients[1]) })
    expect(result.current.carousel.dataTop).toEqual([clients[0]])
    expect(result.current.carousel.dataBottom).toEqual(clients.slice(2))
    act(() => { result.current.appendSearchResults([client(5)]); result.current.move('down') })
    expect(result.current.carousel.selected).toBe(clients[2])
    expect(result.current.carousel.dataBottom.map((item) => item.Id)).toEqual([4, 5])
  })

  it('supports a single result and preserves callback freshness without changing handlers', () => {
    const { result, rerender, options } = setup()
    const apply = result.current.applySearchResults
    const confirmClient = vi.fn()
    rerender({ ...options, confirmClient })
    act(() => apply([clients[0]]))
    expect(result.current.applySearchResults).toBe(apply)
    expect(confirmClient).toHaveBeenCalledWith(clients[0])
    expect(options.confirmClient).not.toHaveBeenCalled()
    expect(result.current.carousel.selected).toBe(clients[0])
    act(() => result.current.move('down'))
    expect(options.loadMore).not.toHaveBeenCalled()
  })

  it('coalesces focus restoration and cancels it on unmount', () => {
    const { result, unmount } = setup()
    const input = document.createElement('input')
    document.body.append(input)
    result.current.searchInputRef.current = input
    const focus = vi.spyOn(input, 'focus')
    act(() => { result.current.focusSearchInput(); result.current.focusSearchInput(); vi.runAllTimers() })
    expect(focus).toHaveBeenCalledOnce()
    act(() => result.current.focusSearchInput())
    unmount()
    act(() => vi.runAllTimers())
    expect(focus).toHaveBeenCalledOnce()
    input.remove()
  })
})
