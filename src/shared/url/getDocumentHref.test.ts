import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDocumentHref } from './getDocumentHref'

describe('getDocumentHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps empty document urls safe for guarded anchors', () => {
    expect(getDocumentHref(undefined)).toBe('')
    expect(getDocumentHref(null)).toBe('')
    expect(getDocumentHref('')).toBe('')
  })

  it('upgrades http document urls on https pages', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } })

    expect(getDocumentHref('http://example.com/document.pdf')).toBe('https://example.com/document.pdf')
  })

  it('keeps document urls unchanged outside https pages', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } })

    expect(getDocumentHref('http://example.com/document.pdf')).toBe('http://example.com/document.pdf')
    expect(getDocumentHref('https://example.com/document.pdf')).toBe('https://example.com/document.pdf')
  })
})
