import { useSyncExternalStore } from 'react'
import type { SalesUkraineClientAgreement, SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import type { WizardDeliveryRecipient, WizardDeliveryRecipientAddress } from './newSaleWizardApi'
import type {
  WizardPendingSplitExtraction,
  WizardSplitMutationSnapshot,
  WizardSplitOrderItem,
  WizardSplitRecoverySource,
} from './wizardSplitSale'

export const SELF_CHECKOUT_CLASS = 'self_checkout_item_class'

export type NewSaleReviewValue = {
  address: WizardDeliveryRecipientAddress | null
  addressValue: string
  city: string
  codAmount: number | string
  comment: string
  department: string
  hasOwnTtn: boolean
  isNewAddress: boolean
  isNewRecipient: boolean
  isCashOnDelivery: boolean
  mobilePhone: string
  recipient: WizardDeliveryRecipient | null
  recipientName: string
  transporter: SalesUkraineTransporter | null
  ttnFile: File | null
  ttnNumber: string
}

export const NEW_SALE_REVIEW_INITIAL: NewSaleReviewValue = {
  address: null,
  addressValue: '',
  city: '',
  codAmount: '',
  comment: '',
  department: '',
  hasOwnTtn: false,
  isNewAddress: false,
  isNewRecipient: false,
  isCashOnDelivery: false,
  mobilePhone: '',
  recipient: null,
  recipientName: '',
  transporter: null,
  ttnFile: null,
  ttnNumber: '',
}

export function isSelfCheckout(transporter: SalesUkraineTransporter | null): boolean {
  return transporter?.CssClass === SELF_CHECKOUT_CLASS
}

export type NewSaleWizardStepIndex = 0 | 1 | 2

export type NewSaleWizardState = {
  agreement: SalesUkraineClientAgreement | null
  agreementNetId: string | null
  clientNetId: string | null
  sale: SalesUkraineSale | null
}

export const NEW_SALE_WIZARD_INITIAL: NewSaleWizardState = {
  agreement: null,
  agreementNetId: null,
  clientNetId: null,
  sale: null,
}

export function canAdvanceToProducts(state: NewSaleWizardState): boolean {
  return Boolean(state.clientNetId && state.agreementNetId)
}

export function canAdvanceToReview(state: NewSaleWizardState): boolean {
  return Boolean(state.sale?.NetUid)
}

export function getCartItemCount(sale: SalesUkraineSale | null): number {
  return Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems.length : 0
}

export function isWizardShellBusy(busy: boolean, productsBusy: boolean, reviewBusy: boolean): boolean {
  return busy || productsBusy || reviewBusy
}

const WIZARD_SPLIT_RECOVERY_STORAGE_KEY = 'gba_console:wizard-split-recovery:v1'
const LEGACY_WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX = 'gba_console:wizard-split-recovery:v2:'
const WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX = 'gba_console:wizard-split-recovery:v3:'
const WIZARD_SPLIT_CORRUPTION_STORAGE_PREFIX = 'gba_console:wizard-split-corruption:v1:'
const WIZARD_SPLIT_OWNER_SESSION_KEY = 'gba_console:wizard-split-owner:v1'
const WIZARD_SPLIT_OWNER_RUNTIME_ID = createWizardSplitOwnerId()
const WIZARD_SPLIT_RECOVERY_VERSION = 2
export const WIZARD_SPLIT_RECOVERY_LEASE_MS = 15_000

export type WizardSplitRecovery = WizardSplitRecoverySource & {
  fencingToken: string
  finalMutation?: WizardSplitFinalMutation
  generation: number
  items: WizardSplitOrderItem[]
  ownerId: string
  ownerUpdatedAt: number
  pendingExtraction?: WizardPendingSplitExtraction
  recordType: 'active'
  splitOperationId: string
  updatedAt: number
  version: typeof WIZARD_SPLIT_RECOVERY_VERSION
}

export type WizardSplitFinalMutation = {
  context: string
  fencingToken?: string
  generation?: number
  kind: 'create-sale' | 'sale-update-file' | 'sale-vat-document'
  operationId: string
  ownerId: string
  ownerUpdatedAt: number
  phase: 'prepared' | 'submitted' | 'unknown'
  userKey: string
}

type WizardSplitRecoveryTombstone = WizardSplitRecoverySource & {
  fencingToken: string
  generation: number
  operationIds: string[]
  ownerId: string
  recordType: 'resolved'
  resolvedAt: number
  splitOperationId: string
  version: typeof WIZARD_SPLIT_RECOVERY_VERSION
}

type WizardSplitRecoveryRecord = WizardSplitRecovery | WizardSplitRecoveryTombstone

type StoredWizardSplitRecoveries = {
  entries: WizardSplitRecovery[]
  version: typeof WIZARD_SPLIT_RECOVERY_VERSION
}

export class WizardSplitRecoveryStorageError extends Error {
  constructor() {
    super('Браузер не дозволив надійно зберегти розділення. Зміни рахунку не надіслано; звільніть local storage або дозвольте його використання й повторіть дію.')
    this.name = 'WizardSplitRecoveryStorageError'
  }
}

export class WizardSplitRecoveryFenceError extends Error {
  constructor() {
    super('Координація розділення перейшла до іншої вкладки. Застаріла вкладка не може відновлювати, відправляти або очищати дані')
    this.name = 'WizardSplitRecoveryFenceError'
  }
}

export class WizardSplitRecoveryCorruptionError extends Error {
  constructor() {
    super('Журнал розділення пошкоджений. Дані збережено для ручної звірки; автоматичне відновлення заблоковано')
    this.name = 'WizardSplitRecoveryCorruptionError'
  }
}

let splitOrderItems: WizardSplitOrderItem[] = []
let splitAgreementNetId: string | null = null
let splitRecovery: WizardSplitRecovery | null = null
const fencedSplitRecoveryIdentities = new Set<string>()
const fencedWizardSplitOperationIds = new Set<string>()

const splitOrderItemsListeners = new Set<() => void>()

export function getWizardSplitOrderItems(): WizardSplitOrderItem[] {
  return splitOrderItems
}

export function getWizardSplitAgreementNetId(): string | null {
  return splitAgreementNetId
}

export function getWizardSplitRecovery(): WizardSplitRecovery | null {
  return splitRecovery
}

export function hasWizardSplitOrderItems(): boolean {
  return splitOrderItems.length > 0
}

export function setWizardSplitOrderItems(
  items: WizardSplitOrderItem[],
  agreementNetId: string | null,
  source?: WizardSplitRecoverySource,
): void {
  const recoverySource = source ?? (splitRecovery ? toWizardSplitRecoverySource(splitRecovery) : null)

  if (items.length > 0 && !recoverySource) {
    throw new Error('Durable split recovery source is required before storing split items')
  }

  if (items.length > 0 && recoverySource) {
    if (splitRecovery && !hasSameWizardSplitRecoverySource(splitRecovery, recoverySource)) {
      throw new Error('An unresolved split recovery exists for another source sale')
    }

    if (normalizeNetUid(recoverySource.agreementNetId) !== normalizeNetUid(agreementNetId)) {
      throw new Error('Split recovery agreement does not match the active split items')
    }

    const identity = getWizardSplitRecoveryIdentity(recoverySource)
    let current: WizardSplitRecovery

    if (splitRecovery) {
      current = assertDurableWizardSplitFence(splitRecovery)
    } else {
      if (fencedSplitRecoveryIdentities.has(identity)) {
        throw new WizardSplitRecoveryFenceError()
      }

      const record = readWizardSplitRecoveryRecordBySource(recoverySource)

      if (record?.recordType === 'active') {
        if (record.ownerId !== getWizardSplitRecoveryOwnerId()) {
          throw new Error('An unresolved split recovery for this source sale is owned by another tab')
        }

        current = record
      } else {
        current = createWizardSplitRecovery(recoverySource, items, undefined, {
          generation: (record?.generation ?? 0) + 1,
          splitOperationId: getInitialWizardSplitOperationId(items),
        })
        writeWizardSplitRecoveryRecord(current, record)
      }
    }

    const nextRecovery = cloneValue({
      ...current,
      items,
      ownerUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    })
    writeWizardSplitRecoveryRecord(nextRecovery, current)
    setLocalWizardSplitRecovery(nextRecovery)
    return
  } else if (items.length === 0) {
    resolveCurrentWizardSplitRecovery()
    return
  }

}

export function clearWizardSplitOrderItems(): void {
  resolveCurrentWizardSplitRecovery()
}

export function stageWizardSplitFinalMutation(
  mutation: Omit<WizardSplitFinalMutation, 'ownerId' | 'ownerUpdatedAt' | 'phase'>,
): boolean {
  if (!splitRecovery) {
    return false
  }

  const durableRecovery = assertDurableWizardSplitFence(splitRecovery)
  const ownerId = getWizardSplitRecoveryOwnerId()

  const normalized = normalizeWizardSplitFinalMutation({
    ...mutation,
    ownerId,
    ownerUpdatedAt: Date.now(),
    phase: 'prepared',
  })

  if (normalized.userKey !== normalizeIdentity(durableRecovery.userKey)) {
    throw new Error('Final sale mutation user does not match the split recovery owner')
  }

  if (
    durableRecovery.finalMutation &&
    (
      durableRecovery.finalMutation.operationId !== normalized.operationId ||
      durableRecovery.finalMutation.context !== normalized.context ||
      durableRecovery.finalMutation.kind !== normalized.kind
    )
  ) {
    throw new Error('Another final sale mutation is already linked to the split recovery')
  }

  if (durableRecovery.finalMutation) {
    const existing = durableRecovery.finalMutation

    if (
      existing.fencingToken && normalized.fencingToken &&
      (
        existing.fencingToken !== normalized.fencingToken ||
        existing.generation !== normalized.generation
      )
    ) {
      // A reopened tab may take both the split lease and the mutation lease.
      // The split generation above fences the former owner; the same operation
      // may then adopt the new registry fence without changing its phase.
      const nextRecovery = cloneValue({
        ...durableRecovery,
        finalMutation: { ...existing, ...normalized, phase: existing.phase },
        updatedAt: Date.now(),
      })
      writeWizardSplitRecoveryRecord(nextRecovery, durableRecovery)
      setLocalWizardSplitRecovery(nextRecovery)

      return true
    }

    setLocalWizardSplitRecovery(durableRecovery)

    return true
  }

  const nextRecovery = cloneValue({
    ...durableRecovery,
    finalMutation: normalized,
    updatedAt: Date.now(),
  })
  writeWizardSplitRecoveryRecord(nextRecovery, durableRecovery)
  const verifiedRecovery = readWizardSplitRecoveryRecordBySource(nextRecovery)

  if (
    verifiedRecovery?.recordType !== 'active' ||
    !verifiedRecovery.finalMutation ||
    verifiedRecovery.finalMutation.operationId !== normalized.operationId
  ) {
    fenceLocalWizardSplitRecovery(durableRecovery)
    throw new WizardSplitRecoveryFenceError()
  }

  setLocalWizardSplitRecovery(verifiedRecovery)

  return true
}

export function markWizardSplitFinalMutationSubmitted(
  operationId: string,
  fence?: Pick<WizardSplitFinalMutation, 'fencingToken' | 'generation'>,
): boolean {
  return updateWizardSplitFinalMutationPhase(operationId, 'submitted', fence)
}

export function markWizardSplitFinalMutationUnknown(
  operationId: string,
  fence?: Pick<WizardSplitFinalMutation, 'fencingToken' | 'generation'>,
): boolean {
  return updateWizardSplitFinalMutationPhase(operationId, 'unknown', fence)
}

function updateWizardSplitFinalMutationPhase(
  operationId: string,
  phase: Extract<WizardSplitFinalMutation['phase'], 'submitted' | 'unknown'>,
  fence?: Pick<WizardSplitFinalMutation, 'fencingToken' | 'generation'>,
): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const durableRecovery = splitRecovery ? assertDurableWizardSplitFence(splitRecovery) : null

  if (
    !durableRecovery?.finalMutation ||
    normalizeNetUid(durableRecovery.finalMutation.operationId) !== normalizedOperationId
  ) {
    if (durableRecovery) {
      throw new Error('Фінальна операція втратила durable ownership між вкладками. Запит не надіслано')
    }

    return false
  }

  assertWizardSplitFinalMutationFence(durableRecovery.finalMutation, fence)

  if (durableRecovery.finalMutation.phase === phase) {
    setLocalWizardSplitRecovery(durableRecovery)

    return true
  }

  const nextRecovery = cloneValue({
    ...durableRecovery,
    finalMutation: {
      ...durableRecovery.finalMutation,
      ownerId: getWizardSplitRecoveryOwnerId(),
      ownerUpdatedAt: Date.now(),
      phase,
    },
    updatedAt: Date.now(),
  })
  writeWizardSplitRecoveryRecord(nextRecovery, durableRecovery)
  setLocalWizardSplitRecovery(nextRecovery)

  return true
}

