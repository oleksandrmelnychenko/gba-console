import { getDocumentHref } from '../url/getDocumentHref'
import type { ExportDocument } from './exportDocument'

export function getPreferredExportDocumentUrl(document: ExportDocument | null | undefined): string {
  return document?.PdfDocumentURL || document?.DocumentURL || ''
}

export function openPendingExportDocumentWindow(title = 'Document'): Window | null {
  const pendingWindow = window.open('about:blank', '_blank')

  if (pendingWindow) {
    pendingWindow.opener = null
    pendingWindow.document.title = title
    pendingWindow.document.body.textContent = 'Loading document...'
  }

  return pendingWindow
}

export function openExportDocumentInWindow(pendingWindow: Window | null, documentUrl: string): boolean {
  const href = getDocumentHref(documentUrl)

  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.location.href = href
    return true
  }

  return false
}

export function closePendingExportDocumentWindow(pendingWindow: Window | null) {
  if (pendingWindow && !pendingWindow.closed) {
    pendingWindow.close()
  }
}
