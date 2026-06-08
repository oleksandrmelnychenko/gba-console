export type ExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export function normalizeExportDocument(result: unknown): ExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL:
      readString(payload.DocumentURL)
      || readString(payload.XlsxDocument)
      || readString(payload.URL)
      || readString(payload.url),
    PdfDocumentURL: readString(payload.PdfDocumentURL) || readString(payload.PdfDocument),
  }
}

export function hasExportDocumentUrl(document: ExportDocument | null | undefined): boolean {
  return Boolean(document?.DocumentURL || document?.PdfDocumentURL)
}

export function requireExportDocument(result: unknown, message: string): ExportDocument {
  const document = normalizeExportDocument(result)

  if (!hasExportDocumentUrl(document)) {
    throw new Error(message)
  }

  return document
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
