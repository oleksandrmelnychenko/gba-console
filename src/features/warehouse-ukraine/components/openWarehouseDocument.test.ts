import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closePendingWarehouseDocumentWindow,
  getPreferredWarehousePrintUrl,
  hasWarehouseDocumentUrl,
  openPendingWarehouseDocumentWindow,
  openWarehouseDocumentInWindow,
  openWarehouseDocumentUrl,
} from './openWarehouseDocument'

function createFakeWindow() {
  return {
    closed: false,
    close: vi.fn(),
    document: {
      body: { textContent: '' },
      title: '',
    },
    location: {
      href: '',
    },
    opener: {},
  } as unknown as Window
}

describe('openWarehouseDocument', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pre-opens a blank document window and navigates it to the secure PDF URL', () => {
    const fakeWindow = createFakeWindow()
    const openMock = vi.fn(() => fakeWindow)
    vi.stubGlobal('window', { location: { protocol: 'https:' }, open: openMock })

    const pendingWindow = openPendingWarehouseDocumentWindow()
    const opened = openWarehouseDocumentInWindow(pendingWindow, 'http://example.test/invoice.pdf')

    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith('about:blank', '_blank')
    expect(opened).toBe(true)
    expect(fakeWindow.location.href).toBe('https://example.test/invoice.pdf')
  })

  it('does not attempt a late popup when the pre-opened window is unavailable', () => {
    const openMock = vi.fn(() => null)
    vi.stubGlobal('window', { location: { protocol: 'https:' }, open: openMock })

    const pendingWindow = openPendingWarehouseDocumentWindow()
    const opened = openWarehouseDocumentInWindow(pendingWindow, 'https://example.test/invoice.pdf')

    expect(pendingWindow).toBeNull()
    expect(opened).toBe(false)
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('opens an already-created document URL without a pending blank page', () => {
    const fakeWindow = createFakeWindow()
    const openMock = vi.fn(() => fakeWindow)
    vi.stubGlobal('window', { location: { protocol: 'https:' }, open: openMock })

    const opened = openWarehouseDocumentUrl('http://example.test/invoice.pdf')

    expect(opened).toBe(true)
    expect(openMock).toHaveBeenCalledWith('https://example.test/invoice.pdf', '_blank', 'noopener,noreferrer')
    expect(fakeWindow.opener).toBeNull()
  })

  it('reports when the browser blocks an already-created document popup', () => {
    const openMock = vi.fn(() => null)
    vi.stubGlobal('window', { location: { protocol: 'https:' }, open: openMock })

    expect(openWarehouseDocumentUrl('https://example.test/invoice.pdf')).toBe(false)
  })

  it('prefers PDF for direct print and keeps Excel as document fallback', () => {
    expect(getPreferredWarehousePrintUrl({
      DocumentURL: 'https://example.test/invoice.xlsx',
      PdfDocumentURL: 'https://example.test/invoice.pdf',
    })).toBe('https://example.test/invoice.pdf')

    expect(getPreferredWarehousePrintUrl({
      DocumentURL: 'https://example.test/invoice.xlsx',
    })).toBe('https://example.test/invoice.xlsx')

    expect(hasWarehouseDocumentUrl({
      DocumentURL: 'https://example.test/invoice.xlsx',
    })).toBe(true)
  })

  it('closes a pending window only when it is still open', () => {
    const fakeWindow = createFakeWindow()

    closePendingWarehouseDocumentWindow(fakeWindow)
    closePendingWarehouseDocumentWindow(null)

    expect(fakeWindow.close).toHaveBeenCalledTimes(1)
  })
})
