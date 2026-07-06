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

// Restores legacy's direct-print behaviour (printJS equivalent, no extra deps): fetch the document
// into a same-origin blob and print it through a hidden iframe. Returns false so the caller can fall
// back to the new-tab / download flow when the fetch or print is blocked.
export async function printWarehouseDocumentUrl(documentUrl: string): Promise<boolean> {
  try {
    const response = await fetch(getDocumentHref(documentUrl))

    if (!response.ok) {
      return false
    }

    const blobUrl = URL.createObjectURL(await response.blob())
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'

    return await new Promise<boolean>((resolve) => {
      let settled = false

      const cleanup = () => {
        window.setTimeout(() => {
          iframe.remove()
          URL.revokeObjectURL(blobUrl)
        }, 60_000)
      }

      iframe.onload = () => {
        try {
          const frameWindow = iframe.contentWindow

          if (!frameWindow) {
            resolve(false)

            return
          }

          frameWindow.focus()
          frameWindow.print()
          settled = true
          resolve(true)
          cleanup()
        } catch {
          resolve(false)
        }
      }

      iframe.onerror = () => resolve(false)
      document.body.appendChild(iframe)
      iframe.src = blobUrl

      window.setTimeout(() => {
        if (!settled) {
          resolve(false)
        }
      }, 8_000)
    })
  } catch {
    return false
  }
}
