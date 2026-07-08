import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closePendingExportDocumentWindow,
  getPreferredExportDocumentUrl,
  openExportDocumentInWindow,
  openPendingExportDocumentWindow,
} from './openExportDocument'

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

describe('open export document helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pre-opens a document window and navigates it to the secure URL', () => {
    const fakeWindow = createFakeWindow()
    const openMock = vi.fn(() => fakeWindow)
    vi.stubGlobal('window', { location: { protocol: 'https:' }, open: openMock })

    const pendingWindow = openPendingExportDocumentWindow('Друк PDF')
    const opened = openExportDocumentInWindow(pendingWindow, 'http://example.test/movement.pdf')

    expect(openMock).toHaveBeenCalledWith('about:blank', '_blank')
    expect(opened).toBe(true)
    expect(fakeWindow.document.title).toBe('Друк PDF')
    expect(fakeWindow.location.href).toBe('https://example.test/movement.pdf')
    expect(fakeWindow.opener).toBeNull()
  })

  it('prefers PDF and keeps Excel as fallback', () => {
    expect(getPreferredExportDocumentUrl({
      DocumentURL: 'https://example.test/movement.xlsx',
      PdfDocumentURL: 'https://example.test/movement.pdf',
    })).toBe('https://example.test/movement.pdf')

    expect(getPreferredExportDocumentUrl({
      DocumentURL: 'https://example.test/movement.xlsx',
    })).toBe('https://example.test/movement.xlsx')
  })

  it('closes pending document windows', () => {
    const fakeWindow = createFakeWindow()

    closePendingExportDocumentWindow(fakeWindow)
    closePendingExportDocumentWindow(null)

    expect(fakeWindow.close).toHaveBeenCalledTimes(1)
  })
})
