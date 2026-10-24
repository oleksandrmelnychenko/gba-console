import { StrictMode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesUkraineSale } from '../../types'
import { useWizardSalesRegisterActions } from './useWizardSalesRegisterActions'

const mocks = vi.hoisted(() => ({
  audit: vi.fn(), getSale: vi.fn(), getEdit: vi.fn(), document: vi.fn(), auditDocument: vi.fn(),
  runUpdate: vi.fn(), updateSale: vi.fn(), notify: vi.fn(), bumpDebt: vi.fn(),
}))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (value: string) => value }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('../../../../shared/sale-audit/saleAuditApi', () => ({ getSalesUkraineSaleAudit: mocks.audit }))
vi.mock('../../api/salesUkraineApi', () => ({
  getSaleById: mocks.getSale, getSalesUkraineEditDetails: mocks.getEdit,
  getSaleActProtocolEditDocument: mocks.document, getSalesUkraineSaleAuditEditActDocument: mocks.auditDocument,
  updateSale: mocks.updateSale,
}))
vi.mock('../../usePersistentSaleJsonMutation', () => ({ usePersistentSaleJsonMutationRunner: () => mocks.runUpdate }))
vi.mock('./newSaleWizardState', () => ({ bumpWizardDebtRefresh: mocks.bumpDebt }))

type Options = Parameters<typeof useWizardSalesRegisterActions>[0]
const sale: SalesUkraineSale = { NetUid: 'sale-a' }
const other: SalesUkraineSale = { NetUid: 'sale-b' }
const union: SalesUkraineSale = { NetUid: 'union', InputSaleMerges: [{ InputSale: sale }] }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
function options(overrides: Partial<Options> = {}): Options {
  return {
    clientKey: 'client-a', canEdit: true, canViewAudit: true, canOpenDetails: true,
    canOpenDeliveryDetails: true, canConvertMergedToBill: true, permissionScopedSalesUkraineApi: false,
    onOpenSale: vi.fn(), onCreateMergedMainClientSale: vi.fn(), onEditMergedSale: vi.fn(), onInvoiceMergedSale: vi.fn(),
    fetchRegister: vi.fn(async () => {}), refreshGroupedDebts: vi.fn(async () => true),
    refreshRegistryRow: vi.fn(async () => {}), replaceRegistryRow: vi.fn(), ...overrides,
  }
}
function setup(overrides: Partial<Options> = {}) {
  const props = options(overrides)
  return { ...renderHook(useWizardSalesRegisterActions, { initialProps: props }), props }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.audit.mockResolvedValue({ Sale: sale })
  mocks.getSale.mockResolvedValue(sale)
  mocks.getEdit.mockResolvedValue(sale)
  mocks.runUpdate.mockResolvedValue({ completed: true, result: sale })
  mocks.document.mockResolvedValue({ pdfUrl: '/sale.pdf' })
  mocks.auditDocument.mockResolvedValue({ pdfUrl: '/audit.pdf' })
})
afterEach(cleanup)