export function clearWizardSplitFinalMutation(operationId: string): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const durableRecovery = splitRecovery ? assertDurableWizardSplitFence(splitRecovery) : null

  if (
    !durableRecovery?.finalMutation ||
    normalizeNetUid(durableRecovery.finalMutation.operationId) !== normalizedOperationId
  ) {
    return false
  }

  if (durableRecovery.finalMutation.phase !== 'prepared') {
    throw new Error('Submitted split mutation cannot be released or restored without server ledger proof')
  }

  const nextRecovery = cloneValue({
    ...durableRecovery,
    finalMutation: undefined,
    updatedAt: Date.now(),
  }) as WizardSplitRecovery
  writeWizardSplitRecoveryRecord(nextRecovery, durableRecovery)
  setLocalWizardSplitRecovery(nextRecovery)

  return true
}

/** Clears a submitted final mutation only after the server definitively rejected it before commit. */
export function rejectWizardSplitFinalMutation(
  operationId: string,
  fence: Pick<WizardSplitFinalMutation, 'fencingToken' | 'generation'>,
): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const durableRecovery = splitRecovery ? assertDurableWizardSplitFence(splitRecovery) : null

  if (
    !durableRecovery?.finalMutation ||
    normalizeNetUid(durableRecovery.finalMutation.operationId) !== normalizedOperationId
  ) {
    return false
  }

  assertWizardSplitFinalMutationFence(durableRecovery.finalMutation, fence)
  const nextRecovery = cloneValue({
    ...durableRecovery,
    finalMutation: undefined,
    updatedAt: Date.now(),
  }) as WizardSplitRecovery
  writeWizardSplitRecoveryRecord(nextRecovery, durableRecovery)
  setLocalWizardSplitRecovery(nextRecovery)

  return true
}

