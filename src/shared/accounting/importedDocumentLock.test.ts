import { describe, expect, it } from 'vitest'

import {
  getImportedDocumentLockReason,
  IMPORTED_DOCUMENT_LOCK_REASON,
  isImportLockedDocument,
} from './importedDocumentLock'

const translate = (key: string) => key

describe('importedDocumentLock', () => {
  it('locks only documents the server marks as imported before the cutover', () => {
    expect(isImportLockedDocument({ IsImportLocked: true })).toBe(true)
    expect(isImportLockedDocument({ IsImportLocked: false })).toBe(false)
    expect(isImportLockedDocument({})).toBe(false)
    expect(isImportLockedDocument(null)).toBe(false)
  })

  it('explains the lock in Ukrainian instead of offering a refused action', () => {
    expect(getImportedDocumentLockReason({ IsImportLocked: true }, translate)).toBe(IMPORTED_DOCUMENT_LOCK_REASON)
    expect(getImportedDocumentLockReason({ IsImportLocked: false }, translate)).toBeNull()
    expect(IMPORTED_DOCUMENT_LOCK_REASON).toContain('1С')
  })
})