describe('wizard register actions', () => {
  it('routes ordinary and merged sales and preserves the union in edit, invoice and new-sale callbacks', () => {
    const { result, props } = setup()
    act(() => result.current.openRow(sale))
    expect(props.onOpenSale).toHaveBeenCalledWith(sale)
    act(() => result.current.openRow(union))
    expect(result.current.mergedSale).toBe(union)
    act(() => result.current.handleMergedEdit?.(sale))
    expect(props.onEditMergedSale).toHaveBeenCalledWith(sale, union)
    expect(result.current.mergedSale).toBeNull()
    act(() => result.current.openRow(union))
    act(() => result.current.handleMergedInvoice?.(sale))
    expect(props.onInvoiceMergedSale).toHaveBeenCalledWith(sale, union)
    act(() => result.current.openRow(union))
    act(() => result.current.handleMergedNewSale?.())
    expect(props.onCreateMergedMainClientSale).toHaveBeenCalledWith(union)
  })

  it('enforces action permissions even when invoked without the registry buttons', async () => {
    const { result, props } = setup({ canEdit: false, canViewAudit: false, canOpenDetails: false, canOpenDeliveryDetails: false })
    await act(async () => {
      result.current.openRow(sale)
      result.current.openEditRow(sale)
      result.current.openDeliveryRow(sale)
      await result.current.openAudit(sale)
      await result.current.printRow(sale)
    })
    expect(props.onOpenSale).not.toHaveBeenCalled()
    expect(props.refreshRegistryRow).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
    expect(mocks.document).not.toHaveBeenCalled()
    expect(result.current.hasOpenOverlay).toBe(false)
  })

  it('uses latest host callbacks without changing stable row handlers', () => {
    const { result, rerender, props } = setup()
    const openRow = result.current.openRow
    const onOpenSale = vi.fn()
    rerender({ ...props, onOpenSale })
    expect(result.current.openRow).toBe(openRow)
    act(() => openRow(sale))
    expect(onOpenSale).toHaveBeenCalledWith(sale)
    expect(props.onOpenSale).not.toHaveBeenCalled()
  })

  it('keeps invoice creation permission separate from editing merged sales', () => {
    const { result, props, rerender } = setup({ canEdit: false })
    act(() => result.current.openRow(union))
    act(() => result.current.handleMergedEdit?.(sale))
    expect(props.onEditMergedSale).not.toHaveBeenCalled()
    act(() => result.current.handleMergedNewSale?.())
    expect(props.onCreateMergedMainClientSale).toHaveBeenCalledWith(union)
    rerender({ ...props, canEdit: true, canConvertMergedToBill: false })
    act(() => result.current.openRow(union))
    act(() => { result.current.handleMergedNewSale?.(); result.current.handleMergedInvoice?.(sale) })
    expect(props.onCreateMergedMainClientSale).toHaveBeenCalledOnce()
    expect(props.onInvoiceMergedSale).not.toHaveBeenCalled()
  })

  it('shares concurrent audit loads and updates the registry once', async () => {
    const pending = deferred<{ Sale: SalesUkraineSale }>()
    mocks.audit.mockReturnValueOnce(pending.promise)
    const { result, props } = setup()
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => { first = result.current.openAudit(sale); second = result.current.openAudit(sale) })
    expect(first).toBe(second)
    expect(mocks.audit).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve({ Sale: sale }); await first })
    expect(result.current.auditStatistic).toEqual({ Sale: sale })
    expect(result.current.isAuditLoading).toBe(false)
    expect(props.replaceRegistryRow).toHaveBeenCalledOnce()
  })

  it('invalidates the previous audit even when the next sale has no NetUid', async () => {
    const pending = deferred<{ Sale: SalesUkraineSale }>()
    mocks.audit.mockReturnValueOnce(pending.promise)
    const { result, props } = setup()
    let request!: Promise<void>
    act(() => { request = result.current.openAudit(sale) })
    await act(async () => result.current.openAudit({ Id: 2 }))
    expect(result.current.isAuditLoading).toBe(false)
    await act(async () => { pending.resolve({ Sale: sale }); await request })
    expect(result.current.auditSale).toEqual({ Id: 2 })
    expect(result.current.auditStatistic).toBeNull()
    expect(props.replaceRegistryRow).not.toHaveBeenCalled()
  })

  it('discards an older audit failure after closing and reopening the same sale', async () => {
    const old = deferred<null>()
    const current = deferred<{ Sale: SalesUkraineSale }>()
    mocks.audit.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const { result } = setup()
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => { first = result.current.openAudit(sale); result.current.closeAudit(); second = result.current.openAudit(sale) })
    await act(async () => { old.reject(new Error('old')); await first })
    expect(result.current.auditError).toBeNull()
    expect(result.current.isAuditLoading).toBe(true)
    await act(async () => { current.resolve({ Sale: sale }); await second })
    expect(result.current.auditStatistic).toEqual({ Sale: sale })
  })

  it('allows retry after audit failure and clears its error', async () => {
    mocks.audit.mockRejectedValueOnce(new Error('failed'))
    const { result } = setup()
    await act(async () => result.current.openAudit(sale))
    expect(result.current.auditError).toBe('failed')
    await act(async () => result.current.openAudit(sale))
    expect(result.current.auditError).toBeNull()
    expect(result.current.auditStatistic).toEqual({ Sale: sale })
  })

  it('shares print preparation and marks the full hydrated sale before requesting the document', async () => {
    // Full API payloads also contain fields outside the lightweight UI type.
    const order = { NetUid: 'order-a', OrderPackages: [{ Id: 42 }] }
    const hydrated: SalesUkraineSale = { ...sale, Order: order }
    const pending = deferred<SalesUkraineSale>()
    mocks.getSale.mockReturnValueOnce(pending.promise)
    const { result, props } = setup()
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => { first = result.current.printRow(sale); second = result.current.printRow(sale) })
    expect(second).toBe(first)
    expect(mocks.getSale).toHaveBeenCalledOnce()
    expect(mocks.document).not.toHaveBeenCalled()
    await act(async () => { pending.resolve(hydrated); await first })
    expect(mocks.runUpdate).toHaveBeenCalledWith('sale-update:invoice-print:sale-a',
      { ...hydrated, IsInvoice: true, IsPrintedActProtocolEdit: true }, mocks.updateSale)
    expect(mocks.runUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.document.mock.invocationCallOrder[0])
    expect(props.refreshRegistryRow).toHaveBeenCalledWith(sale, true, 'audit')
    expect(result.current.printState).toEqual({ document: { pdfUrl: '/sale.pdf' }, isLoading: false })
  })

  it('uses scoped endpoints and keeps printing when the durable flag update is not confirmed', async () => {
    mocks.runUpdate.mockResolvedValueOnce({ completed: false, error: new Error('pending') })
    const { result } = setup({ permissionScopedSalesUkraineApi: true })
    await act(async () => result.current.printRow(sale))
    expect(mocks.getEdit).toHaveBeenCalledWith('sale-a')
    expect(mocks.getSale).not.toHaveBeenCalled()
    expect(mocks.auditDocument).toHaveBeenCalledWith('sale-a')
    expect(mocks.document).not.toHaveBeenCalled()
    expect(result.current.printState?.document?.pdfUrl).toBe('/audit.pdf')
  })

  it.each([false, true])('skips hydration when read-only or already marked (alreadyPrinted=%s)', async (alreadyPrinted) => {
    const { result } = setup({ canEdit: alreadyPrinted })
    await act(async () => result.current.printRow({ ...sale, IsPrintedActProtocolEdit: alreadyPrinted }))
    expect(mocks.getSale).not.toHaveBeenCalled()
    expect(mocks.runUpdate).not.toHaveBeenCalled()
    expect(mocks.document).toHaveBeenCalledOnce()
  })

  it('does not submit a printed flag or request a document after preview closes during hydration', async () => {
    const pending = deferred<SalesUkraineSale>()
    mocks.getSale.mockReturnValueOnce(pending.promise)
    const { result, props } = setup()
    let request!: Promise<void>
    act(() => { request = result.current.printRow(sale); result.current.closePrint() })
    await act(async () => { pending.resolve(sale); await request })
    expect(mocks.runUpdate).not.toHaveBeenCalled()
    expect(mocks.document).not.toHaveBeenCalled()
    expect(props.refreshRegistryRow).not.toHaveBeenCalled()
    expect(result.current.printState).toBeNull()
  })

  it('allows an already submitted update to finish but stops the remaining print work after unmount', async () => {
    const pending = deferred<{ completed: true; result: SalesUkraineSale }>()
    mocks.runUpdate.mockReturnValueOnce(pending.promise)
    const { result, unmount, props } = setup()
    let request!: Promise<void>
    await act(async () => { request = result.current.printRow(sale) })
    expect(mocks.runUpdate).toHaveBeenCalledOnce()
    unmount()
    await act(async () => { pending.resolve({ completed: true, result: sale }); await request })
    expect(mocks.document).not.toHaveBeenCalled()
    expect(props.refreshRegistryRow).not.toHaveBeenCalled()
  })

  it('ignores stale document failures and only reports the current print error', async () => {
    const old = deferred<never>()
    mocks.document.mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error('current'))
    const { result } = setup({ canEdit: false })
    let first!: Promise<void>
    act(() => { first = result.current.printRow(sale) })
    await act(async () => result.current.printRow(other))
    expect(mocks.notify).toHaveBeenCalledOnce()
    await act(async () => { old.reject(new Error('old')); await first })
    expect(mocks.notify).toHaveBeenCalledOnce()
    expect(result.current.printState).toBeNull()
  })

  it('refreshes debts and the whole register before fetching the edited row, without repeating save', async () => {
    const pending = deferred<void>()
    const { result, props } = setup({ fetchRegister: vi.fn(() => pending.promise) })
    await act(async () => { await result.current.openEditRow(sale); await result.current.openEditRow(sale) })
    expect(props.refreshRegistryRow).toHaveBeenCalledOnce()
    let saved!: Promise<void>
    const onSaved = result.current.handleShiftSaved
    act(() => { saved = onSaved(); void onSaved() })
    expect(mocks.bumpDebt).toHaveBeenCalledOnce()
    expect(props.refreshGroupedDebts).toHaveBeenCalledOnce()
    expect(props.fetchRegister).toHaveBeenCalledOnce()
    expect(result.current.editShiftSale).toBeNull()
    expect(props.refreshRegistryRow).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve(); await saved })
    expect(props.refreshRegistryRow).toHaveBeenCalledTimes(2)
    expect(props.refreshRegistryRow).toHaveBeenLastCalledWith(sale, false)
  })

  it('does not refresh an edited row in a different client register after the list finishes', async () => {
    const pending = deferred<void>()
    const { result, props, rerender } = setup({ fetchRegister: vi.fn(() => pending.promise) })
    await act(async () => result.current.openEditRow(sale))
    let saved!: Promise<void>
    act(() => { saved = result.current.handleShiftSaved() })
    rerender({ ...props, clientKey: 'client-b' })
    await act(async () => { pending.resolve(); await saved })
    expect(props.refreshRegistryRow).toHaveBeenCalledOnce()
  })

  it('rejects callbacks from closed edit, delivery and merged drawers', async () => {
    const { result, props } = setup()
    await act(async () => { await result.current.openEditRow(sale); result.current.openDeliveryRow(sale); result.current.openRow(union) })
    const old = result.current
    act(() => { old.closeEdit(); old.closeDetails(); old.closeMerged() })
    await act(async () => {
      await old.handleShiftSaved()
      await old.handleDetailsSaved()
      await old.handleMergedChanged()
      old.handleMergedEdit?.(sale)
      old.handleMergedInvoice?.(sale)
      old.handleMergedNewSale?.()
    })
    expect(props.fetchRegister).not.toHaveBeenCalled()
    expect(props.onEditMergedSale).not.toHaveBeenCalled()
    expect(props.onInvoiceMergedSale).not.toHaveBeenCalled()
    expect(props.onCreateMergedMainClientSale).not.toHaveBeenCalled()
  })

  it('refreshes saved delivery details and merged changes once per current callback', async () => {
    const { result, props } = setup()
    act(() => result.current.openDeliveryRow(sale))
    const saved = result.current.handleDetailsSaved
    await act(async () => { await saved(); await saved() })
    expect(result.current.detailsSale).toBeNull()
    expect(props.fetchRegister).toHaveBeenCalledOnce()
    act(() => result.current.openRow(union))
    await act(async () => result.current.handleMergedChanged())
    expect(props.fetchRegister).toHaveBeenCalledTimes(2)
  })

  it('clears overlays and fences A-B-A client responses, including StrictMode remount cleanup', async () => {
    const pending = deferred<{ Sale: SalesUkraineSale }>()
    mocks.audit.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender } = renderHook(useWizardSalesRegisterActions, { initialProps: props, wrapper: StrictMode })
    let request!: Promise<void>
    act(() => { request = result.current.openAudit(sale); result.current.openOrderedProducts() })
    expect(result.current.hasOpenOverlay).toBe(true)
    rerender({ ...props, clientKey: 'client-b' })
    rerender(props)
    await act(async () => { pending.resolve({ Sale: sale }); await request })
    expect(result.current.hasOpenOverlay).toBe(false)
    expect(props.replaceRegistryRow).not.toHaveBeenCalled()
    await act(async () => result.current.openAudit(other))
    expect(result.current.auditSale).toBe(other)
    expect(result.current.isAuditLoading).toBe(false)
  })

  it('retires pending print work when permissions change', async () => {
    const pending = deferred<SalesUkraineSale>()
    mocks.getSale.mockReturnValueOnce(pending.promise)
    const { result, props, rerender } = setup()
    let request!: Promise<void>
    act(() => { request = result.current.printRow(sale) })
    rerender({ ...props, canEdit: false })
    await act(async () => { pending.resolve(sale); await request })
    expect(mocks.runUpdate).not.toHaveBeenCalled()
    expect(mocks.document).not.toHaveBeenCalled()
    expect(result.current.hasOpenOverlay).toBe(false)
  })
})
