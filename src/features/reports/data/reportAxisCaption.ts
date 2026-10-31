import { previewCaptionText } from './nativeReportPreview'

/** Optional wire metadata: missing or malformed semantics use the established presentation path. */
export type ReportCaptionAxisSchema = {
  Caption: string
  Identity?: unknown
  Captioned?: unknown
  KeyKind?: unknown
  DisplayKind?: unknown
}

// Audited producer-owned raw keys. Named-profile identity overrides still require Captioned=false.
const rawTextAxes: Readonly<Record<string, ReadonlySet<string>>> = {
  NativeSalesNet: new Set(['ProductArticle', 'ProductDescription', 'ProductTop', 'ProductSize',
    'Organization', 'ProductGroup', 'CustomerRegion', 'CustomerManager', 'SaleDocumentManagerInput', 'SaleDocumentManagerPosted']),
  NativePurchases: new Set(['ProductArticle', 'ProductDescription', 'ProductTop', 'ProductSize', 'Organization']),
  NativeCustomerGroupComparison: new Set(['ProductArticle', 'ProductDescription', 'ProductTop', 'ProductSize']),
  NativeStockPeriod: new Set(['ProductArticle', 'ProductDescription', 'ProductTop', 'ProductSize']),
  NativePriceComparison: new Set(['ProductArticle', 'ProductDescription', 'ProductTop', 'ProductSize', 'Organization']),
}

// These native producers supply globally resolved captions before paging; never remove their IDs per page.
const suppliedEntityAxes: Readonly<Record<string, ReadonlySet<string>>> = {
  NativePurchases: new Set(['Organization', 'Product', 'ProductName', 'Supplier', 'PurchaseDocument',
    'SupplierContract', 'ProductMeasureUnit', 'StockWarehouse']),
  NativeStockPeriod: new Set(['Product', 'ProductName', 'PurchaseDocument', 'ProductMeasureUnit',
    'StockWarehouse', 'StockConsignmentItem', 'StockOrganization']),
}
function isSuppliedEntityCaption(source: string | undefined, schema: ReportCaptionAxisSchema | undefined): boolean {
  if (typeof source !== 'string' || typeof schema?.Identity !== 'string') return false
  return Object.hasOwn(suppliedEntityAxes, source) && suppliedEntityAxes[source]?.has(schema.Identity) === true
    && schema.Captioned === true && schema.KeyKind === 'Numeric' && schema.DisplayKind === 'Text'
}

export function reportAxisCaption(source: string | undefined, schema: ReportCaptionAxisSchema | undefined,
  caption: string, sharedNames?: ReadonlySet<string>): string {
  if (isSuppliedEntityCaption(source, schema)) return caption
  const identity = schema?.Identity
  const admitted = typeof source === 'string' && typeof identity === 'string'
    && Object.hasOwn(rawTextAxes, source) && rawTextAxes[source]?.has(identity) === true
  if (admitted && schema?.Captioned === false && schema.KeyKind === 'Text' && schema.DisplayKind === 'Text') return caption

  // P9 already preserves these two source46 raw axes on older previews without semantic flags.
  // An explicit conflicting flag must never turn a numeric or entity axis into raw text.
  const legacySource46 = source === 'NativePriceComparison'
    && (identity === 'ProductDescription' || identity === 'ProductTop')
  const compatibleFlags = schema != null
    && (schema.Captioned === undefined || schema.Captioned === false)
    && (schema.KeyKind === undefined || schema.KeyKind === 'Text')
    && (schema.DisplayKind === undefined || schema.DisplayKind === 'Text')
  if (legacySource46 && compatibleFlags) return caption
  return previewCaptionText(caption, sharedNames)
}
