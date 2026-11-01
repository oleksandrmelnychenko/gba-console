import { expect, it } from 'vitest'
import { reportAxisCaption, type ReportCaptionAxisSchema } from './reportAxisCaption'
import { previewSharedNames } from './nativeReportPreview'

// New typed producer semantics only. These are unit inputs, not SQL/HTTP receipts.
const sources = ['NativeSalesNet', 'NativeCustomerGroupComparison'] as const
const schema = (): ReportCaptionAxisSchema => ({ Caption: 'Група товару', Identity: 'ProductGroup',
  Captioned: true, KeyKind: 'Text', DisplayKind: 'Text' })
const captions = ['A + B [2025]', 'Same (ID 9007199254740993) + Same (ID 9223372036854775807)',
  'Назва, з комою [17]', 'A + B (групи ID: 2, 10)']
it.each(sources.flatMap(source => captions.map(caption => ({ source, caption }))))(
  'retains supplied $source whole-set caption $caption independently of page siblings', ({ source, caption }) => {
    expect(reportAxisCaption(source, schema(), caption, previewSharedNames([caption]))).toBe(caption)
    expect(reportAxisCaption(source, schema(), caption, previewSharedNames(captions))).toBe(caption)
  })
it.each(sources.flatMap(source => ['Captioned', 'KeyKind', 'DisplayKind'].map(flag => ({ source, flag }))))(
  'keeps the legacy path for $source missing $flag', ({ source, flag }) => {
    const incomplete = schema();delete incomplete[flag as 'Captioned' | 'KeyKind' | 'DisplayKind']
    expect(reportAxisCaption(source, incomplete, 'A + B [2025]')).toBe('A + B')
  })
it.each(sources.flatMap(source => [
  { ...schema(), Captioned: 'true' }, { ...schema(), KeyKind: 'Numeric' }, { ...schema(), DisplayKind: 'Numeric' },
].map(value => ({ source, value }))))('keeps contradictory $source metadata on the legacy path', ({ source, value }) => {
  expect(reportAxisCaption(source, value, 'A + B [2025]')).toBe('A + B')
})
it.each(['NativePurchases', 'NativeStockPeriod'])('does not admit foreign %s complete-set text semantics', source => {
  expect(reportAxisCaption(source, schema(), 'A + B [2025]')).toBe('A + B')
})
it('keeps the already accepted generic source2 raw-text and source44 legacy-semantics paths', () => {
  expect(reportAxisCaption('NativeSalesNet', { ...schema(), Captioned: false }, 'A + B [2025]')).toBe('A + B [2025]')
  expect(reportAxisCaption('NativeCustomerGroupComparison', { ...schema(), Captioned: false }, 'A + B [2025]')).toBe('A + B')
})