export function confirmWizardSplitFinalMutationCommitted(
  operationId: string,
  fence?: Pick<WizardSplitFinalMutation, 'fencingToken' | 'generation'>,
): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const durableRecovery = splitRecovery ? assertDurableWizardSplitFence(splitRecovery) : null

  if (
    !durableRecovery?.finalMutation ||
    normalizeNetUid(durableRecovery.finalMutation.operationId) !== normalizedOperationId
  ) {
    return false
  }

  assertWizardSplitFinalMutationFence(durableRecovery.finalMutation, fence)
  resolveWizardSplitRecovery(durableRecovery)

  return true
}

/** Explicit operator resolution when the server was checked outside this journal. */
export function confirmWizardSplitFinalMutationManuallyCommitted(operationId: string): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const durableRecovery = splitRecovery ? assertDurableWizardSplitFence(splitRecovery) : null

  if (
    !durableRecovery?.finalMutation ||
    normalizeNetUid(durableRecovery.finalMutation.operationId) !== normalizedOperationId
  ) {
    return false
  }

  resolveWizardSplitRecovery(durableRecovery)

  return true
}

export function hydrateWizardSplitRecovery(userKey: string): WizardSplitRecovery | null {
  const normalizedUserKey = normalizeIdentity(userKey)
  const candidates = normalizedUserKey
    ? readWizardSplitRecoveries().entries.filter((entry) => (
        entry.userKey === normalizedUserKey &&
        !fencedSplitRecoveryIdentities.has(getWizardSplitRecoveryIdentity(entry))
      ))
    : []
  const current = splitRecovery && splitRecovery.userKey === normalizedUserKey
    ? candidates.find((entry) => hasSameWizardSplitRecoverySource(entry, splitRecovery as WizardSplitRecovery))
    : null
  const recovery = current ?? candidates.sort(compareWizardSplitRecoveries)[0] ?? null

  setLocalWizardSplitRecovery(recovery)

  return splitRecovery
}

export function claimWizardSplitRecoveryOwnership(
  recovery: WizardSplitRecovery,
  now: number = Date.now(),
): WizardSplitRecovery | null {
  const identity = getWizardSplitRecoveryIdentity(recovery)

  if (fencedSplitRecoveryIdentities.has(identity)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const record = readWizardSplitRecoveryRecordBySource(recovery)

  if (!record || record.recordType !== 'active') {
    return null
  }

  const durableRecovery = record

  if (
    durableRecovery.generation !== recovery.generation ||
    durableRecovery.fencingToken !== recovery.fencingToken
  ) {
    fenceLocalWizardSplitRecovery(recovery)
    throw new WizardSplitRecoveryFenceError()
  }

  const ownerId = getWizardSplitRecoveryOwnerId()
  const ownedByCurrentTab = durableRecovery.ownerId === ownerId
  const ownerLeaseExpired = now - durableRecovery.ownerUpdatedAt >= WIZARD_SPLIT_RECOVERY_LEASE_MS

  if (!ownedByCurrentTab && !ownerLeaseExpired) {
    return null
  }

  const takeover = !ownedByCurrentTab
  const claimed = cloneValue({
    ...durableRecovery,
    fencingToken: takeover ? createWizardSplitFencingToken(durableRecovery.generation + 1) : durableRecovery.fencingToken,
    generation: takeover ? durableRecovery.generation + 1 : durableRecovery.generation,
    ownerId,
    ownerUpdatedAt: now,
    updatedAt: Math.max(durableRecovery.updatedAt, now),
  })
  writeWizardSplitRecoveryRecord(claimed, durableRecovery)
  const verifiedRecovery = readWizardSplitRecoveryRecordBySource(claimed)

  if (
    verifiedRecovery?.recordType !== 'active' ||
    verifiedRecovery.ownerId !== ownerId ||
    verifiedRecovery.generation !== claimed.generation ||
    verifiedRecovery.fencingToken !== claimed.fencingToken
  ) {
    fenceLocalWizardSplitRecovery(recovery)
    return null
  }

  setLocalWizardSplitRecovery(verifiedRecovery)

  return cloneValue(verifiedRecovery)
}

export function refreshWizardSplitRecoveryOwnership(now: number = Date.now()): boolean {
  if (!splitRecovery || splitRecovery.ownerId !== getWizardSplitRecoveryOwnerId()) {
    return false
  }

  try {
    return claimWizardSplitRecoveryOwnership(splitRecovery, now) !== null
  } catch (error) {
    if (error instanceof WizardSplitRecoveryFenceError) {
      return false
    }

    throw error
  }
}

export function stageWizardSplitExtraction({
  fallbackItems,
  items,
  mutation,
  source,
}: {
  fallbackItems: WizardSplitOrderItem[]
  items: WizardSplitOrderItem[]
  mutation: WizardSplitMutationSnapshot
  source: WizardSplitRecoverySource
}): WizardSplitRecovery {
  if (splitRecovery && !hasSameWizardSplitRecoverySource(splitRecovery, source)) {
    throw new Error('An unresolved split recovery exists for another source sale')
  }

  const identity = getWizardSplitRecoveryIdentity(source)
  const operationId = normalizeNetUid(mutation.operationId)
  let current: WizardSplitRecovery

  if (splitRecovery) {
    current = assertDurableWizardSplitFence(splitRecovery)
  } else {
    if (fencedSplitRecoveryIdentities.has(identity)) {
      throw new WizardSplitRecoveryFenceError()
    }

    const record = readWizardSplitRecoveryRecordBySource(source)

    if (record?.recordType === 'active') {
      if (record.ownerId !== getWizardSplitRecoveryOwnerId()) {
        throw new Error('An unresolved split recovery for this source sale is owned by another tab')
      }

      current = record
    } else {
      if (record?.operationIds.includes(operationId)) {
        throw new WizardSplitRecoveryFenceError()
      }

      current = createWizardSplitRecovery(source, items, { fallbackItems, mutation, phase: 'prepared' }, {
        generation: (record?.generation ?? 0) + 1,
        splitOperationId: operationId,
      })
      writeWizardSplitRecoveryRecord(current, record)
      setLocalWizardSplitRecovery(current)

      return current
    }
  }

  const nextRecovery = cloneValue({
    ...current,
    items,
    pendingExtraction: { fallbackItems, mutation, phase: 'prepared' as const },
    ownerUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  })
  writeWizardSplitRecoveryRecord(nextRecovery, current)
  setLocalWizardSplitRecovery(nextRecovery)

  return nextRecovery
}

export function commitWizardSplitExtraction(operationId: string): boolean {
  if (fencedWizardSplitOperationIds.has(normalizeNetUid(operationId))) {
    throw new WizardSplitRecoveryFenceError()
  }

  const recovery = assertWizardSplitRecoveryOwnedByCurrentTab()

  if (
    !recovery?.pendingExtraction ||
    normalizeNetUid(recovery.pendingExtraction.mutation.operationId) !== normalizeNetUid(operationId)
  ) {
    return false
  }

  const nextRecovery = cloneValue({ ...recovery, pendingExtraction: undefined, updatedAt: Date.now() }) as WizardSplitRecovery
  writeWizardSplitRecoveryRecord(nextRecovery, recovery)
  setLocalWizardSplitRecovery(nextRecovery)

  return true
}

export function markWizardSplitExtractionSubmitted(operationId: string): boolean {
  return transitionWizardSplitExtractionPhase(operationId, 'submitted')
}

export function markWizardSplitExtractionUnknown(operationId: string): boolean {
  return transitionWizardSplitExtractionPhase(operationId, 'unknown')
}

function transitionWizardSplitExtractionPhase(
  operationId: string,
  phase: WizardPendingSplitExtraction['phase'],
): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const recovery = assertWizardSplitRecoveryOwnedByCurrentTab()

  if (
    !recovery?.pendingExtraction ||
    normalizeNetUid(recovery.pendingExtraction.mutation.operationId) !== normalizedOperationId
  ) {
    return false
  }

  if (phase === 'unknown' && recovery.pendingExtraction.phase === 'prepared') {
    throw new Error('A split extraction cannot become unknown before submission')
  }

  if (recovery.pendingExtraction.phase === phase) {
    return true
  }

  const nextRecovery = cloneValue({
    ...recovery,
    pendingExtraction: { ...recovery.pendingExtraction, phase },
    updatedAt: Date.now(),
  }) as WizardSplitRecovery
  writeWizardSplitRecoveryRecord(nextRecovery, recovery)
  setLocalWizardSplitRecovery(nextRecovery)

  return true
}

