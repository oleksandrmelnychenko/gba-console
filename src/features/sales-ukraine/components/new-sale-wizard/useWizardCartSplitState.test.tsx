import { act, cleanup, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installSalesMutationStorageHarness, type SalesMutationStorageHarness } from '../../salesMutationStorageTestHarness'
import {
  clearAllWizardSplitRecoveries, clearWizardMergedSale, getWizardSplitRecovery,
  hydrateWizardSplitRecovery, setWizardMergedSale, setWizardSplitOrderItems,
} from './newSaleWizardState'
import { useWizardCartSplitState } from './useWizardCartSplitState'
import type { WizardCartEditorState } from './wizardCartEditor'
import type { WizardSplitOrderItem } from './wizardSplitSale'

vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: translate }) }))
function translate(key: string) { return key }
const source = { agreementNetId: 'agreement-a', saleNetUid: 'sale-a', userKey: 'net:user-a', origin: 'ordinary' as const }
const first: WizardSplitOrderItem = { Product: { NetUid: 'product-a' }, Qty: 2, TotalAmount: 20, TotalAmountEurToUah: 800, TotalAmountLocal: 800 }
let storage: SalesMutationStorageHarness
beforeEach(() => { storage = installSalesMutationStorageHarness(); clearAllWizardSplitRecoveries(); clearWizardMergedSale() })
afterEach(() => { cleanup(); clearAllWizardSplitRecoveries(); clearWizardMergedSale(); storage.dispose() })
type Scope = Pick<Parameters<typeof useWizardCartSplitState>[0], 'agreementNetId' | 'saleNetUid' | 'userKey'>
function renderState(scope: Scope = source, opened = true) {
  return renderHook((current: Scope) => {
    const [editor, setEditCart] = useState<WizardCartEditorState | null>(opened ? { isSplit: false, selected: { list: 'current', index: 1 }, splitItems: [] } : null)
    return { ...useWizardCartSplitState({ ...current, setEditCart }), editor, setEditCart }
  }, { initialProps: scope })
}

describe('cart split persistence binding', () => {
  it('normalizes identities and keeps callbacks stable during editor updates', () => {
    const { result } = renderState({ agreementNetId: ' AGREEMENT-A ', saleNetUid: ' SALE-A ', userKey: ' NET:USER-A ' })
    expect(result.current.getSplitRecoverySource()).toEqual(source)
    const persist = result.current.persistSplitItems, commit = result.current.commitLocalChange
    act(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a', splitItems: [first] }))
    expect(result.current.persistSplitItems).toBe(persist)
    expect(result.current.commitLocalChange).toBe(commit)
    expect(getWizardSplitRecovery()).toMatchObject({ ...source, items: [first] })
  })

  it('preserves the saved merged-sale origin after the merged view closes', () => {
    setWizardMergedSale({ netUid: 'sale-a', orderItems: [], unionSale: null })
    const { result } = renderState()
    expect(result.current.getSplitRecoverySource().origin).toBe('merged')
    act(() => result.current.persistSplitItems([first]))
    clearWizardMergedSale()
    expect(result.current.getSplitRecoverySource().origin).toBe('merged')
    act(() => result.current.persistSplitItems([{ ...first, Qty: 1 }]))
    expect(getWizardSplitRecovery()?.origin).toBe('merged')
  })

  it.each([
    { agreementNetId: null }, { agreementNetId: '   ' },
    { agreementNetId: '00000000-0000-0000-0000-000000000000' },
    { saleNetUid: undefined }, { saleNetUid: '00000000-0000-0000-0000-000000000000' }, { userKey: null },
  ])('rejects incomplete source identity %s', (patch) => {
    const { result } = renderState({ ...source, ...patch })
    expect(() => result.current.persistSplitItems([first])).toThrow()
    expect(getWizardSplitRecovery()).toBeNull()
    expect(result.current.editor?.splitItems).toEqual([])
  })

  it.each([
    { agreementNetId: 'agreement-b' }, { saleNetUid: 'sale-b' }, { userKey: 'net:user-b' },
  ])('rejects reading, overwriting and clearing another source %s', (patch) => {
    setWizardSplitOrderItems([first], 'agreement-a', source)
    const { result } = renderState({ ...source, ...patch })
    const recovery = getWizardSplitRecovery()
    expect(() => result.current.readSplitItems()).toThrow()
    expect(() => result.current.persistSplitItems([first])).toThrow()
    expect(() => result.current.persistSplitItems([])).toThrow()
    expect(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: patch.agreementNetId ?? 'agreement-a', splitItems: [] })).toThrow()
    expect(getWizardSplitRecovery()).toEqual(recovery)
    expect(result.current.editor?.splitItems).toEqual([])
  })

  it('writes recovery before projecting a local commit and preserves omitted editor fields', () => {
    const { result } = renderState()
    act(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a', splitItems: [first] }))
    expect(result.current.editor).toEqual({ isSplit: false, selected: { list: 'current', index: 1 }, splitItems: [first] })
    expect(getWizardSplitRecovery()?.items).toEqual([first])
    act(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a', splitItems: [first], isSplit: true, selected: { list: 'split', index: 0 } }))
    act(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a', splitItems: [], isSplit: false, selected: null }))
    expect(result.current.editor).toEqual({ isSplit: false, selected: null, splitItems: [] })
    expect(getWizardSplitRecovery()).toBeNull()
    expect(hydrateWizardSplitRecovery(source.userKey)).toBeNull()
  })

  it.each(['update', 'clear'] as const)('keeps persisted and visible items intact when %s storage fails', (operation) => {
    const { result } = renderState()
    act(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a', splitItems: [first] }))
    const editor = result.current.editor, recovery = getWizardSplitRecovery()
    storage.failNextLocalStorage('setItem')
    expect(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a',
      splitItems: operation === 'clear' ? [] : [{ ...first, Qty: 1 }], isSplit: true, selected: null,
    })).toThrow()
    expect(result.current.editor).toBe(editor)
    expect(getWizardSplitRecovery()).toEqual(recovery)
    expect(hydrateWizardSplitRecovery(source.userKey)?.items).toEqual([first])
  })

  it('recovers the original user state after hydration without exposing it to another user', () => {
    const { result, rerender } = renderState()
    act(() => result.current.persistSplitItems([first]))
    expect(hydrateWizardSplitRecovery('net:user-b')).toBeNull()
    rerender({ ...source, userKey: 'net:user-b' })
    expect(result.current.readSplitItems()).toEqual([])
    hydrateWizardSplitRecovery(source.userKey)
    expect(() => result.current.readSplitItems()).toThrow()
    rerender(source)
    expect(result.current.readSplitItems()).toEqual([first])
  })

  it('persists recovery updates while the editor is closed without reopening it', () => {
    const { result } = renderState(source, false)
    act(() => result.current.commitLocalChange({ kind: 'replace-split-items', agreementNetId: 'agreement-a', splitItems: [first], isSplit: true }))
    expect(result.current.editor).toBeNull()
    expect(result.current.readSplitItems()).toEqual([first])
  })

  it('allows clearing an already empty state without an active source', () => {
    const { result } = renderState({ agreementNetId: null, saleNetUid: undefined, userKey: null })
    expect(() => result.current.persistSplitItems([])).not.toThrow()
    expect(getWizardSplitRecovery()).toBeNull()
  })
})
