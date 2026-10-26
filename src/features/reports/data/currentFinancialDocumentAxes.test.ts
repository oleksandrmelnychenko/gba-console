import { expect, it } from 'vitest'
import { documentAxes, documentDataset, documentLayouts, documentRequest } from './currentFinancialDocumentAxes.test-fixtures'
import { currentFinancialDocumentAxesCapability } from './currentFinancialDocumentAxes'
import { productTimeDataset, productTimeRequest } from './currentFinancialProductTimeAxes.test-fixtures'
import { datasetConfigurationError, datasetGroupings } from './reportDatasets'
import { reportAxesPolicy } from './reportConfiguration'
import { parseReportDatasets } from '../api/reportWorkspaceApi'

it('merges only the confirmed document descriptor without changing old metadata, filters or measures', () => {
  const dataset = parseReportDatasets([documentDataset])[0]
  expect(dataset.Groupings).toEqual(productTimeDataset.Groupings)
  expect(dataset.currentFinancialProductTimeAxes).toEqual(productTimeDataset.currentFinancialProductTimeAxes)
  expect(dataset.Filters).toEqual(productTimeDataset.Filters)
  expect(dataset.Measurements).toEqual(productTimeDataset.Measurements)
  expect(datasetGroupings(dataset).map(f => f.type)).toEqual([3, 4])
  expect(datasetGroupings(dataset, documentRequest()).map(f => f.type)).toEqual([3, 4, 0, 1, 2, 5, 12, 15, 81])
  expect(datasetGroupings(dataset, documentRequest()).find(f => f.type === 81)).toMatchObject({ key: 'CurrentFinancialDocument', label: 'Документ' })
  expect(reportAxesPolicy(dataset, documentRequest()).config).toMatchObject({ allowedRows: documentAxes.allowedRows,
    allowedColumns: documentAxes.allowedColumns, maximumTotalDimensions: 2, maximumColumns: 1 })
  expect(currentFinancialDocumentAxesCapability(dataset)?.maximumOutputColumns).toBe(256)
})
it.each(documentLayouts)('admits document layout %j / %j and preserves exact negative filters and dates', (rows, cols) => {
  const data = documentRequest(rows, cols), before = structuredClone(data)
  expect(datasetConfigurationError(data, documentDataset)).toBeNull()
  expect(data).toEqual(before)
})
it.each([null, {}, { ...documentAxes, version: 2 }, { ...documentAxes, quantitySupported: true },
  { ...documentAxes, maximumOutputColumns: 512 }, { ...documentAxes, requiredProfitReadMode: 1 },
  { ...documentAxes, groupings: [] }, { ...documentAxes, groupings: [{ Type: 17, Name: 'Документ', Selectable: true }] },
  { ...documentAxes, allowedRows: [81] }, { ...documentAxes, maximumTotalDimensions: 3 },
])('rejects partial or unrecognized document capability %j', currentFinancialDocumentAxes => {
  const data = { ...documentDataset, currentFinancialDocumentAxes }
  expect(currentFinancialDocumentAxesCapability(data)).toBeUndefined()
  expect(() => parseReportDatasets([data])).toThrow()
})
it('requires existing product/time descriptors, preserves oldAPI behavior and does not grant document filters', () => {
  expect(() => parseReportDatasets([{ ...documentDataset, currentFinancialProductTimeAxes: undefined }])).toThrow()
  expect(datasetConfigurationError({ ...documentRequest(), selections: [] }, productTimeDataset)).toContain('не підтвердив')
  expect(datasetConfigurationError(productTimeRequest(), productTimeDataset)).toBeNull()
  expect(datasetConfigurationError({ ...documentRequest(), selections: [{ ...documentRequest().selections[0],
    SelectedField: { Type: 81, Name: 'Документ' } }] }, documentDataset)).not.toBeNull()
  expect(datasetConfigurationError({ ...documentRequest(), from: '2026-01-01', to: '2026-12-31' }, documentDataset)).not.toBeNull()
  const quantity = documentRequest()
  quantity.sorted.Measurements = [{ Type: 0, Name: 'Qty', IsChecked: true, parentName: '' }]
  expect(datasetConfigurationError(quantity, documentDataset)).not.toBeNull()
})
it.each([{ profitReadMode: 1 }, { profitReadMode: undefined }, { profitReadMode: null }, { dayOrganizationBasis: 1 },
  { dayOrganizationBasis: undefined }, { ProfitReadMode: 0 }, { DayOrganizationBasis: 0 }])('refuses incompatible scope %j without dropping settings', patch => {
  const data = { ...documentRequest(), ...patch }, before = structuredClone(data)
  expect(datasetConfigurationError(data, documentDataset)).not.toBeNull()
  expect(data).toEqual(before)
})
it.each([[[], [81]], [[81, 5], [3]], [[81], [5, 3]], [[81], [81]], [[81, 81], []], [[81], [17]]])(
  'rejects incompatible layout %j / %j', (rows, cols) => expect(datasetConfigurationError(documentRequest(rows, cols), documentDataset)).not.toBeNull())

it('accepts two rows with one column only when the document capability confirms it', () => {
  const dataset = { ...documentDataset, currentFinancialDocumentAxes: { ...documentAxes, maximumTotalDimensionsWithColumns: 3 } }
  for (const rows of [[3, 4], [81, 4]]) {
    const request = documentRequest(rows, [2])
    const confirmed = { ...dataset, currentFinancialProductTimeAxes: {
      ...productTimeDataset.currentFinancialProductTimeAxes as object, maximumTotalDimensionsWithColumns: 3,
    } }
    expect(datasetConfigurationError(request, documentDataset)).not.toBeNull()
    expect(datasetConfigurationError(request, parseReportDatasets([confirmed])[0])).toBeNull()
  }
  for (const maximumTotalDimensionsWithColumns of [null, 2, 4, '3'])
    expect(() => parseReportDatasets([{ ...dataset, currentFinancialDocumentAxes: {
      ...documentAxes, maximumTotalDimensionsWithColumns,
    } }])).toThrow()
})