export function rollbackWizardSplitExtraction(operationId: string): boolean {
  if (fencedWizardSplitOperationIds.has(normalizeNetUid(operationId))) {
    throw new WizardSplitRecoveryFenceError()
  }

  const recovery = assertWizardSplitRecoveryOwnedByCurrentTab()

  if (
    !recovery?.pendingExtraction ||
    normalizeNetUid(recovery.pendingExtraction.mutation.operationId) !== normalizeNetUid(operationId)
  ) {
    return false
  }

  if (recovery.pendingExtraction.phase !== 'prepared') {
    throw new Error('Submitted split extraction requires server reconciliation or manual resolution')
  }

  if (recovery.pendingExtraction.fallbackItems.length === 0) {
    resolveWizardSplitRecovery(recovery)
    return true
  }

  const nextRecovery = cloneValue({
    ...recovery,
    items: recovery.pendingExtraction.fallbackItems,
    pendingExtraction: undefined,
    updatedAt: Date.now(),
  }) as WizardSplitRecovery
  writeWizardSplitRecoveryRecord(nextRecovery, recovery)
  setLocalWizardSplitRecovery(nextRecovery)

  return true
}

function assertWizardSplitRecoveryOwnedByCurrentTab(): WizardSplitRecovery | null {
  if (!splitRecovery) {
    return null
  }

  return assertDurableWizardSplitFence(splitRecovery)
}

export function hasWizardSplitRecoveryOperation(operationId: string): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (!normalizedOperationId || !splitRecovery) {
    return false
  }

  return normalizeNetUid(splitRecovery.pendingExtraction?.mutation.operationId) === normalizedOperationId ||
    splitRecovery.items.some((item) => normalizeNetUid(item.RestoreMutation?.operationId) === normalizedOperationId)
}

export function assertWizardSplitRecoveryOperationFence(operationId: string): boolean {
  const normalizedOperationId = normalizeNetUid(operationId)

  if (fencedWizardSplitOperationIds.has(normalizedOperationId)) {
    throw new WizardSplitRecoveryFenceError()
  }

  if (!splitRecovery) {
    return false
  }

  const durable = assertDurableWizardSplitFence(splitRecovery)

  return normalizeNetUid(durable.pendingExtraction?.mutation.operationId) === normalizedOperationId ||
    durable.items.some((item) => normalizeNetUid(item.RestoreMutation?.operationId) === normalizedOperationId)
}

export function clearAllWizardSplitRecoveries(): void {
  splitRecovery = null
  splitOrderItems = []
  splitAgreementNetId = null

  const storage = getWizardSplitRecoveryStorage()

  for (const key of listWizardSplitStorageKeys(storage)) {
    if (
      key === WIZARD_SPLIT_RECOVERY_STORAGE_KEY ||
      key.startsWith(LEGACY_WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX) ||
      key.startsWith(WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX) ||
      key.startsWith(WIZARD_SPLIT_CORRUPTION_STORAGE_PREFIX)
    ) {
      tryRemoveWizardSplitStorageItem(storage, key)
    }
  }

  fencedSplitRecoveryIdentities.clear()
  fencedWizardSplitOperationIds.clear()
  notifyWizardSplitListeners()
}

export function subscribeWizardSplitOrderItems(listener: () => void): () => void {
  splitOrderItemsListeners.add(listener)
  installWizardSplitStorageListener()

  return () => {
    splitOrderItemsListeners.delete(listener)

    if (splitOrderItemsListeners.size === 0) {
      uninstallWizardSplitStorageListener()
    }
  }
}

export function useWizardSplitOrderItems(): WizardSplitOrderItem[] {
  return useSyncExternalStore(subscribeWizardSplitOrderItems, getWizardSplitOrderItems)
}

function createWizardSplitRecovery(
  source: WizardSplitRecoverySource,
  items: WizardSplitOrderItem[],
  pendingExtraction?: WizardPendingSplitExtraction,
  identity?: { generation: number; splitOperationId: string },
): WizardSplitRecovery {
  const ownerId = getWizardSplitRecoveryOwnerId()
  const generation = identity?.generation ?? 1
  const splitOperationId = normalizeNetUid(identity?.splitOperationId) || createWizardSplitOperationId()

  return cloneValue({
    ...normalizeWizardSplitRecoverySource(source),
    fencingToken: createWizardSplitFencingToken(generation),
    generation,
    items,
    ownerId,
    ownerUpdatedAt: Date.now(),
    ...(pendingExtraction ? { pendingExtraction } : {}),
    recordType: 'active' as const,
    splitOperationId,
    updatedAt: Date.now(),
    version: WIZARD_SPLIT_RECOVERY_VERSION,
  })
}

function setLocalWizardSplitRecovery(recovery: WizardSplitRecovery | null): void {
  splitRecovery = recovery ? cloneValue(recovery) : null
  splitOrderItems = splitRecovery
    ? splitRecovery.pendingExtraction?.fallbackItems ?? splitRecovery.items
    : []
  splitAgreementNetId = splitRecovery?.agreementNetId ?? null
  notifyWizardSplitListeners()
}

function notifyWizardSplitListeners(): void {
  splitOrderItemsListeners.forEach((listener) => listener())
}

function fenceLocalWizardSplitRecovery(recovery: WizardSplitRecovery): void {
  const identity = getWizardSplitRecoveryIdentity(recovery)
  fencedSplitRecoveryIdentities.add(identity)
  getWizardSplitOperationIds(recovery).forEach((operationId) => {
    fencedWizardSplitOperationIds.add(operationId)
  })

  if (splitRecovery && hasSameWizardSplitRecoverySource(splitRecovery, recovery)) {
    setLocalWizardSplitRecovery(null)
  }
}

function assertDurableWizardSplitFence(recovery: WizardSplitRecovery): WizardSplitRecovery {
  const identity = getWizardSplitRecoveryIdentity(recovery)

  if (fencedSplitRecoveryIdentities.has(identity)) {
    throw new WizardSplitRecoveryFenceError()
  }

  const durable = readWizardSplitRecoveryRecordBySource(recovery)

  if (
    durable?.recordType !== 'active' ||
    durable.generation !== recovery.generation ||
    durable.fencingToken !== recovery.fencingToken ||
    durable.ownerId !== recovery.ownerId ||
    durable.ownerId !== getWizardSplitRecoveryOwnerId() ||
    durable.splitOperationId !== recovery.splitOperationId
  ) {
    fenceLocalWizardSplitRecovery(recovery)
    throw new WizardSplitRecoveryFenceError()
  }

  return durable
}

function resolveCurrentWizardSplitRecovery(): void {
  if (!splitRecovery) {
    if (splitOrderItems.length > 0 || splitAgreementNetId) {
      setLocalWizardSplitRecovery(null)
    }

    return
  }

  resolveWizardSplitRecovery(assertDurableWizardSplitFence(splitRecovery))
}

