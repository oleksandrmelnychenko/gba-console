import type { SupplyOrderDeliveryDocument } from './types'

/**
 * The document type name lives on SupplyDeliveryDocument; the table read only Name / FileName,
 * which are empty until a file is uploaded, so rows showed no document name at all.
 * When neither the type nor the row has a name, an uploaded file still names the row: the
 * stored file name, else the last segment of the file's URL (chaos2-orders F18).
 */
export function getDeliveryDocumentName(document: SupplyOrderDeliveryDocument, t: (key: string) => string): string {
  return document.SupplyDeliveryDocument?.Name?.trim()
    || document.Name?.trim()
    || document.FileName?.trim()
    || getFileNameFromUrl(document.DocumentUrl)
    || document.GeneratedName?.trim()
    || t('Документ без назви')
}

function getFileNameFromUrl(url: string | null | undefined): string {
  const path = url?.trim().split(/[?#]/)[0] || ''
  const segment = path.split(/[\\/]/).filter(Boolean).pop() || ''

  if (!segment || /^https?:$/i.test(segment)) {
    return ''
  }

  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
