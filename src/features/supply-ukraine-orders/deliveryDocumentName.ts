import type { SupplyOrderDeliveryDocument } from './types'

/**
 * The document type name lives on SupplyDeliveryDocument; the table read only Name / FileName,
 * which are empty until a file is uploaded, so rows showed no document name at all.
 */
export function getDeliveryDocumentName(document: SupplyOrderDeliveryDocument, t: (key: string) => string): string {
  return document.SupplyDeliveryDocument?.Name?.trim()
    || document.Name?.trim()
    || document.FileName?.trim()
    || t('Документ без назви')
}
