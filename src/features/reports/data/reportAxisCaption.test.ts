import { expect, it } from 'vitest'
import { previewSharedNames } from './nativeReportPreview'
import { reportAxisCaption, type ReportCaptionAxisSchema } from './reportAxisCaption'

const text = (Identity: string): ReportCaptionAxisSchema => ({ Caption: 'Опис', Identity, Captioned: false, KeyKind: 'Text', DisplayKind: 'Text' })
// Independent public report/axis cases; never generated from the implementation allowlist.
const rawCases = [
  ['NativeSalesNet', 'ProductArticle'], ['NativeSalesNet', 'ProductDescription'], ['NativeSalesNet', 'ProductTop'], ['NativeSalesNet', 'ProductSize'],
  ['NativeSalesNet', 'Organization'], ['NativeSalesNet', 'ProductGroup'], ['NativeSalesNet', 'CustomerRegion'], ['NativeSalesNet', 'CustomerManager'],
  ['NativeSalesNet', 'SaleDocumentManagerInput'], ['NativeSalesNet', 'SaleDocumentManagerPosted'],
  ['NativePurchases', 'ProductArticle'], ['NativePurchases', 'ProductDescription'], ['NativePurchases', 'ProductTop'], ['NativePurchases', 'ProductSize'], ['NativePurchases', 'Organization'],
  ['NativeCustomerGroupComparison', 'ProductArticle'], ['NativeCustomerGroupComparison', 'ProductDescription'], ['NativeCustomerGroupComparison', 'ProductTop'], ['NativeCustomerGroupComparison', 'ProductSize'],
  ['NativeStockPeriod', 'ProductArticle'], ['NativeStockPeriod', 'ProductDescription'], ['NativeStockPeriod', 'ProductTop'], ['NativeStockPeriod', 'ProductSize'],
  ['NativePriceComparison', 'ProductArticle'], ['NativePriceComparison', 'ProductDescription'], ['NativePriceComparison', 'ProductTop'], ['NativePriceComparison', 'ProductSize'], ['NativePriceComparison', 'Organization'],
]
it.each(rawCases)('preserves complete business brackets for %s/%s', (source, identity) => {
  const caption = 'Артикул [123], серія [id=-9]'
  expect(reportAxisCaption(source, text(identity), caption)).toBe(caption)
})
it('keeps raw captions independent of sibling ambiguity and visible page composition', () => {
  const captions = ['Опис [123]', 'Опис [456]']
  const alone = previewSharedNames([captions[0]])
  const together = previewSharedNames(captions)
  const first = reportAxisCaption('NativeSalesNet', text('ProductDescription'), captions[0], alone)
  expect(first).toBe(captions[0])
  expect(reportAxisCaption('NativeSalesNet', text('ProductDescription'), captions[0], together)).toBe(first)
  expect(reportAxisCaption('NativeSalesNet', text('ProductDescription'), captions[1], previewSharedNames([captions[1]]))).toBe(captions[1])
})
it.each(['', 'Не вказано', '∅', '—'])('keeps supplied null/empty presentation caption %j without deriving a label from its key', caption => {
  expect(reportAxisCaption('NativeStockPeriod', text('ProductTop'), caption)).toBe(caption)
})
it.each(['ProductDescription', 'ProductTop'])('retains P9 source46 legacy previews without semantic flags for %s', Identity => {
  expect(reportAxisCaption('NativePriceComparison', { Caption: 'Опис', Identity }, 'Бізнес [123]')).toBe('Бізнес [123]')
  expect(reportAxisCaption('NativePriceComparison', { Caption: 'Опис', Identity, Captioned: false }, 'Бізнес [123]')).toBe('Бізнес [123]')
})
const invalidCases: Array<[string | undefined, ReportCaptionAxisSchema | undefined]> = [
  ['NativeSalesNet', { Caption: 'Опис', Identity: 'ProductDescription' }],
  ['NativePurchases', { Caption: 'Опис', Identity: 'ProductDescription', Captioned: false }],
  ['NativeCustomerGroupComparison', { ...text('ProductDescription'), KeyKind: undefined }],
  ['NativeStockPeriod', { ...text('ProductDescription'), DisplayKind: undefined }],
  ['NativeSalesNet', { ...text('Organization'), Captioned: true, KeyKind: 'Numeric' }],
  ['NativeCustomerGroupComparison', { ...text('Organization'), Captioned: true, KeyKind: 'Numeric' }],
  ['NativeSalesNet', { ...text('ProductDescription'), Captioned: 'false' }],
  ['NativeStockPeriod', { ...text('ProductDescription'), KeyKind: 'text' }],
  ['NativePurchases', { ...text('ProductDescription'), DisplayKind: 'Numeric' }],
  ['NativePriceComparison', { ...text('ProductDescription'), Captioned: true }],
  ['NativePriceComparison', { ...text('ProductTop'), KeyKind: 'Numeric' }],
  ['NativePriceComparison', { ...text('ProductDescription'), DisplayKind: null }],
  ['NativePriceComparison', text('UnknownFutureField')], ['NativeSalesNet', text('UnknownFutureField')],
  ['NativeStockPeriod', { ...text('ProductDescription'), Identity: 8 }],
  ['Operational', text('ProductDescription')], ['UnknownNativeSource', text('ProductDescription')],
  [undefined, text('ProductDescription')], ['NativeSalesNet', undefined],
]
it.each(invalidCases)('keeps established caption handling for absent, foreign or contradictory semantics (%s)', (source, schema) => {
  expect(reportAxisCaption(source, schema, 'Бізнес [123]')).toBe('Бізнес')
})
it.each([['NativeSalesNet', 'Product'], ['NativeCustomerGroupComparison', 'CustomerName'], ['NativeSalesNet', 'CustomerContract'], ['NativeSalesNet', 'SaleDocument'], ['NativeStockPeriod', 'StockWarehouse'], ['NativeStockPeriod', 'StockConsignmentItem']])('retains the scoped entity caption policy and duplicate-name disambiguation for %s/%s', (source, Identity) => {
  const entity = { Caption: 'Сутність', Identity, Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }
  expect(reportAxisCaption(source, entity, 'Сутність [9007199254740993]')).toBe(source === 'NativeStockPeriod' ? 'Сутність [9007199254740993]' : 'Сутність')
  const shared = previewSharedNames(['Сутність [9007199254740993]', 'Сутність [9223372036854775807]'])
  expect(reportAxisCaption(source, entity, 'Сутність [9007199254740993]', shared)).toBe('Сутність [9007199254740993]')
})