function resolveWizardSplitRecovery(recovery: WizardSplitRecovery): void {
  const now = Date.now()
  const tombstone: WizardSplitRecoveryTombstone = {
    ...toWizardSplitRecoverySource(recovery),
    fencingToken: createWizardSplitFencingToken(recovery.generation + 1),
    generation: recovery.generation + 1,
    operationIds: getWizardSplitOperationIds(recovery),
    ownerId: getWizardSplitRecoveryOwnerId(),
    recordType: 'resolved',
    resolvedAt: now,
    splitOperationId: recovery.splitOperationId,
    version: WIZARD_SPLIT_RECOVERY_VERSION,
  }
  writeWizardSplitRecoveryRecord(tombstone, recovery)
  setLocalWizardSplitRecovery(null)
}

function getWizardSplitOperationIds(recovery: WizardSplitRecovery): string[] {
  const operationIds = new Set<string>([normalizeNetUid(recovery.splitOperationId)])
  const pendingOperationId = normalizeNetUid(recovery.pendingExtraction?.mutation.operationId)
  const finalOperationId = normalizeNetUid(recovery.finalMutation?.operationId)

  if (pendingOperationId) {
    operationIds.add(pendingOperationId)
  }

  if (finalOperationId) {
    operationIds.add(finalOperationId)
  }

  for (const item of recovery.items) {
    const restoreOperationId = normalizeNetUid(item.RestoreMutation?.operationId ?? item.RestoreOperationNetUid)

    if (restoreOperationId) {
      operationIds.add(restoreOperationId)
    }
  }

  return [...operationIds].filter(Boolean).sort()
}

function getInitialWizardSplitOperationId(items: WizardSplitOrderItem[]): string {
  for (const item of items) {
    const operationId = normalizeNetUid(item.RestoreMutation?.operationId ?? item.RestoreOperationNetUid)

    if (operationId) {
      return operationId
    }
  }

  return createWizardSplitOperationId()
}

function createWizardSplitOperationId(): string {
  return `split:${createRandomWizardSplitId()}`
}

function createWizardSplitFencingToken(generation: number): string {
  return `${generation}:${createRandomWizardSplitId()}`
}

function createRandomWizardSplitId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().toLowerCase()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function assertWizardSplitFinalMutationFence(
  mutation: WizardSplitFinalMutation,
  fence?: Pick<WizardSplitFinalMutation, 'fencingToken' | 'generation'>,
): void {
  if (!mutation.fencingToken && mutation.generation === undefined) {
    return
  }

  if (
    !fence?.fencingToken || fence.generation === undefined ||
    fence.fencingToken !== mutation.fencingToken ||
    fence.generation !== mutation.generation
  ) {
    throw new WizardSplitRecoveryFenceError()
  }
}

function toWizardSplitRecoverySource(recovery: WizardSplitRecovery): WizardSplitRecoverySource {
  return {
    agreementNetId: recovery.agreementNetId,
    origin: recovery.origin,
    saleNetUid: recovery.saleNetUid,
    userKey: recovery.userKey,
  }
}

function normalizeWizardSplitRecoverySource(source: WizardSplitRecoverySource): WizardSplitRecoverySource {
  const agreementNetId = normalizeIdentity(source.agreementNetId)
  const saleNetUid = normalizeIdentity(source.saleNetUid)
  const userKey = normalizeIdentity(source.userKey)

  if (!agreementNetId || !saleNetUid || !userKey) {
    throw new Error('Split recovery requires an authenticated user, agreement, and source sale')
  }

  if (source.origin !== 'merged' && source.origin !== 'ordinary') {
    throw new Error('Unsupported split recovery origin')
  }

  return { agreementNetId, origin: source.origin, saleNetUid, userKey }
}

function normalizeWizardSplitFinalMutation(
  mutation: WizardSplitFinalMutation,
): WizardSplitFinalMutation {
  const context = normalizeIdentity(mutation.context)
  const operationId = normalizeNetUid(mutation.operationId)
  const ownerId = normalizeIdentity(mutation.ownerId) || `legacy:${operationId}`
  const userKey = normalizeIdentity(mutation.userKey)
  const ownerUpdatedAt = typeof mutation.ownerUpdatedAt === 'number' && Number.isFinite(mutation.ownerUpdatedAt)
    ? mutation.ownerUpdatedAt
    : 0

  if (!context || !operationId || !ownerId || !userKey) {
    throw new Error('Final sale mutation requires context, operation id, and authenticated user')
  }

  if (
    mutation.kind !== 'create-sale' &&
    mutation.kind !== 'sale-update-file' &&
    mutation.kind !== 'sale-vat-document'
  ) {
    throw new Error('Unsupported final sale mutation kind')
  }

  if (mutation.phase !== 'prepared' && mutation.phase !== 'submitted' && mutation.phase !== 'unknown') {
    throw new Error('Unsupported final sale mutation phase')
  }

  const hasFence = typeof mutation.fencingToken === 'string' && Boolean(normalizeIdentity(mutation.fencingToken))
  const hasGeneration = typeof mutation.generation === 'number' && Number.isInteger(mutation.generation) && mutation.generation > 0

  if (hasFence !== hasGeneration) {
    throw new Error('Final sale mutation fencing token and generation must be stored together')
  }

  return {
    context,
    ...(hasFence ? { fencingToken: mutation.fencingToken, generation: mutation.generation } : {}),
    kind: mutation.kind,
    operationId,
    ownerId,
    ownerUpdatedAt,
    phase: mutation.phase,
    userKey,
  }
}

function hasSameWizardSplitRecoverySource(
  left: WizardSplitRecoverySource,
  right: WizardSplitRecoverySource,
): boolean {
  return normalizeIdentity(left.userKey) === normalizeIdentity(right.userKey) &&
    normalizeNetUid(left.agreementNetId) === normalizeNetUid(right.agreementNetId) &&
    normalizeNetUid(left.saleNetUid) === normalizeNetUid(right.saleNetUid) &&
    left.origin === right.origin
}

function readWizardSplitRecoveries(): StoredWizardSplitRecoveries {
  const storage = getWizardSplitRecoveryStorageOrThrow()
  const byIdentity = new Map<string, WizardSplitRecovery>()

  for (const key of listWizardSplitStorageKeysStrict(storage)) {
    if (key.startsWith(WIZARD_SPLIT_CORRUPTION_STORAGE_PREFIX)) {
      throw new WizardSplitRecoveryCorruptionError()
    }

    if (
      !key.startsWith(WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX) &&
      !key.startsWith(LEGACY_WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX)
    ) {
      continue
    }

    const record = readWizardSplitRecoveryRecordAtKey(storage, key)

    if (record?.recordType === 'active') {
      const recovery = record
      byIdentity.set(getWizardSplitRecoveryIdentity(recovery), recovery)
    }
  }

  const legacyRaw = getWizardSplitStorageItemStrict(storage, WIZARD_SPLIT_RECOVERY_STORAGE_KEY)

  if (legacyRaw !== null) {
    try {
      const parsed = JSON.parse(legacyRaw) as unknown

      if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
        persistWizardSplitCorruption(WIZARD_SPLIT_RECOVERY_STORAGE_KEY, 'Invalid legacy split recovery registry')
      }

      for (const entry of parsed.entries) {
        const recovery = normalizeWizardSplitRecoveryRecord(entry)

        if (!recovery || recovery.recordType !== 'active') {
          persistWizardSplitCorruption(WIZARD_SPLIT_RECOVERY_STORAGE_KEY, 'Invalid legacy split recovery schema')
        }

        const identity = getWizardSplitRecoveryIdentity(recovery)

        if (!byIdentity.has(identity)) {
          byIdentity.set(identity, recovery)
        }
      }
    } catch (error) {
      if (error instanceof WizardSplitRecoveryCorruptionError) {
        throw error
      }

      persistWizardSplitCorruption(WIZARD_SPLIT_RECOVERY_STORAGE_KEY, 'Legacy split recovery JSON parse error')
    }
  }

  return { entries: [...byIdentity.values()], version: WIZARD_SPLIT_RECOVERY_VERSION }
}

