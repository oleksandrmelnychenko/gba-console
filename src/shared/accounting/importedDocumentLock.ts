export const IMPORTED_DOCUMENT_LOCK_REASON =
  'Документ імпортовано з 1С. Змінити або скасувати його можна буде після переходу на облік у GBA.'

export type ImportLockedDocument = {
  IsImportLocked?: boolean | null
}

export function isImportLockedDocument(document: ImportLockedDocument | null | undefined): boolean {
  return document?.IsImportLocked === true
}

export function getImportedDocumentLockReason(
  document: ImportLockedDocument | null | undefined,
  t: (key: string) => string,
): string | null {
  return isImportLockedDocument(document) ? t(IMPORTED_DOCUMENT_LOCK_REASON) : null
}
