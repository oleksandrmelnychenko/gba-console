import { expect, it } from 'vitest'
import { reportAxisCaption, type ReportCaptionAxisSchema } from './reportAxisCaption'
import { previewSharedNames } from './nativeReportPreview'

// Independent P13 public contract cases. Inputs are unit examples, not SQL/HTTP receipts.
const cases = [
  ['ProductGroup', 'Text'], ['CustomerRegion', 'Numeric'], ['CustomerRegionCode', 'Numeric'],
  ['CustomerManager', 'Numeric'], ['SaleReturnDocument', 'Numeric'],
] as const
const descriptor = (Identity: string, KeyKind: string): ReportCaptionAxisSchema =>
  ({ Caption: 'Вісь', Identity, Captioned: true, KeyKind, DisplayKind: 'Text' })

it.each(cases)('preserves the complete supplied source46 %s business caption including numeric brackets', (identity, kind) => {
  expect(reportAxisCaption('NativePriceComparison', descriptor(identity, kind), 'Бізнес [2025]')).toBe('Бізнес [2025]')
})
it.each(cases)('keeps source46 %s disambiguation stable on separate pages and together', (identity, kind) => {
  const schema = descriptor(identity, kind), captions = ['Однакова назва [9007199254740993]', 'Однакова назва [9223372036854775807]']
  for (const caption of captions) {
    expect(reportAxisCaption('NativePriceComparison', schema, caption, previewSharedNames([caption]))).toBe(caption)
    expect(reportAxisCaption('NativePriceComparison', schema, caption, previewSharedNames(captions))).toBe(caption)
  }
})
const missingFlags = cases.flatMap(([identity, kind]) => ['Captioned', 'KeyKind', 'DisplayKind'].map(flag => ({ identity, kind, flag })))
it.each(missingFlags)('uses legacy cleanup for source46 $identity with missing $flag', ({ identity, kind, flag }) => {
  const schema = { ...descriptor(identity, kind) }
  delete schema[flag as 'Captioned' | 'KeyKind' | 'DisplayKind']
  expect(reportAxisCaption('NativePriceComparison', schema, 'Бізнес [2025]')).toBe('Бізнес')
})
it.each(cases)('does not broaden source2 or44 entity handling for %s', (identity, kind) => {
  for (const source of ['NativeSalesNet', 'NativeCustomerGroupComparison'])
    expect(reportAxisCaption(source, descriptor(identity, kind), 'Бізнес [2025]')).toBe(identity === 'ProductGroup' ? 'Бізнес [2025]' : 'Бізнес')
})
const conflicting: ReportCaptionAxisSchema[] = [
  { ...descriptor('ProductGroup', 'Text'), Captioned: false },
  descriptor('ProductGroup', 'Numeric'), descriptor('CustomerRegion', 'Text'),
  descriptor('CustomerRegionCode', 'Text'), descriptor('CustomerManager', 'Text'),
  descriptor('SaleReturnDocument', 'Text'), { ...descriptor('CustomerManager', 'Numeric'), Captioned: 'true' },
  { ...descriptor('ProductGroup', 'Text'), DisplayKind: 'Numeric' },
  descriptor('UnknownFutureAxis', 'Numeric'), descriptor('SaleDocumentManagerInput', 'Text'),
  descriptor('SaleDocumentManagerPosted', 'Text'), descriptor('Supplier', 'Text'),
]
it.each(conflicting)('keeps legacy behavior for contradictory or unadmitted source46 semantics %#', schema => {
  expect(reportAxisCaption('NativePriceComparison', schema, 'Бізнес [2025]')).toBe('Бізнес')
})
it.each(['Продажі', '∅', '', 'Повернення 0003 [2025]'])('does not invent an own-return or null-bucket label for supplied %j', caption => {
  expect(reportAxisCaption('NativePriceComparison', descriptor('SaleReturnDocument', 'Numeric'), caption)).toBe(caption)
})
