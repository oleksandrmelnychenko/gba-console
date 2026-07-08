import type { TaxFreePrintDocument } from '../types'

export type TaxFreePrintDocumentWithUrl = TaxFreePrintDocument & (
  { DocumentURL: string } | { PdfDocumentURL: string }
)

export function hasTaxFreePrintDocumentUrl(document: TaxFreePrintDocument | null): document is TaxFreePrintDocumentWithUrl {
  return Boolean(document?.DocumentURL || document?.PdfDocumentURL)
}