function writeWizardSplitRecoveryRecord(
  record: WizardSplitRecoveryRecord,
  expected: WizardSplitRecoveryRecord | null,
): void {
  const storage = getWizardSplitRecoveryStorageOrThrow()
  const normalizedRecord = normalizeWizardSplitRecoveryRecord(record)

  if (!normalizedRecord) {
    throw new WizardSplitRecoveryCorruptionError()
  }

  const normalizedSource = normalizeWizardSplitRecoverySource(normalizedRecord)
  const key = getWizardSplitRecoveryStorageKey(normalizedSource)
  const current = readWizardSplitRecoveryRecordBySource(normalizedSource)

  if (!hasSameWizardSplitRecordFence(current, expected)) {
    if (expected?.recordType === 'active') {
      fenceLocalWizardSplitRecovery(expected)
    }

    throw new WizardSplitRecoveryFenceError()
  }

  setWizardSplitStorageItemRequired(storage, key, JSON.stringify(normalizedRecord))
  removeLegacyWizardSplitRecovery(storage, normalizedSource)
  const verified = readWizardSplitRecoveryRecordAtKey(storage, key)

  if (!hasSameWizardSplitRecordFence(verified, normalizedRecord)) {
    if (expected?.recordType === 'active') {
      fenceLocalWizardSplitRecovery(expected)
    }

    throw new WizardSplitRecoveryFenceError()
  }
}

function normalizeWizardSplitRecovery(recovery: WizardSplitRecovery): WizardSplitRecovery {
  const identity = getWizardSplitRecoveryIdentity(recovery)
  const ownerId = normalizeIdentity(recovery.ownerId) || `legacy:${identity}`
  const ownerUpdatedAt = typeof recovery.ownerUpdatedAt === 'number' && Number.isFinite(recovery.ownerUpdatedAt)
    ? recovery.ownerUpdatedAt
    : recovery.updatedAt

  return cloneValue({
    ...recovery,
    ...normalizeWizardSplitRecoverySource(recovery),
    ...(recovery.finalMutation
      ? { finalMutation: normalizeWizardSplitFinalMutation(recovery.finalMutation) }
      : {}),
    ...(recovery.pendingExtraction
      ? { pendingExtraction: normalizeWizardPendingSplitExtraction(recovery.pendingExtraction) }
      : {}),
    fencingToken: normalizeIdentity(recovery.fencingToken),
    generation: recovery.generation,
    ownerId,
    ownerUpdatedAt,
    recordType: 'active' as const,
    splitOperationId: normalizeNetUid(recovery.splitOperationId),
    version: WIZARD_SPLIT_RECOVERY_VERSION,
  })
}

function normalizeWizardSplitRecoveryTombstone(
  tombstone: WizardSplitRecoveryTombstone,
): WizardSplitRecoveryTombstone {
  return cloneValue({
    ...tombstone,
    ...normalizeWizardSplitRecoverySource(tombstone),
    fencingToken: normalizeIdentity(tombstone.fencingToken),
    operationIds: [...new Set(tombstone.operationIds.map(normalizeNetUid).filter(Boolean))].sort(),
    ownerId: normalizeIdentity(tombstone.ownerId),
    recordType: 'resolved' as const,
    splitOperationId: normalizeNetUid(tombstone.splitOperationId),
    version: WIZARD_SPLIT_RECOVERY_VERSION,
  })
}

function normalizeWizardSplitRecoveryRecord(value: unknown): WizardSplitRecoveryRecord | null {
  if (isWizardSplitRecovery(value)) {
    return normalizeWizardSplitRecovery(value)
  }

  if (isWizardSplitRecoveryTombstone(value)) {
    return normalizeWizardSplitRecoveryTombstone(value)
  }

  if (isLegacyWizardSplitRecovery(value)) {
    const source = normalizeWizardSplitRecoverySource(value)
    const identity = getWizardSplitRecoveryIdentity(source)
    const splitOperationId = normalizeNetUid(
      value.pendingExtraction?.mutation.operationId ??
      value.finalMutation?.operationId ??
      value.items.find((item) => item.RestoreMutation?.operationId)?.RestoreMutation?.operationId,
    ) || `legacy:${identity}`

    return normalizeWizardSplitRecovery({
      ...value,
      fencingToken: `legacy:${identity}`,
      finalMutation: value.finalMutation
        ? normalizeWizardSplitFinalMutation({ ...value.finalMutation, phase: value.finalMutation.phase ?? 'unknown' })
        : undefined,
      generation: 1,
      recordType: 'active',
      splitOperationId,
      version: WIZARD_SPLIT_RECOVERY_VERSION,
    })
  }

  return null
}

function readWizardSplitRecoveryRecordBySource(
  source: WizardSplitRecoverySource,
): WizardSplitRecoveryRecord | null {
  const storage = getWizardSplitRecoveryStorageOrThrow()
  const key = getWizardSplitRecoveryStorageKey(source)
  const current = readWizardSplitRecoveryRecordAtKey(storage, key)

  if (current) {
    return current
  }

  const legacyKey = getLegacyWizardSplitRecoveryStorageKey(source)
  return readWizardSplitRecoveryRecordAtKey(storage, legacyKey)
}

function readWizardSplitRecoveryRecordAtKey(
  storage: Storage,
  key: string,
): WizardSplitRecoveryRecord | null {
  const raw = getWizardSplitStorageItemStrict(storage, key)

  if (raw === null) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    persistWizardSplitCorruption(key, 'Split recovery JSON parse error')
  }

  const record = normalizeWizardSplitRecoveryRecord(parsed)

  if (!record) {
    persistWizardSplitCorruption(key, 'Invalid split recovery schema')
  }

  return record
}

function hasSameWizardSplitRecordFence(
  left: WizardSplitRecoveryRecord | null,
  right: WizardSplitRecoveryRecord | null,
): boolean {
  if (!left || !right) {
    return left === right
  }

  return left.recordType === right.recordType &&
    left.generation === right.generation &&
    left.fencingToken === right.fencingToken &&
    left.ownerId === right.ownerId &&
    left.splitOperationId === right.splitOperationId &&
    hasSameWizardSplitRecoverySource(left, right)
}

function getWizardSplitRecoveryIdentity(source: WizardSplitRecoverySource): string {
  const normalized = normalizeWizardSplitRecoverySource(source)

  return [normalized.userKey, normalized.origin, normalized.saleNetUid, normalized.agreementNetId].join('\u001f')
}

function getWizardSplitRecoveryStorageKey(source: WizardSplitRecoverySource): string {
  return `${WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX}${encodeURIComponent(getWizardSplitRecoveryIdentity(source))}`
}

function getLegacyWizardSplitRecoveryStorageKey(source: WizardSplitRecoverySource): string {
  return `${LEGACY_WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX}${encodeURIComponent(getWizardSplitRecoveryIdentity(source))}`
}

