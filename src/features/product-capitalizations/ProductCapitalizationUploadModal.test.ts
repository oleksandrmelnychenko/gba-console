import { describe, expect, it } from 'vitest'
import {
  hasDuplicateProductCapitalizationImportColumns,
  type ProductCapitalizationUploadForm,
  toProductCapitalizationParseConfiguration,
} from './productCapitalizationUploadConfig'

const baseForm: ProductCapitalizationUploadForm = {
  endRow: 10,
  file: null,
  priceColumnNumber: '',
  pricePerItem: true,
  qtyColumnNumber: 2,
  startRow: 1,
  vendorCodeColumnNumber: 1,
  weightColumnNumber: '',
  weightPerItem: true,
}

describe('ProductCapitalizationUploadModal import configuration', () => {
  it('allows capitalization imports without a price column', () => {
    expect(toProductCapitalizationParseConfiguration(baseForm)).toMatchObject({
      EndRow: 10,
      PriceColumnNumber: 0,
      QtyColumnNumber: 2,
      StartRow: 1,
      VendorCodeColumnNumber: 1,
      WeightColumnNumber: 0,
      WithPrice: false,
      WithWeight: false,
    })
  })

  it('marks optional price and weight columns when they are provided', () => {
    expect(
      toProductCapitalizationParseConfiguration({
        ...baseForm,
        priceColumnNumber: 3,
        weightColumnNumber: 4,
      }),
    ).toMatchObject({
      PriceColumnNumber: 3,
      WeightColumnNumber: 4,
      WithPrice: true,
      WithWeight: true,
    })
  })

  it('detects duplicate configured columns', () => {
    expect(
      hasDuplicateProductCapitalizationImportColumns({
        EndRow: 10,
        PriceColumnNumber: 2,
        PricePerItem: true,
        QtyColumnNumber: 2,
        StartRow: 1,
        VendorCodeColumnNumber: 1,
        WeightColumnNumber: 0,
        WeightPerItem: true,
        WithPrice: true,
        WithWeight: false,
      }),
    ).toBe(true)
  })
})
