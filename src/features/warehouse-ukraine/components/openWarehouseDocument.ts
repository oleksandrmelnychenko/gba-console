import { getDocumentHref } from '../../../shared/url/getDocumentHref'

type WarehouseDocumentLike = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export function getPreferredWarehousePrintUrl(document: WarehouseDocumentLike): string {
  return document.PdfDocumentURL || document.DocumentURL || ''
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

export function openWarehouseDocumentUrl(documentUrl: string): boolean {
  const openedWindow = window.open(getDocumentHref(documentUrl), '_blank', 'noopener,noreferrer')

  if (!openedWindow) {
    return false
  }

  openedWindow.opener = null
  return true
}

export function closePendingWarehouseDocumentWindow(pendingWindow: Window | null) {
  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.close()
  }
}
