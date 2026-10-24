import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWizardProductCarousel } from './useWizardProductCarousel'

const products = Array.from({ length: 5 }, (_, index) => ({ NetUid: `product-${index}` }))
function options() {
  return {
    products, focusedIndex: 0, hasFocus: false, searchMode: true,
    searchValue: '', searchContextKey: 'client-1:agreement-1', onPick: vi.fn(), onSearchChange: vi.fn(),
  }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('product carousel controller', () => {
  it('settles the latest draft once and hides results for the previous query', () => {
    const props = options()
    const { result } = renderHook(useWizardProductCarousel, { initialProps: props })
    act(() => { result.current.handleTextChange('ab') })
    act(() => { vi.advanceTimersByTime(200); result.current.handleTextChange('abc') })
    expect(result.current.text).toBe('abc')
    expect(result.current.visibleProducts).toHaveLength(0)
    act(() => { vi.advanceTimersByTime(259) })
    expect(props.onSearchChange).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(props.onSearchChange).toHaveBeenCalledExactlyOnceWith('abc')
  })

  it('cancels an outstanding draft when the parent replaces the query', () => {
    const props = { ...options(), searchValue: 'previous' }
    const { result, rerender } = renderHook(useWizardProductCarousel, { initialProps: props })
    act(() => { result.current.handleTextChange('pending') })
    rerender({ ...props, searchValue: '' })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current.text).toBe('')
    expect(props.onSearchChange).not.toHaveBeenCalled()
  })

  it.each(['context', 'selection', 'unmount'] as const)('retires pending input on %s changes', (change) => {
    const props = options()
    const { result, rerender, unmount } = renderHook(useWizardProductCarousel, { initialProps: props })
    act(() => { result.current.handleTextChange('pending') })
    if (change === 'unmount') unmount()
    else rerender({ ...props, ...(change === 'context' ? { searchContextKey: 'client-2:agreement-2' } : { searchMode: false }) })
    act(() => { vi.advanceTimersByTime(300) })
    expect(props.onSearchChange).not.toHaveBeenCalled()
    if (change !== 'unmount') expect(result.current.text).toBe('')
  })

  it('keeps a newer draft when the parent acknowledges the previous settled query', () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardProductCarousel, { initialProps: props })
    act(() => { result.current.handleTextChange('first') })
    act(() => { vi.advanceTimersByTime(260) })
    act(() => { result.current.handleTextChange('second') })
    rerender({ ...props, searchValue: 'first' })
    expect(result.current.text).toBe('second')
    act(() => { vi.advanceTimersByTime(260) })
    expect(props.onSearchChange.mock.calls).toEqual([['first'], ['second']])
  })

  it('uses the latest callbacks without changing row handlers or list partitions', () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardProductCarousel, { initialProps: props })
    const before = result.current
    act(() => { result.current.handleTextChange('query') })
    const onSearchChange = vi.fn()
    const onPick = vi.fn()
    rerender({ ...props, onSearchChange, onPick })
    expect(result.current.handlePick).toBe(before.handlePick)
    act(() => { vi.advanceTimersByTime(260); result.current.handlePick(3) })
    expect(onSearchChange).toHaveBeenCalledExactlyOnceWith('query')
    expect(onPick).toHaveBeenCalledExactlyOnceWith(3)
    expect(props.onPick).not.toHaveBeenCalled()
    expect(props.onSearchChange).not.toHaveBeenCalled()
    rerender({ ...props, searchValue: 'query', onPick, onSearchChange })
    const settled = result.current
    rerender({ ...props, searchValue: 'query', onPick: vi.fn(), onSearchChange })
    expect(result.current.topProducts).toBe(settled.topProducts)
    expect(result.current.bottomProducts).toBe(settled.bottomProducts)
  })

  it('preserves the centred split and absolute indices at both selection boundaries', () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardProductCarousel, { initialProps: props })
    expect(result.current.topProducts).toEqual(products.slice(0, 2))
    expect(result.current.bottomOffset).toBe(2)
    rerender({ ...props, hasFocus: true, searchMode: false })
    expect(result.current.focused).toBe(products[0])
    expect(result.current.topProducts).toHaveLength(0)
    expect(result.current.bottomOffset).toBe(1)
    rerender({ ...props, hasFocus: true, focusedIndex: 4, searchMode: false })
    expect(result.current.focused).toBe(products[4])
    expect(result.current.bottomProducts).toHaveLength(0)
    rerender({ ...props, hasFocus: true, focusedIndex: 99 })
    expect(result.current.focused).toBeNull()
    expect(result.current.bottomOffset).toBe(2)
  })
})
