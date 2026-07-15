import { buildProductUploadPriceConfigurations } from './productPricing'
import type { ProductFileUploadConfiguration, ProductFileUploadMode } from './types'

export type ProductFileUploadColumnForm = {
  descriptionRU: number
  descriptionUA: number
  endRow: number
  isForSale: number
  isForWeb: number
  mainOriginalNumber: number
  measureUnit: number
  nameRU: number
  nameUA: number
  newVendorCode: number
  orderStandard: number
  packingStandard: number
  productGroup: number
  size: number
  startRow: number
  top: number
  ucgfea: number
  vendorCode: number
  volume: number
  weight: number
}

export type ProductFileUploadPriceRow = {
  columnNumber: number
  key: string
  pricingId: string
}

export type ProductFileUploadForm = ProductFileUploadColumnForm & {
  file: File | null
  mode: ProductFileUploadMode
  priceSourceIsAmg: boolean | null
  prices: ProductFileUploadPriceRow[]
}

export function createProductFileUploadForm(): ProductFileUploadForm {
  return {
    descriptionRU: 0,
    descriptionUA: 0,
    endRow: 0,
    file: null,
    isForSale: 0,
    isForWeb: 0,
    mainOriginalNumber: 0,
    measureUnit: 0,
    mode: 0,
    nameRU: 0,
    nameUA: 0,
    newVendorCode: 0,
    orderStandard: 0,
    packingStandard: 0,
    priceSourceIsAmg: null,
    prices: [],
    productGroup: 0,
    size: 0,
    startRow: 0,
    top: 0,
    ucgfea: 0,
    vendorCode: 0,
    volume: 0,
    weight: 0,
  }
}

export function buildProductFileUploadConfiguration(form: ProductFileUploadForm): ProductFileUploadConfiguration {
  const priceConfigurations = buildProductUploadPriceConfigurations(form.prices)

  return {
    DescriptionPL: 0,
    DescriptionRU: form.descriptionRU,
    DescriptionUA: form.descriptionUA,
    EndRow: form.endRow,
    IsForSale: form.isForSale,
    IsForWeb: form.isForWeb,
    ...(priceConfigurations.length > 0 ? { ImportedForAmg: form.priceSourceIsAmg } : {}),
    MainOriginalNumber: form.mainOriginalNumber,
    MeasureUnit: form.measureUnit,
    Mode: form.mode,
    NamePL: 0,
    NameRU: form.nameRU,
    NameUA: form.nameUA,
    NewVendorCode: form.newVendorCode,
    OrderStandard: form.orderStandard,
    PackingStandard: form.packingStandard,
    PriceConfigurations: priceConfigurations,
    ProductGroup: form.productGroup,
    Size: form.size,
    StartRow: form.startRow,
    Top: form.top,
    UCGFEA: form.ucgfea,
    VendorCode: form.vendorCode,
    Volume: form.volume,
    Weight: form.weight,
    WithDescriptionPL: false,
    WithDescriptionRU: form.descriptionRU !== 0,
    WithDescriptionUA: form.descriptionUA !== 0,
    WithIsForSale: form.isForSale !== 0,
    WithIsForWeb: form.isForWeb !== 0,
    WithMainOriginalNumber: form.mainOriginalNumber !== 0,
    WithMeasureUnit: form.measureUnit !== 0,
    WithNamePL: false,
    WithNameRU: form.nameRU !== 0,
    WithNameUA: form.nameUA !== 0,
    WithNewVendorCode: form.newVendorCode !== 0,
    WithOrderStandard: form.orderStandard !== 0,
    WithPackingStandard: form.packingStandard !== 0,
    WithPrices: priceConfigurations.length > 0,
    WithProductGroup: form.productGroup !== 0,
    WithSize: form.size !== 0,
    WithTop: form.top !== 0,
    WithUCGFEA: form.ucgfea !== 0,
    WithVolume: form.volume !== 0,
    WithWeight: form.weight !== 0,
  }
}
