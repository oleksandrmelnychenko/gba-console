import { describe, expect, it } from 'vitest'

import { IMPORTED_DOCUMENT_LOCK_REASON } from '../../shared/accounting/importedDocumentLock'
import { getTransferCancelUnavailableReason } from './transferCancelPolicy'

const translate = (key: string) => key
const now = new Date(2026, 10, 3, 12, 0, 0)
const today = new Date(2026, 10, 3, 9, 30, 0).toISOString()

describe('getTransferCancelUnavailableReason', () => {
  it('allows cancelling a native transfer created today', () => {
    expect(getTransferCancelUnavailableReason({ Created: today, NetUid: 'transfer' }, translate, now)).toBeNull()
  })

  it('explains the import lock before the cutover instead of offering a refused cancel', () => {
    expect(
      getTransferCancelUnavailableReason({ Created: today, IsImportLocked: true, NetUid: 'transfer' }, translate, now),
    ).toBe(IMPORTED_DOCUMENT_LOCK_REASON)
  })

  it('mirrors the server same-day rule', () => {
    expect(
      getTransferCancelUnavailableReason(
        { Created: new Date(2026, 10, 1, 9, 0, 0).toISOString(), NetUid: 'transfer' },
        translate,
        now,
      ),
    ).toBe('Скасування доступне тільки в день створення')
  })

  it('keeps the existing canceled and missing identity reasons', () => {
    expect(getTransferCancelUnavailableReason({ IsCanceled: true, NetUid: 'transfer' }, translate, now)).toBe('Уже скасовано')
    expect(getTransferCancelUnavailableReason({ Created: today }, translate, now)).toBe('Документ недоступний для скасування')
  })
})
