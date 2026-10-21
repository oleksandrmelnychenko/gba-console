import { describe, expect, it } from 'vitest'
import { defaultDatasetRequest } from './reportDatasets'
import { profitDayDataset, profitSupplierDataset } from './profitReadMode.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { bindProfitPreviewGrouping, bindWorkbookPreview } from './workbookPreview'
import { workbookPreview } from './workbookPresentation.test-fixtures'

const identities: Record<number, string> = { 3: 'Day', 4: 'Organization', 21: 'Supplier', 73: 'SourceReceiptStorage', 78: 'SourceRegistrarWarehouse' }
const numbers = { version: 1 as const, moneyScale: 1000 as const, decimalPlacesByKind: { money: 3 } }
function fixture(source: 35 | 38, axes: number[]) {
  const request = defaultDatasetRequest(source === 35 ? profitDayDataset : profitSupplierDataset, '2026-10-01', '2026-10-20')
  request.sorted.Row = axes.map(type => ({ type, key: String(type), label: String(type) }))
  request.sorted.Col = []
  request.numberPresentation = numbers
  const { workbookPresentation: proof, ...base } = workbookPreview()
  const raw = { ...base, Request: { ...base.Request, DataSource: source === 35 ? 'NativeDayOrganizationGrossProfit' : 'NativeSupplierGrossProfit' },
    RowSchema: axes.map(type => ({ Identity: identities[type], Caption: 'Перекладена назва' })),
    Rows: [{ ...base.Rows[0], Values: axes.map(() => ({ Caption: 'Значення' })) }],
    Cells: [{ ...base.Cells[0], Value: { Kind: 'decimal', Value: '1234.56789123456789', Provenance: 'producerCell' } }],
    numberPresentation: numbers,
    valueSemantics: [{ columnSourceIndex: 0, measureType: 2, semantics: { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2, defaultMinimumDecimalPlaces: 2 } }],
    ...(source === 35 ? { workbookPresentation: { ...proof,
      selection: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' },
      fields: [2, 3].map(type => ({ type, caption: 'Додаткове поле', placement: 'retainedSetting' })), rows: [] } } : {}) }
  if (source === 35) request.workbookPresentation = { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' }
  return { request, raw }
}
function subsets(values: number[]): number[][] {
  return values.flatMap(value => [[value], ...subsets(values.filter(item => item !== value)).map(tail => [value, ...tail])])
}
describe('editable profit grouping response proof', () => {
  it.each([[3, 4], [4, 3], [3], [4]].map(axes => [axes]))('accepts day layout %j with workbook and numeric settings without changing raw decimals', axes => {
    const { request, raw } = fixture(35, axes)
    const preview = normalizeNativeReportPreview({ Preview: raw })
    expect(() => bindWorkbookPreview(request, preview)).not.toThrow()
    expect(() => bindProfitPreviewGrouping(request, preview)).not.toThrow()
    expect(preview.Cells[0].Value.Value).toBe('1234.56789123456789')
    expect(preview.numberPresentation).toEqual(numbers)
    expect(preview.WorkbookPresentation?.selection.additionalFields).toEqual([2, 3])
  })
  it.each([...subsets([78, 4, 21]), ...subsets([73, 4, 21])].map(axes => [axes]))('accepts supplier layout %j with exact requested identities', axes => {
    const { request, raw } = fixture(38, axes)
    const preview = normalizeNativeReportPreview({ Preview: raw })
    expect(() => bindProfitPreviewGrouping(request, preview)).not.toThrow()
    expect(preview.Cells[0].Value.Value).toBe('1234.56789123456789')
  })
  it.each([35, 38] as const)('rejects a valid but different grouping in source %i', source => {
    const axes = source === 35 ? [3, 4] : [78, 4, 21]
    const { request } = fixture(source, axes)
    const { raw } = fixture(source, [...axes].reverse())
    expect(() => bindProfitPreviewGrouping(request, normalizeNativeReportPreview({ Preview: raw }))).toThrow('інше групування')
  })
  it('preserves allocation warehouse identity even with hidden warehouse and rejects mixed warehouses', () => {
    const { request, raw } = fixture(38, [73, 21])
    expect(() => bindProfitPreviewGrouping(request, normalizeNativeReportPreview({ Preview: raw }))).not.toThrow()
    const mixed = fixture(38, [73, 78])
    expect(() => bindProfitPreviewGrouping(mixed.request, normalizeNativeReportPreview({ Preview: mixed.raw }))).toThrow('інше групування')
  })
  it.each([[], [3, 3], [78], [3, 4, 21]].map(axes => [axes]))('does not weaken day workbook identity whitelist for %j', axes => {
    const { raw } = fixture(35, axes)
    expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow('непідтверджені')
  })
  it('rejects row values inconsistent with the declared grouping', () => {
    const { request, raw } = fixture(38, [4, 21])
    raw.Rows[0].Values.pop()
    expect(() => bindProfitPreviewGrouping(request, normalizeNativeReportPreview({ Preview: raw }))).toThrow('інше групування')
  })
})
