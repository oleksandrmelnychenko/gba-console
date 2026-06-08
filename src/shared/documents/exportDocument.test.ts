import { describe, expect, it } from 'vitest'
import { hasExportDocumentUrl, normalizeExportDocument, requireExportDocument } from './exportDocument'

describe('export document helpers', () => {
  it('normalizes all supported Excel and PDF response field names', () => {
    expect(normalizeExportDocument({ XlsxDocument: ' https://example.test/a.xlsx ', PdfDocument: 'https://example.test/a.pdf' })).toEqual({
      DocumentURL: 'https://example.test/a.xlsx',
      PdfDocumentURL: 'https://example.test/a.pdf',
    })
    expect(normalizeExportDocument({ URL: 'https://example.test/b.xlsx' }).DocumentURL).toBe('https://example.test/b.xlsx')
    expect(normalizeExportDocument({ url: 'https://example.test/c.xlsx' }).DocumentURL).toBe('https://example.test/c.xlsx')
  })

  it('rejects empty export responses before a download modal opens', () => {
    const document = normalizeExportDocument({})

    expect(hasExportDocumentUrl(document)).toBe(false)
    expect(() => requireExportDocument({}, 'Документ недоступний')).toThrow('Документ недоступний')
  })
})
