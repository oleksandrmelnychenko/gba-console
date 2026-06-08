import { getDocumentHref } from '../../../shared/url/getDocumentHref'

type WarehouseDocumentLike = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export function getPreferredWarehousePrintUrl(document: WarehouseDocumentLike): string {
  return document.PdfDocumentURL || ''
}

export function hasWarehouseDocumentUrl(document: WarehouseDocumentLike): boolean {
  return Boolean(document.DocumentURL || document.PdfDocumentURL)
}

export function openPendingWarehouseDocumentWindow(): Window | null {
  const pendingWindow = window.open('about:blank', '_blank')

  if (pendingWindow) {
    pendingWindow.opener = null
    pendingWindow.document.title = 'Document'
    pendingWindow.document.body.textContent = 'Loading document...'
  }

  return pendingWindow
}

export function openWarehouseDocumentInWindow(pendingWindow: Window | null, documentUrl: string): boolean {
  const href = getDocumentHref(documentUrl)

  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.location.href = href
    return true
  }

  return false
}

export function closePendingWarehouseDocumentWindow(pendingWindow: Window | null) {
  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.close()
  }
}
