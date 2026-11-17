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
