import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { moveWizardCartSelection, toggleWizardCartSplit, type WizardCartEditorState } from './wizardCartEditor'
import { useWizardCartEditor } from './useWizardCartEditor'
import type { WizardCartSelection } from './wizardCartMutation'
import type { WizardSplitOrderItem } from './wizardSplitSale'

afterEach(cleanup)
function cart(count = 2, selected: WizardCartSelection | null = null): WizardCartEditorState {
  return { isSplit: true, selected, splitItems: Array.from({ length: count }, (_, index) => ({
    NetUid: `row-${index}`, Product: {}, Qty: 1, TotalAmount: 2, TotalAmountLocal: 80, TotalAmountEurToUah: 80,
  } satisfies WizardSplitOrderItem)) }
}

describe('cart editor navigation', () => {
  it('preserves the existing navigation across empty, hidden, stale and populated lists', () => {
    for (const currentCount of [0, 1, 3]) for (const splitCount of [0, 1, 3]) for (const isSplit of [false, true]) {
      const flat: WizardCartSelection[] = [
        ...Array.from({ length: currentCount }, (_, index) => ({ list: 'current' as const, index })),
        ...(isSplit ? Array.from({ length: splitCount }, (_, index) => ({ list: 'split' as const, index })) : []),
      ]
      const selections: (WizardCartSelection | null)[] = [null, ...flat, { list: 'current', index: 9 }, { list: 'split', index: 9 }]
      for (const selected of selections) for (const direction of [-1, 1] as const) {
        const state = { ...cart(splitCount, selected), isSplit }
        const index = flat.findIndex((row) => row.list === selected?.list && row.index === selected?.index)
        const nextIndex = index < 0 ? (direction === 1 ? 0 : flat.length - 1)
          : direction === 1 && index === flat.length - 1 && isSplit && splitCount > 0 ? currentCount
            : (index + direction + flat.length) % flat.length
        expect(moveWizardCartSelection(state, currentCount, direction).selected).toEqual(flat[nextIndex] ?? null)
      }
    }
  })

  it('preserves extracted items when hiding and reopening the split table', () => {
    const state = cart(2, { list: 'split', index: 1 })
    const hidden = toggleWizardCartSplit(state, 3)
    expect(hidden.selected).toEqual({ list: 'current', index: 0 })
    expect(hidden.splitItems).toBe(state.splitItems)
    expect(toggleWizardCartSplit(hidden, 3).splitItems).toBe(state.splitItems)
    expect(toggleWizardCartSplit(state, 0).selected).toBeNull()
    expect(state.selected).toEqual({ list: 'split', index: 1 })
  })

  it('does not allocate state for a move that leaves selection unchanged', () => {
    const state = cart(1, { list: 'split', index: 0 })
    expect(moveWizardCartSelection(state, 0, 1)).toBe(state)
  })

  it('uses the latest row count and composes successive moves without stale state', () => {
    const { result, rerender } = renderHook(useWizardCartEditor, { initialProps: 2 })
    act(() => result.current.moveCartSelection(1))
    expect(result.current.editCart).toBeNull()
    act(() => result.current.setEditCart(cart(2, { list: 'current', index: 0 })))
    act(() => { result.current.moveCartSelection(1); result.current.moveCartSelection(1) })
    expect(result.current.editCart?.selected).toEqual({ list: 'split', index: 0 })
    rerender(0)
    act(() => result.current.toggleSplitMode())
    expect(result.current.editCart?.selected).toBeNull()
    expect(result.current.editCart?.splitItems).toHaveLength(2)
    act(() => result.current.setEditCart(null))
    act(() => result.current.toggleSplitMode())
    expect(result.current.editCart).toBeNull()
  })
})