function compareWizardSplitRecoveries(left: WizardSplitRecovery, right: WizardSplitRecovery): number {
  if (Boolean(left.finalMutation) !== Boolean(right.finalMutation)) {
    return left.finalMutation ? -1 : 1
  }

  return left.updatedAt - right.updatedAt || getWizardSplitRecoveryIdentity(left).localeCompare(
    getWizardSplitRecoveryIdentity(right),
  )
}

function removeLegacyWizardSplitRecovery(
  storage: Storage,
  source: WizardSplitRecoverySource,
): void {
  const legacyKey = getLegacyWizardSplitRecoveryStorageKey(source)

  if (getWizardSplitStorageItemStrict(storage, legacyKey) !== null) {
    removeWizardSplitStorageItemRequired(storage, legacyKey)
  }

  const raw = getWizardSplitStorageItemStrict(storage, WIZARD_SPLIT_RECOVERY_STORAGE_KEY)

  if (raw === null) {
    return
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (!isRecord(parsed) || !Array.isArray(parsed.entries)) {
      persistWizardSplitCorruption(WIZARD_SPLIT_RECOVERY_STORAGE_KEY, 'Invalid legacy split recovery registry')
    }

    const entries = parsed.entries.filter((entry) => (
      !isLegacyWizardSplitRecovery(entry) || !hasSameWizardSplitRecoverySource(entry, source)
    ))

    if (entries.length === 0) {
      removeWizardSplitStorageItemRequired(storage, WIZARD_SPLIT_RECOVERY_STORAGE_KEY)
    } else {
      setWizardSplitStorageItemRequired(storage, WIZARD_SPLIT_RECOVERY_STORAGE_KEY, JSON.stringify({
        entries,
        version: 1,
      }))
    }
  } catch (error) {
    if (error instanceof WizardSplitRecoveryCorruptionError) {
      throw error
    }

    persistWizardSplitCorruption(WIZARD_SPLIT_RECOVERY_STORAGE_KEY, 'Legacy split recovery cleanup failed')
  }
}

function persistWizardSplitCorruption(sourceKey: string, reason: string): never {
  const storage = getWizardSplitRecoveryStorageOrThrow()
  const key = `${WIZARD_SPLIT_CORRUPTION_STORAGE_PREFIX}${encodeURIComponent(sourceKey)}`
  setWizardSplitStorageItemRequired(storage, key, JSON.stringify({
    detectedAt: Date.now(),
    reason,
    sourceKey,
    version: 1,
  }))
  throw new WizardSplitRecoveryCorruptionError()
}

let wizardSplitStorageListenerInstalled = false

function installWizardSplitStorageListener(): void {
  if (wizardSplitStorageListenerInstalled || typeof window === 'undefined') {
    return
  }

  window.addEventListener('storage', handleWizardSplitStorageEvent)
  wizardSplitStorageListenerInstalled = true
}

function uninstallWizardSplitStorageListener(): void {
  if (!wizardSplitStorageListenerInstalled || typeof window === 'undefined') {
    return
  }

  window.removeEventListener('storage', handleWizardSplitStorageEvent)
  wizardSplitStorageListenerInstalled = false
}

function handleWizardSplitStorageEvent(event: StorageEvent): void {
  if (
    event.storageArea !== window.localStorage ||
    !event.key ||
    (
      !event.key.startsWith(WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX) &&
      !event.key.startsWith(LEGACY_WIZARD_SPLIT_RECOVERY_STORAGE_PREFIX) &&
      !event.key.startsWith(WIZARD_SPLIT_CORRUPTION_STORAGE_PREFIX)
    )
  ) {
    return
  }

  if (!splitRecovery) {
    notifyWizardSplitListeners()
    return
  }

  const local = splitRecovery

  try {
    const durable = readWizardSplitRecoveryRecordBySource(local)

    if (
      durable?.recordType === 'active' &&
      hasSameWizardSplitRecordFence(durable, local)
    ) {
      setLocalWizardSplitRecovery(durable)
    } else {
      fenceLocalWizardSplitRecovery(local)
    }
  } catch {
    fenceLocalWizardSplitRecovery(local)
  }
}

export function getWizardSplitRecoveryOwnerId(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = normalizeIdentity(window.sessionStorage.getItem(WIZARD_SPLIT_OWNER_SESSION_KEY))

      if (stored) {
        return `${stored}:${WIZARD_SPLIT_OWNER_RUNTIME_ID}`
      }

      const created = createWizardSplitOwnerId()
      window.sessionStorage.setItem(WIZARD_SPLIT_OWNER_SESSION_KEY, created)

      return `${created}:${WIZARD_SPLIT_OWNER_RUNTIME_ID}`
    } catch {
      throw new WizardSplitRecoveryStorageError()
    }
  }

  return getFallbackWizardSplitOwnerId()
}

let fallbackWizardSplitOwnerId = ''

function getFallbackWizardSplitOwnerId(): string {
  fallbackWizardSplitOwnerId ||= createWizardSplitOwnerId()

  return fallbackWizardSplitOwnerId
}

function createWizardSplitOwnerId(): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `tab:${randomId.toLowerCase()}`
}

function listWizardSplitStorageKeys(storage: Storage | null): string[] {
  if (!storage) {
    return []
  }

  try {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key !== null)
  } catch {
    return []
  }
}

function listWizardSplitStorageKeysStrict(storage: Storage): string[] {
  try {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key !== null)
  } catch {
    throw new WizardSplitRecoveryStorageError()
  }
}

function getWizardSplitStorageItemStrict(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    throw new WizardSplitRecoveryStorageError()
  }
}

function setWizardSplitStorageItemRequired(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    throw new WizardSplitRecoveryStorageError()
  }
}

function removeWizardSplitStorageItemRequired(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    throw new WizardSplitRecoveryStorageError()
  }
}

function tryRemoveWizardSplitStorageItem(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Test/logout cleanup is best effort. Required lifecycle writes fail closed above.
  }
}

function isWizardSplitRecovery(value: unknown): value is WizardSplitRecovery {
  if (!isRecord(value) || value.version !== WIZARD_SPLIT_RECOVERY_VERSION) {
    return false
  }

  if (
    typeof value.agreementNetId !== 'string' ||
    !normalizeIdentity(value.agreementNetId) ||
    (value.origin !== 'merged' && value.origin !== 'ordinary') ||
    typeof value.saleNetUid !== 'string' ||
    !normalizeIdentity(value.saleNetUid) ||
    typeof value.userKey !== 'string' ||
    !normalizeIdentity(value.userKey) ||
    value.recordType !== 'active' ||
    typeof value.generation !== 'number' ||
    !Number.isInteger(value.generation) ||
    value.generation <= 0 ||
    typeof value.fencingToken !== 'string' ||
    !normalizeIdentity(value.fencingToken) ||
    typeof value.splitOperationId !== 'string' ||
    !normalizeNetUid(value.splitOperationId) ||
    typeof value.ownerId !== 'string' ||
    !normalizeIdentity(value.ownerId) ||
    typeof value.ownerUpdatedAt !== 'number' ||
    !Number.isFinite(value.ownerUpdatedAt) ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt) ||
    !Array.isArray(value.items)
  ) {
    return false
  }

  if (value.pendingExtraction !== undefined && !isWizardPendingSplitExtraction(value.pendingExtraction)) {
    return false
  }

  if (
    value.finalMutation !== undefined &&
    !isWizardSplitFinalMutation(value.finalMutation)
  ) {
    return false
  }

  return value.items.every(isWizardSplitOrderItem)
}

