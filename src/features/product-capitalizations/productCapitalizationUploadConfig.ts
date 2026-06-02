import type { ProductCapitalizationParseConfiguration } from './types'

export type ProductCapitalizationUploadForm = {
  endRow: number | ''
  files: File[]
  priceColumnNumber: number | ''
  pricePerItem: boolean
  qtyColumnNumber: number | ''
  startRow: number | ''
  vendorCodeColumnNumber: number | ''
  weightColumnNumber: number | ''
  weightPerItem: boolean
}

export function toProductCapitalizationParseConfiguration(
  form: ProductCapitalizationUploadForm,
): ProductCapitalizationParseConfiguration | null {
  if (!form.startRow || !form.endRow || !form.vendorCodeColumnNumber || !form.qtyColumnNumber) {
    return null
  }

  const priceColumnNumber = form.priceColumnNumber || 0
  const weightColumnNumber = form.weightColumnNumber || 0

  return {
    EndRow: form.endRow,
    PriceColumnNumber: priceColumnNumber,
    PricePerItem: form.pricePerItem,
    QtyColumnNumber: form.qtyColumnNumber,
    StartRow: form.startRow,
    VendorCodeColumnNumber: form.vendorCodeColumnNumber,
    WeightColumnNumber: weightColumnNumber,
    WeightPerItem: form.weightPerItem,
    WithPrice: priceColumnNumber > 0,
    WithWeight: weightColumnNumber > 0,
  }
}

export function hasDuplicateProductCapitalizationImportColumns(
  parseConfiguration: ProductCapitalizationParseConfiguration,
): boolean {
  const columns = [
    parseConfiguration.PriceColumnNumber,
    parseConfiguration.QtyColumnNumber,
    parseConfiguration.VendorCodeColumnNumber,
  ]

  if (parseConfiguration.WeightColumnNumber > 0) {
    columns.push(parseConfiguration.WeightColumnNumber)
  }

  return new Set(columns).size !== columns.length
}
