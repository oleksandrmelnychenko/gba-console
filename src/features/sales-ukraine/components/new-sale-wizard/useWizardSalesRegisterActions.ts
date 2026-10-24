import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSalesUkraineSaleAudit } from '../../../../shared/sale-audit/saleAuditApi'
import type { SaleAuditStatistic } from '../../../../shared/sale-audit/saleAuditTypes'
import { getSaleActProtocolEditDocument, getSaleById, getSalesUkraineEditDetails,
  getSalesUkraineSaleAuditEditActDocument, updateSale } from '../../api/salesUkraineApi'
import type { SaleDocumentResult, SalesUkraineSale } from '../../types'
import { usePersistentSaleJsonMutationRunner } from '../../usePersistentSaleJsonMutation'
import { bumpWizardDebtRefresh } from './newSaleWizardState'
import type { WizardSaleRegisterStatistic } from './wizardClientStepApi'

type SaleSession = { sale: SalesUkraineSale; generation: number }
type PendingSession = SaleSession & { promise?: Promise<void> }
type ActionState = {
  edit: SaleSession | null
  details: SaleSession | null
  merged: SaleSession | null
  audit: PendingSession | null
  auditStatistic: SaleAuditStatistic | null
  auditError: string | null
  isAuditLoading: boolean
  print: PendingSession | null
  printState: { document: SaleDocumentResult | null; isLoading: boolean } | null
  isOrderedProductsOpen: boolean
}
const EMPTY_STATE: ActionState = {
  edit: null, details: null, merged: null, audit: null, auditStatistic: null,
  auditError: null, isAuditLoading: false, print: null, printState: null, isOrderedProductsOpen: false,
}
type Options = {
  clientKey: string | null
  canConvertMergedToBill: boolean
  canEdit: boolean
  canOpenDeliveryDetails: boolean
  canOpenDetails: boolean
  canViewAudit: boolean
  permissionScopedSalesUkraineApi: boolean
  onOpenSale: (sale: SalesUkraineSale) => void
  onCreateMergedMainClientSale?: (sale: SalesUkraineSale) => void
  onEditMergedSale?: (sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) => void
  onInvoiceMergedSale?: (sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) => void
  fetchRegister: () => Promise<void>
  refreshGroupedDebts: () => Promise<boolean>
  refreshRegistryRow: (sale: SalesUkraineSale, autoExpand: boolean, semantic?: 'audit' | 'edit') => Promise<void>
  replaceRegistryRow: (statistic: WizardSaleRegisterStatistic, autoExpand: boolean) => void
}

