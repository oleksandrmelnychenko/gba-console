import { describe, expect, it } from 'vitest'
import { currentFinancialProductTimeAxesCapability } from './currentFinancialProductTimeAxes'
import { productTimeAxes, productTimeDataset, productTimeRequest } from './currentFinancialProductTimeAxes.test-fixtures'
import { currentFinancialDataset } from './currentFinancialAxes.test-fixtures'
import { financialDataset, financialSourceFilters } from './financialAxes.test-fixtures'
import { datasetConfigurationError, datasetGroupings } from './reportDatasets'
import { reportAxesPolicy } from './reportConfiguration'
import { parseReportDatasets, normalizeSavedTemplate } from '../api/reportWorkspaceApi'

describe('CurrentDocuments financial product/time capability', () => {
  it('adds server descriptors once, retaining both older capabilities and grouping catalog', () => {
    const parsed = parseReportDatasets([productTimeDataset])[0]
    expect(parsed.Groupings).toEqual(financialDataset.Groupings)
    expect(parsed.currentFinancialAxes).toEqual(currentFinancialDataset.currentFinancialAxes)
    expect(parsed.financialAxes).toEqual(financialDataset.financialAxes)
    expect(datasetGroupings(parsed).map(f => f.type)).toEqual([3, 4])
    expect(datasetGroupings(parsed, productTimeRequest()).map(f => f.type)).toEqual([3, 4, 0, 1, 2, 5, 12, 15])
    expect(reportAxesPolicy(parsed, productTimeRequest()).config).toMatchObject({
      allowedRows: productTimeAxes.allowedRows, allowedColumns: productTimeAxes.allowedColumns, maximumTotalDimensions: 2, maximumColumns: 1,
    })
    expect(parsed.Measurements).toEqual(currentFinancialDataset.Measurements)
  })
  it.each([null, {}, { ...productTimeAxes, version: 2 }, { ...productTimeAxes, quantitySupported: true },
    { ...productTimeAxes, maximumOutputColumns: 512 }, { ...productTimeAxes, maximumTotalDimensions: 3 },
    { ...productTimeAxes, requiredProfitReadMode: 1 }, { ...productTimeAxes, requiredDayOrganizationBasis: 1 },
    { ...productTimeAxes, allowedRows: [0, 1, 2, 3, 4, 5, 6, 9] },
    { ...productTimeAxes, groupings: productTimeAxes.groupings.slice(1) },
    { ...productTimeAxes, groupings: productTimeAxes.groupings.map(f => ({ ...f, Selectable: false })) },
  ])('rejects unconfirmed metadata %j', currentFinancialProductTimeAxes => {
    const dataset = { ...productTimeDataset, currentFinancialProductTimeAxes }
    expect(currentFinancialProductTimeAxesCapability(dataset)).toBeUndefined()
    expect(() => parseReportDatasets([dataset])).toThrow()
  })
  it.each([[[5], [2]], [[2], [5]], [[0, 4], []], [[1, 5], []], [[5, 12], []], [[15], [5]], [[0], [1]], [[2], []]])(
    'accepts admitted axes %j / %j without changing period, filters or measures', (rows, cols) => {
      const request = { ...productTimeRequest(rows, cols), ...financialSourceFilters }, before = structuredClone(request)
      expect(datasetConfigurationError(request, productTimeDataset)).toBeNull()
      expect(request).toEqual(before)
    })
  it.each([[[], [5]], [[5, 12], [2]], [[5], [1, 2]], [[5], [5]], [[5, 5], []], [[6], [5]]])(
    'rejects unsupported layout %j / %j without silently dropping fields', (rows, cols) => {
      const data = productTimeRequest(rows, cols), before = structuredClone(data)
      expect(datasetConfigurationError(data, productTimeDataset)).not.toBeNull()
      expect(data).toEqual(before)
    })
  it('keeps older metadata usable without allowing new fields and does not extend period/quantity support', () => {
    for (const dataset of [financialDataset, currentFinancialDataset]) {
      expect(parseReportDatasets([dataset])[0]).toBeTruthy()
      expect(datasetConfigurationError(productTimeRequest(), dataset)).toContain('не підтвердив')
    }
    expect(datasetGroupings(currentFinancialDataset, productTimeRequest()).map(f => f.type)).toEqual([3, 4, 12, 15])
    expect(datasetConfigurationError(productTimeRequest([12], [15]), currentFinancialDataset)).toBeNull()
    expect(currentFinancialProductTimeAxesCapability({ ...productTimeDataset, DataSource: 38 })).toBeUndefined()
    expect(datasetConfigurationError({ ...productTimeRequest(), from: '2026-01-01', to: '2026-12-31' }, productTimeDataset)).not.toBeNull()
    const quantity = productTimeRequest()
    quantity.sorted.Measurements = [{ Type: 0, Name: 'Qty', IsChecked: true, parentName: '' }]
    expect(datasetConfigurationError(quantity, productTimeDataset)).not.toBeNull()
  })
  it.each([{ profitReadMode: 1 }, { profitReadMode: undefined }, { profitReadMode: null }, { dayOrganizationBasis: 1 },
    { dayOrganizationBasis: undefined }, { ProfitReadMode: 0 }, { DayOrganizationBasis: 0 }])('blocks incompatible mode/aliases %j while keeping selection', patch => {
    const request = { ...productTimeRequest(), ...financialSourceFilters, ...patch }, before = structuredClone(request)
    expect(datasetConfigurationError(request, productTimeDataset)).toContain('Поточних документів GBA')
    expect(request).toEqual(before)
  })
  it('restores product/time saved settings without mode inference and validates the current capability', () => {
    const request = productTimeRequest([2, 5], [])
    const saved = normalizeSavedTemplate({ Id: '10000000-0000-4000-8000-000000000035', Revision: 1, Name: 'Товари за місяцями', UpdatedAtUtc: '2026-10-25T10:00:00Z',
      Data: { DataSource: 35, From: request.from, To: request.to, Sorted: request.sorted, Selections: request.selections,
        ProfitReadMode: 0, DayOrganizationBasis: 0 } })
    expect(saved.Data.sorted).toEqual(request.sorted)
    expect(datasetConfigurationError(saved.Data, productTimeDataset)).toBeNull()
    expect(datasetConfigurationError(saved.Data, currentFinancialDataset)).toContain('не підтвердив')
    expect(saved.Data.from).toBe(request.from)
    expect(saved.Data.to).toBe(request.to)
  })
})

it('BUG-1453 admits date/organization by month only with the additive server capability', () => {
  const request = productTimeRequest([3, 4], [2])
  const dataset = { ...productTimeDataset, currentFinancialProductTimeAxes: {
    ...productTimeAxes, maximumTotalDimensionsWithColumns: 3,
  } }
  expect(datasetConfigurationError(request, productTimeDataset)).not.toBeNull()
  expect(datasetConfigurationError(request, parseReportDatasets([dataset])[0])).toBeNull()
  expect(reportAxesPolicy(dataset, request).config?.maximumTotalDimensions).toBe(3)
  for (const [rows, columns] of [[[3, 4, 5], [2]], [[3, 4], [2, 5]], [[3, 4], [3]], [[], [2]]])
    expect(datasetConfigurationError(productTimeRequest(rows, columns), dataset)).not.toBeNull()
  for (const maximumTotalDimensionsWithColumns of [null, 2, 4, '3'])
    expect(() => parseReportDatasets([{ ...dataset, currentFinancialProductTimeAxes: {
      ...productTimeAxes, maximumTotalDimensionsWithColumns,
    } }])).toThrow()
})