const nativeEntities = [
  ['NativePurchases', 'Organization'], ['NativePurchases', 'Product'], ['NativePurchases', 'ProductName'],
  ['NativePurchases', 'Supplier'], ['NativePurchases', 'PurchaseDocument'], ['NativePurchases', 'SupplierContract'],
  ['NativePurchases', 'ProductMeasureUnit'], ['NativePurchases', 'StockWarehouse'],
  ['NativeStockPeriod', 'Product'], ['NativeStockPeriod', 'ProductName'], ['NativeStockPeriod', 'PurchaseDocument'],
  ['NativeStockPeriod', 'ProductMeasureUnit'], ['NativeStockPeriod', 'StockWarehouse'],
  ['NativeStockPeriod', 'StockConsignmentItem'], ['NativeStockPeriod', 'StockOrganization'],
]
it.each(nativeEntities)('keeps producer-supplied %s/%s identity on separate one-row pages and together', (source, Identity) => {
  const schema = { Caption: 'Назва', Identity, Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }
  for (const caption of ['Однакова назва [101]', 'Однакова назва [102]']) {
    expect(reportAxisCaption(source, schema, caption, previewSharedNames([caption]))).toBe(caption)
    expect(reportAxisCaption(source, schema, caption, previewSharedNames(['Однакова назва [101]', 'Однакова назва [102]']))).toBe(caption)
  }
})
const untrustedEntities: Array<[string, ReportCaptionAxisSchema]> = [
  ['NativePurchases', { Caption: 'Товар', Identity: 'Product', KeyKind: 'Numeric', DisplayKind: 'Text' }],
  ['NativePurchases', { Caption: 'Товар', Identity: 'Product', Captioned: true, DisplayKind: 'Text' }],
  ['NativePurchases', { Caption: 'Товар', Identity: 'Product', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Numeric' }],
  ['NativePurchases', { Caption: 'Товар', Identity: 'Product', Captioned: false, KeyKind: 'Numeric', DisplayKind: 'Text' }],
  ['NativePurchases', { Caption: 'Товар', Identity: 'FutureEntity', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }],
  ['NativeStockPeriod', { Caption: 'Організація', Identity: 'Organization', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }],
  ['NativeSalesNet', { Caption: 'Товар', Identity: 'Product', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }],
  ['NativePriceComparison', { Caption: 'Організація', Identity: 'Organization', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }],
]
it.each(untrustedEntities)('keeps legacy cleanup for untrusted entity source/identity/flags %s', (source, schema) => {
  expect(reportAxisCaption(source, schema, 'Назва [101]')).toBe('Назва')
})
it('does not invent IDs for a supplied plain native stock unit caption or an empty entity caption', () => {
  const schema = { Caption: 'Од.', Identity: 'ProductMeasureUnit', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }
  expect(reportAxisCaption('NativeStockPeriod', schema, 'шт.')).toBe('шт.')
  expect(reportAxisCaption('NativePurchases', schema, '')).toBe('')
})