function isWizardSplitRecoveryTombstone(value: unknown): value is WizardSplitRecoveryTombstone {
  return isRecord(value) &&
    value.version === WIZARD_SPLIT_RECOVERY_VERSION &&
    value.recordType === 'resolved' &&
    typeof value.agreementNetId === 'string' &&
    Boolean(normalizeIdentity(value.agreementNetId)) &&
    (value.origin === 'merged' || value.origin === 'ordinary') &&
    typeof value.saleNetUid === 'string' &&
    Boolean(normalizeIdentity(value.saleNetUid)) &&
    typeof value.userKey === 'string' &&
    Boolean(normalizeIdentity(value.userKey)) &&
    typeof value.generation === 'number' &&
    Number.isInteger(value.generation) &&
    value.generation > 0 &&
    typeof value.fencingToken === 'string' &&
    Boolean(normalizeIdentity(value.fencingToken)) &&
    typeof value.splitOperationId === 'string' &&
    Boolean(normalizeNetUid(value.splitOperationId)) &&
    typeof value.ownerId === 'string' &&
    Boolean(normalizeIdentity(value.ownerId)) &&
    typeof value.resolvedAt === 'number' &&
    Number.isFinite(value.resolvedAt) &&
    Array.isArray(value.operationIds) &&
    value.operationIds.every((operationId) => typeof operationId === 'string' && Boolean(normalizeNetUid(operationId)))
}

type LegacyWizardSplitRecovery = WizardSplitRecoverySource & {
  finalMutation?: WizardSplitFinalMutation
  items: WizardSplitOrderItem[]
  ownerId: string
  ownerUpdatedAt: number
  pendingExtraction?: WizardPendingSplitExtraction
  updatedAt: number
  version: 1
}

function isLegacyWizardSplitRecovery(value: unknown): value is LegacyWizardSplitRecovery {
  if (
    !isRecord(value) || value.version !== 1 ||
    typeof value.agreementNetId !== 'string' || !normalizeIdentity(value.agreementNetId) ||
    (value.origin !== 'merged' && value.origin !== 'ordinary') ||
    typeof value.saleNetUid !== 'string' || !normalizeIdentity(value.saleNetUid) ||
    typeof value.userKey !== 'string' || !normalizeIdentity(value.userKey) ||
    typeof value.ownerId !== 'string' || !normalizeIdentity(value.ownerId) ||
    typeof value.ownerUpdatedAt !== 'number' || !Number.isFinite(value.ownerUpdatedAt) ||
    typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt) ||
    !Array.isArray(value.items) || !value.items.every(isWizardSplitOrderItem)
  ) {
    return false
  }

  return (value.pendingExtraction === undefined || isWizardPendingSplitExtraction(value.pendingExtraction)) &&
    (value.finalMutation === undefined || isWizardSplitFinalMutation(value.finalMutation))
}

function isWizardSplitFinalMutation(value: unknown): value is WizardSplitFinalMutation {
  if (!isRecord(value)) {
    return false
  }

  try {
    normalizeWizardSplitFinalMutation(value as WizardSplitFinalMutation)

    return true
  } catch {
    return false
  }
}

function isWizardPendingSplitExtraction(value: unknown): value is WizardPendingSplitExtraction {
  return isRecord(value) &&
    Array.isArray(value.fallbackItems) &&
    value.fallbackItems.every(isWizardSplitOrderItem) &&
    isWizardSplitMutationSnapshot(value.mutation) &&
    (
      value.phase === undefined ||
      value.phase === 'prepared' ||
      value.phase === 'submitted' ||
      value.phase === 'unknown'
    )
}

function normalizeWizardPendingSplitExtraction(
  pending: WizardPendingSplitExtraction,
): WizardPendingSplitExtraction {
  return cloneValue({
    ...pending,
    phase: pending.phase === 'prepared' || pending.phase === 'submitted' || pending.phase === 'unknown'
      ? pending.phase
      : 'unknown',
  })
}

function isWizardSplitOrderItem(value: unknown): value is WizardSplitOrderItem {
  return isRecord(value) &&
    typeof value.Qty === 'number' &&
    Number.isFinite(value.Qty) &&
    value.Qty > 0 &&
    isRecord(value.Product) &&
    typeof value.TotalAmount === 'number' &&
    typeof value.TotalAmountEurToUah === 'number' &&
    typeof value.TotalAmountLocal === 'number' &&
    (value.RestoreMutation === undefined || isWizardSplitMutationSnapshot(value.RestoreMutation))
}

function isWizardSplitMutationSnapshot(value: unknown): value is WizardSplitMutationSnapshot {
  return isRecord(value) &&
    isRecord(value.expectation) &&
    typeof value.operationId === 'string' &&
    Boolean(normalizeNetUid(value.operationId)) &&
    isRecord(value.request) &&
    typeof value.request.kind === 'string'
}

function getWizardSplitRecoveryStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getWizardSplitRecoveryStorageOrThrow(): Storage {
  const storage = getWizardSplitRecoveryStorage()

  if (!storage) {
    throw new WizardSplitRecoveryStorageError()
  }

  return storage
}

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeIdentity(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export type WizardMergedSaleState = {
  netUid: string
  orderItems: SalesUkraineOrderItem[]
  unionSale: SalesUkraineSale | null
}

let mergedSale: WizardMergedSaleState | null = null

const mergedSaleListeners = new Set<() => void>()

function notifyMergedSaleListeners(): void {
  mergedSaleListeners.forEach((listener) => listener())
}

export function getWizardMergedSale(): WizardMergedSaleState | null {
  return mergedSale
}

export function getWizardMergedSaleNetUid(): string | null {
  return mergedSale?.netUid ?? null
}

export function isWizardMergedSaleMode(): boolean {
  return mergedSale !== null
}

export function setWizardMergedSale(next: WizardMergedSaleState | null): void {
  if (mergedSale === next) {
    return
  }

  mergedSale = next
  notifyMergedSaleListeners()
}

export function replaceWizardMergedOrderItems(netUid: string, orderItems: SalesUkraineOrderItem[]): boolean {
  if (!mergedSale || normalizeNetUid(mergedSale.netUid) !== normalizeNetUid(netUid)) {
    return false
  }

  mergedSale = { ...mergedSale, orderItems: [...orderItems] }
  notifyMergedSaleListeners()

  return true
}

export function clearWizardMergedSale(): void {
  setWizardMergedSale(null)
}

export function subscribeWizardMergedSale(listener: () => void): () => void {
  mergedSaleListeners.add(listener)

  return () => {
    mergedSaleListeners.delete(listener)
  }
}

export function useWizardMergedSale(): WizardMergedSaleState | null {
  return useSyncExternalStore(subscribeWizardMergedSale, getWizardMergedSale)
}

function normalizeNetUid(value: string | null | undefined): string {
  const netUid = value?.trim().toLowerCase() ?? ''

  return netUid === '00000000-0000-0000-0000-000000000000' ? '' : netUid
}

let debtRefreshVersion = 0

const debtRefreshListeners = new Set<() => void>()

export function getWizardDebtRefreshVersion(): number {
  return debtRefreshVersion
}

export function bumpWizardDebtRefresh(): void {
  debtRefreshVersion += 1
  debtRefreshListeners.forEach((listener) => listener())
}

export function subscribeWizardDebtRefresh(listener: () => void): () => void {
  debtRefreshListeners.add(listener)

  return () => {
    debtRefreshListeners.delete(listener)
  }
}

export function useWizardDebtRefreshVersion(): number {
  return useSyncExternalStore(subscribeWizardDebtRefresh, getWizardDebtRefreshVersion)
}
