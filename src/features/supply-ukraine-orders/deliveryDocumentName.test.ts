import { describe, expect, it } from 'vitest'
import { getDeliveryDocumentName } from './deliveryDocumentName'

const t = (key: string) => key

describe('getDeliveryDocumentName', () => {
  it('shows the document type name before any file is uploaded', () => {
    expect(getDeliveryDocumentName({ SupplyDeliveryDocument: { Name: 'CMR' } }, t)).toBe('CMR')
  })

  it('falls back to the file name and then to a readable placeholder instead of an empty cell', () => {
    expect(getDeliveryDocumentName({ FileName: 'cmr.pdf', SupplyDeliveryDocument: { Name: null } }, t)).toBe('cmr.pdf')
    expect(getDeliveryDocumentName({ SupplyDeliveryDocument: { Name: '  ' } }, t)).toBe('Документ без назви')
  })
})

describe('getDeliveryDocumentName for an uploaded file without a stored name (chaos2-orders F18)', () => {
  it('takes the file name from the document URL', () => {
    expect(getDeliveryDocumentName({
      DocumentUrl: 'https://127.0.0.1:35981/Data/SupplyOrderDeliveryDocument/CMR%2017.11.pdf?v=2',
      SupplyDeliveryDocument: { Name: null },
    }, t)).toBe('CMR 17.11.pdf')
  })

  it('uses the generated name when there is no URL and keeps the placeholder for a bare host', () => {
    expect(getDeliveryDocumentName({ GeneratedName: 'SupplyOrderDeliveryDocument-1.pdf' }, t)).toBe('SupplyOrderDeliveryDocument-1.pdf')
    expect(getDeliveryDocumentName({ DocumentUrl: 'https://' }, t)).toBe('Документ без назви')
  })
})
