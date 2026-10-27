import { getImportedDocumentLockReason } from '../../shared/accounting/importedDocumentLock'
import type { PaymentRegisterTransfer } from './types'

export function getTransferCancelUnavailableReason(
  transfer: PaymentRegisterTransfer,
  t: (key: string) => string,
  now: Date = new Date(),
): string | null {
  if (transfer.IsCanceled) {
    return t('Уже скасовано')
  }

  if (!transfer.NetUid) {
    return t('Документ недоступний для скасування')
  }

  const importedLockReason = getImportedDocumentLockReason(transfer, t)
  if (importedLockReason) {
    return importedLockReason
  }

  if (!isSameLocalDate(transfer.Created, now)) {
    return t('Скасування доступне тільки в день створення')
  }

  return null
}

function isSameLocalDate(value: unknown, target: Date): boolean {
  const date = value instanceof Date ? value : typeof value === 'string' && value ? new Date(value) : null

  if (!date || Number.isNaN(date.getTime())) {
    return false
  }

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}
