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

export type ProductFileUploadPriceSource = 'fenix' | 'amg' | 'both'

export type ProductFileUploadForm = ProductFileUploadColumnForm & {
  file: File | null
  mode: ProductFileUploadMode
  nativeIsService: boolean | null
  priceSource: ProductFileUploadPriceSource | null
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
    nativeIsService: null,
    nameUA: 0,
    newVendorCode: 0,
    orderStandard: 0,
    packingStandard: 0,
    priceSource: null,
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
    ...(priceConfigurations.length > 0 ? buildPriceSourceConfiguration(form.priceSource) : {}),
    MainOriginalNumber: form.mainOriginalNumber,
    MeasureUnit: form.measureUnit,
    Mode: form.mode,
    ...(form.mode === 0 ? { NativeIsService: form.nativeIsService } : {}),
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

function buildPriceSourceConfiguration(
  priceSource: ProductFileUploadPriceSource | null,
): Pick<ProductFileUploadConfiguration, 'ImportedForAmg' | 'ImportedForBothWorlds'> {
  if (priceSource === 'both') {
    return { ImportedForBothWorlds: true }
  }

  return { ImportedForAmg: priceSource === null ? null : priceSource === 'amg' }
}

export type ProductFileUploadSkippedRow = {
  reason: string
  row: number
  vendorCode: string
}

/** What the server did with the file: how many rows were applied and which rows it left out, with the reason. */
export type ProductFileUploadResult = {
  processed: number
  skipped: ProductFileUploadSkippedRow[]
}

/** Reads the upload answer. An older API answers with no body — that is `null`, not "nothing was applied". */
export function normalizeProductFileUploadResult(body: unknown): ProductFileUploadResult | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const source = body as Record<string, unknown>
  const processed = Number(source.Processed ?? source.processed)
  const skippedSource = source.Skipped ?? source.skipped

  if (!Number.isFinite(processed)) {
    return null
  }

  return {
    processed,
    skipped: (Array.isArray(skippedSource) ? skippedSource : []).map((item) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>

      return {
        reason: String(row.Reason ?? row.reason ?? ''),
        row: Number(row.Row ?? row.row) || 0,
        vendorCode: String(row.VendorCode ?? row.vendorCode ?? ''),
      }
    }),
  }
}

/** Rows the server will read: «З» … «По», both included. */
export function countProductFileUploadRows(form: Pick<ProductFileUploadForm, 'endRow' | 'startRow'>): number {
  return form.startRow > 0 && form.endRow >= form.startRow ? form.endRow - form.startRow + 1 : 0
}

const productFileUploadDoneMessages: Record<ProductFileUploadMode, string> = {
  0: 'Товари з файлу додано',
  1: 'Товари з файлу оновлено',
  2: 'Товари з файлу видалено',
}

/** The success text names the operation that was sent, never a fixed "added". */
export function getProductFileUploadDoneMessage(mode: ProductFileUploadMode): string {
  return productFileUploadDoneMessages[mode]
}

export function getProductFileUploadSkipReasonLabel(reason: string): string {
  switch (reason) {
    case 'DuplicateInFile':
      return 'код повторюється у файлі'
    case 'AlreadyExists':
      return 'товар з таким кодом уже існує'
    case 'NotFound':
      return 'товар з таким кодом не знайдено'
    case 'NewVendorCodeTaken':
      return 'новий код уже зайнятий'
    default:
      return 'рядок пропущено'
  }
}
