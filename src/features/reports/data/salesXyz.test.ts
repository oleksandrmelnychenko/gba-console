import { describe, expect, it } from 'vitest'
import { defaultDatasetRequest, datasetConfigurationError, datasetPresetRequest } from './reportDatasets'
import { defaultXyzOptions, salesXyzConfigurationError, xyzCalendarError, xyzOptions, XYZ_POLICIES } from './salesXyz'
import { salesXyzDataset, salesXyzRequest } from './salesXyz.test-fixtures'
import type { ReportRequestBody } from '../types'
const now = new Date('2026-09-08T12:00:00Z')
const valid = (data: ReportRequestBody) => salesXyzConfigurationError(data, salesXyzDataset, now)

describe('source15 exact settings contract', () => {
  it('defaults fixed rows, no column axis and three measures; preserves dates', () => {
    const data = defaultDatasetRequest(salesXyzDataset, '2026-07-03', '2026-07-31')
    expect(data.sorted.Row.map(v => v.type)).toEqual([51, 5]); expect(data.sorted.Col).toEqual([])
    expect(data.sorted.Measurements.map(v => v.Type)).toEqual([32, 33, 34])
    expect(data.from).toBe('2026-07-03'); expect(data.to).toBe('2026-07-31')
    expect(valid(data)).toMatch(/Повні місяці/)
    expect(valid(salesXyzRequest())).toBeNull()
  })
  it.each(Array.from({ length: 7 }, (_, i) => i + 1))('accepts active subset mask %s with omitted/null flags', mask => {
    const data = salesXyzRequest()
    data.sorted.Measurements = data.sorted.Measurements.filter((_, i) => mask & 1 << i).map(m => ({ ...m, IsChecked: null })) as unknown as ReportRequestBody['sorted']['Measurements']
    expect(valid(data)).toBeNull(); expect(datasetConfigurationError(data, salesXyzDataset)).toBeNull()
  })
  it('preserves inverted, negative, overlapping and gapped bounds through preset cloning', () => {
    const data = salesXyzRequest(), options = defaultXyzOptions()
    options.Bounds = { XLower: 50, XUpper: -4.12, YLower: -99.99, YUpper: 45, ZLower: 900, ZUpper: 10000.12 }
    data.xyz = options
    expect(valid(data)).toBeNull()
    const preset = datasetPresetRequest(salesXyzDataset, 'sales-xyz-by-product', data)!.Data
    expect(preset.xyz).toEqual(options); expect(preset.xyz).not.toBe(options)
    expect(preset.from).toBe(data.from); expect(preset.to).toBe(data.to)
  })
  it.each([null, {}, { ...defaultXyzOptions(), extra: true }, { ...defaultXyzOptions(), Version: 2 },
    { ...defaultXyzOptions(), PeriodCount: 0 }, { ...defaultXyzOptions(), PeriodCount: 61 }, { ...defaultXyzOptions(), PeriodCount: 1.5 },
    { ...defaultXyzOptions(), Bounds: { ...defaultXyzOptions().Bounds, XLower: 0.001 } },
    { ...defaultXyzOptions(), Bounds: { ...defaultXyzOptions().Bounds, XLower: '0' } },
    { ...defaultXyzOptions(), Bounds: { ...defaultXyzOptions().Bounds, xlower: 1 } },
  ])('rejects malformed XYZ without normalization: %j', xyz => expect(valid({ ...salesXyzRequest(), xyz })).toBeTruthy())
  it.each(['comparison', 'ordering', 'topGroups', 'threshold', 'hideZero', 'abcClassification', 'oneC', 'valuationClientAgreementId'])('rejects unsupported %s', key => {
    expect(valid({ ...salesXyzRequest(), [key]: {} })).toBeTruthy()
  })
  it.each(Array.from({ length: 15 }, (_, i) => i))('rejects XYZ on old source %s', dataSource => {
    expect(salesXyzConfigurationError({ ...salesXyzRequest(), dataSource })).toMatch(/лише XYZ/)
  })
  it('accepts one case alias, rejects duplicate aliases and preserves unrelated descriptors', () => {
    const data = salesXyzRequest(), options = data.xyz; delete data.xyz; data.Xyz = options
    expect(valid(data)).toBeNull(); expect(valid({ ...data, xyz: options })).toMatch(/двічі/)
    expect(xyzOptions(Object.fromEntries(Object.entries(defaultXyzOptions()).map(([k,v]) => [k.toLowerCase(),v])))).toEqual(defaultXyzOptions())
  })
  it('preserves exact ClientAgreement string IDs, descriptive Value0, disabled selection indices and AND/OR', () => {
    const data = salesXyzRequest()
    data.selections = [
      { IsChecked: false, SelectedField: { Type: 999, Name: 'disabled' }, FilterCondition: { Type: 0 }, Values: [] },
      { SelectedField: { Type: 9, Name: 'arbitrary descriptor' }, FilterCondition: { Type: 2 },
        Values: [{ Data: '{"Id":"9223372036854775807","AgreementId":900}', Name: 'descriptor', Value: 0 }] },
    ] as unknown as ReportRequestBody['selections']
    data.filterExpression = { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } }
    const before = structuredClone(data)
    expect(valid(data)).toBeNull(); expect(data).toEqual(before)
  })
  it.each(['{"Id":1,"Id":2}', '{"Id":1,"id":2}', '{"\\u0049d":1,"Id":2}', '1', '{"Id":0}', '{"AgreementId":9}', '{"Id":"9223372036854775808"}', '{"Id":9007199254740992}'])('rejects ambiguous or unsafe filter Data %s', Data => {
    const data = salesXyzRequest()
    data.selections = [{ SelectedField: { Type: 9 }, FilterCondition: { Type: 0 }, Values: [{ Data, Value: 0 }] }] as unknown as ReportRequestBody['selections']
    expect(valid(data)).toBeTruthy()
  })
})
describe('explicit calendar policies', () => {
  it('requires exact completed calendar months and evaluates completion in Kyiv', () => {
    const options = { ...defaultXyzOptions(), PeriodCount: 1 }
    expect(xyzCalendarError('2026-08-01', '2026-08-31', options, new Date('2026-08-31T20:59:59Z'))).toMatch(/завершені/)
    expect(xyzCalendarError('2026-08-01', '2026-08-31', options, new Date('2026-08-31T21:00:00Z'))).toBeNull()
    expect(xyzCalendarError('2026-08-02', '2026-08-31', options, now)).toMatch(/Повні місяці/)
  })
  it.each([
    ['2026-04-16', '2026-07-15', 3], ['2024-03-01', '2024-03-31', 1], ['2025-03-01', '2025-03-31', 1],
    ['2030-05-31', '2030-06-30', 1], ['1900-01-01', '1900-01-31', 1],
  ])('accepts .NET clamp then plus one day %s / %s / N%s including future To', (from, to, n) => {
    expect(xyzCalendarError(from, to, { ...defaultXyzOptions(), CalendarPolicy: XYZ_POLICIES[1], PeriodCount: n }, now)).toBeNull()
  })
  it('explains the touched window equation without changing either date', () => {
    expect(xyzCalendarError('2026-04-15', '2026-07-15', { ...defaultXyzOptions(), CalendarPolicy: XYZ_POLICIES[1] }, now)).toMatch(/2026-04-16/)
  })
})