export function useWizardSalesRegisterActions(options: Options) {
  const { t } = useI18n()
  const runSaleUpdate = usePersistentSaleJsonMutationRunner('sale-update')
  const { clientKey, canConvertMergedToBill, canEdit, canOpenDeliveryDetails,
    canOpenDetails, canViewAudit, permissionScopedSalesUkraineApi } = options
  const contextKey = JSON.stringify([clientKey, canConvertMergedToBill, canEdit, canOpenDeliveryDetails,
    canOpenDetails, canViewAudit, permissionScopedSalesUkraineApi])
  const [model, setModel] = useState({ contextKey, state: EMPTY_STATE })
  const state = model.contextKey === contextKey ? model.state : EMPTY_STATE
  if (model.contextKey !== contextKey) setModel({ contextKey, state: EMPTY_STATE })
  const stateRef = useRef(state)
  const generationRef = useRef(0)
  const latestRef = useRef({ ...options, t, runSaleUpdate })
  useLayoutEffect(() => { latestRef.current = { ...options, t, runSaleUpdate } })
  const publish = useCallback((patch: Partial<ActionState>) => {
    const next = { ...stateRef.current, ...patch }
    stateRef.current = next
    setModel((current) => ({ ...current, state: next }))
  }, [])
  useLayoutEffect(() => {
    stateRef.current = EMPTY_STATE
    // Retire old responses and saved drawer callbacks, including A -> B -> A.
    return () => { generationRef.current += 1 }
  }, [contextKey])
  const createSession = useCallback((sale: SalesUkraineSale): SaleSession => ({ sale, generation: generationRef.current }), [])
  const isCurrent = useCallback((session: SaleSession) => session.generation === generationRef.current, [])

  const openRow = useCallback((sale: SalesUkraineSale) => {
    if (!latestRef.current.canOpenDetails) return
    if (sale.InputSaleMerges?.length) publish({ merged: createSession(sale) })
    else latestRef.current.onOpenSale(sale)
  }, [createSession, publish])
  const closeMerged = useCallback(() => publish({ merged: null }), [publish])
  const merged = state.merged
  const handleMergedEdit = useCallback((sale: SalesUkraineSale) => {
    if (!merged || !isCurrent(merged) || stateRef.current.merged !== merged || !latestRef.current.canEdit) return
    closeMerged()
    latestRef.current.onEditMergedSale?.(sale, merged.sale)
  }, [merged, isCurrent, closeMerged])
  const handleMergedInvoice = useCallback((sale: SalesUkraineSale) => {
    if (!merged || !isCurrent(merged) || stateRef.current.merged !== merged || !latestRef.current.canConvertMergedToBill) return
    closeMerged()
    latestRef.current.onInvoiceMergedSale?.(sale, merged.sale)
  }, [merged, isCurrent, closeMerged])
  const handleMergedNewSale = useCallback(() => {
    if (!merged || !isCurrent(merged) || stateRef.current.merged !== merged || !latestRef.current.canConvertMergedToBill) return
    closeMerged()
    latestRef.current.onCreateMergedMainClientSale?.(merged.sale)
  }, [merged, isCurrent, closeMerged])
  const handleMergedChanged = useCallback(() => {
    if (!merged || !isCurrent(merged) || stateRef.current.merged !== merged) return
    return latestRef.current.fetchRegister()
  }, [merged, isCurrent])

  const openEditRow = useCallback((sale: SalesUkraineSale) => {
    if (!latestRef.current.canEdit) return
    if (stateRef.current.edit?.sale.NetUid && stateRef.current.edit.sale.NetUid === sale.NetUid) return
    publish({ edit: createSession(sale) })
    return latestRef.current.refreshRegistryRow(sale, false)
  }, [createSession, publish])
  const closeEdit = useCallback(() => publish({ edit: null }), [publish])
  const edit = state.edit
  const handleShiftSaved = useCallback(async () => {
    if (!edit || !isCurrent(edit) || stateRef.current.edit !== edit) return
    closeEdit()
    bumpWizardDebtRefresh()
    void latestRef.current.refreshGroupedDebts()
    // A shift may create a child sale. Load the list first, then replace the
    // edited row with its recomputed sum from the per-sale endpoint.
    await latestRef.current.fetchRegister()
    if (isCurrent(edit)) await latestRef.current.refreshRegistryRow(edit.sale, false)
  }, [edit, isCurrent, closeEdit])

  const openDeliveryRow = useCallback((sale: SalesUkraineSale) => {
    if (latestRef.current.canOpenDeliveryDetails) publish({ details: createSession(sale) })
  }, [createSession, publish])
  const closeDetails = useCallback(() => publish({ details: null }), [publish])
  const details = state.details
  const handleDetailsSaved = useCallback(() => {
    if (!details || !isCurrent(details) || stateRef.current.details !== details) return
    closeDetails()
    return latestRef.current.fetchRegister()
  }, [details, isCurrent, closeDetails])
  const openOrderedProducts = useCallback(() => publish({ isOrderedProductsOpen: true }), [publish])
  const closeOrderedProducts = useCallback(() => publish({ isOrderedProductsOpen: false }), [publish])

  const closeAudit = useCallback(() => publish({ audit: null, auditStatistic: null, auditError: null, isAuditLoading: false }), [publish])
  const openAudit = useCallback((sale: SalesUkraineSale): Promise<void> => {
    if (!latestRef.current.canViewAudit) return Promise.resolve()
    const pending = stateRef.current.audit
    if (sale.NetUid && pending?.sale.NetUid === sale.NetUid && pending.promise) return pending.promise
    const session: PendingSession = createSession(sale)
    publish({ audit: session, auditStatistic: null, auditError: null, isAuditLoading: Boolean(sale.NetUid) })
    if (!sale.NetUid) return Promise.resolve()
    const isActive = () => isCurrent(session) && stateRef.current.audit === session
    session.promise = (async () => {
      try {
        const statistic = await getSalesUkraineSaleAudit(sale.NetUid as string)
        if (!isActive()) return
        publish({ auditStatistic: statistic })
        if (statistic?.Sale) latestRef.current.replaceRegistryRow(statistic as unknown as WizardSaleRegisterStatistic, false)
      } catch (error) {
        if (isActive()) publish({ auditError: error instanceof Error ? error.message : latestRef.current.t('Не вдалося завантажити дані') })
      } finally {
        session.promise = undefined
        if (isActive()) publish({ isAuditLoading: false })
      }
    })()
    return session.promise
  }, [createSession, isCurrent, publish])

  const closePrint = useCallback(() => publish({ print: null, printState: null }), [publish])
  const printRow = useCallback((sale: SalesUkraineSale): Promise<void> => {
    const current = latestRef.current
    const netId = sale.NetUid
    if (!current.canViewAudit || !netId) return Promise.resolve()
    const pending = stateRef.current.print
    if (pending?.sale.NetUid === netId && pending.promise) return pending.promise
    const session: PendingSession = createSession(sale)
    publish({ print: session, printState: { document: null, isLoading: true } })
    const isActive = () => isCurrent(session) && stateRef.current.print === session
    session.promise = (async () => {
      // Registry rows are partial. Always hydrate before updating the printed
      // flag, otherwise /sales/update could remove the sale's OrderPackages.
      if (current.canEdit && !sale.IsPrintedActProtocolEdit) {
        try {
          const hydrated = await (current.permissionScopedSalesUkraineApi ? getSalesUkraineEditDetails : getSaleById)(netId)
          if (!isActive()) return
          if (hydrated) {
            const attempt = await current.runSaleUpdate(`sale-update:invoice-print:${netId}`,
              { ...hydrated, IsInvoice: true, IsPrintedActProtocolEdit: true }, updateSale)
            if (!attempt.completed) throw attempt.error
          }
        } catch {
          // Mark-before-print remains best-effort. An already submitted durable
          // mutation finishes even if the user closes the preview meanwhile.
        }
      }
      if (!isActive()) return
      void latestRef.current.refreshRegistryRow(sale, true, 'audit')
      try {
        const document = await (current.permissionScopedSalesUkraineApi ? getSalesUkraineSaleAuditEditActDocument : getSaleActProtocolEditDocument)(netId)
        if (isActive()) publish({ printState: { document, isLoading: false } })
      } catch {
        if (isActive()) {
          closePrint()
          notifications.show({ color: 'red', message: latestRef.current.t('Не вдалося сформувати документ') })
        }
      }
    })().finally(() => { session.promise = undefined })
    return session.promise
  }, [createSession, isCurrent, publish, closePrint])

  return {
    editShiftSale: state.edit?.sale ?? null, detailsSale: state.details?.sale ?? null, mergedSale: state.merged?.sale ?? null,
    auditSale: state.audit?.sale ?? null, auditStatistic: state.auditStatistic, auditError: state.auditError,
    isAuditLoading: state.isAuditLoading, printState: state.printState, isOrderedProductsOpen: state.isOrderedProductsOpen,
    hasOpenOverlay: Boolean(state.edit || state.details || state.merged || state.audit || state.printState || state.isOrderedProductsOpen),
    openRow, openEditRow, openDeliveryRow, openAudit, printRow, openOrderedProducts,
    closeEdit, closeDetails, closeMerged, closeAudit, closePrint, closeOrderedProducts,
    handleShiftSaved, handleDetailsSaved, handleMergedChanged,
    handleMergedEdit: options.onEditMergedSale ? handleMergedEdit : undefined,
    handleMergedInvoice: options.onInvoiceMergedSale ? handleMergedInvoice : undefined,
    handleMergedNewSale: options.onCreateMergedMainClientSale ? handleMergedNewSale : undefined,
  }
}

export type WizardSalesRegisterActions = ReturnType<typeof useWizardSalesRegisterActions>
