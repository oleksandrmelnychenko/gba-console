import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { searchNativePriceFilters } from '../api/nativePriceFilterLookup'
import { buildReportBuilderRequest } from '../data/reportBuilderRequest'
import { datasetGroupings, datasetMeasurements } from '../data/reportDatasets'
import { reportConfigurationError } from '../data/reportConfiguration'
import { nativePriceFilterSelectionError } from '../data/nativePriceFilterLookup'
import { priceDatasetFixture, priceSelectionFixture } from '../data/nativePriceFilterLookup.test-fixtures'
import { ownPresentationDataset, ownPresentationPreview } from '../data/constructorPresentation.native.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

// Unit transport/renderer examples, NOT real HTTP, SQL, historical-price or financial-allocation receipts.
// Reuse the existing complete source46 preview contract; the authored sparse66 examples only test admission/rendering.
const highId = '9007199254740993'
const authorCaption = 'Автор [2025]'
const supplierCaption = 'Постачальник [2025]'
const descriptor = (Identity: string, Caption: string) => ({ Identity, Caption, Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' })
const axis = (Caption: string, Value: string, Provenance: string) => ({ Caption, Identity: { Kind: 'signedInteger', Value, Provenance } })
const cell = (RowSourceIndex: number, ColumnSourceIndex: number, Value: string | null) => ({
  RowSourceIndex, ColumnSourceIndex, Value: { Kind: Value === null ? 'null' : 'decimal', Value, Provenance: 'presentationExample' },
})
function previewExample() {
  const base = ownPresentationPreview(46)
  const wire = { ...base, RequestSha256: 'a'.repeat(64), Request: { ...base.Request, ColumnGroupings: [] as string[] } }
  const measures = wire.Columns.map(column => column.Values[0])
  wire.RowSchema = [descriptor('SaleDocumentManagerInput', 'Користувач, який додав товар у продаж'), descriptor('Product', 'Товар')]
  wire.ColumnSchema = [descriptor('Supplier', 'Постачальник'), { Identity: '$measure', Caption: 'Показник' }]
  wire.Request.PeriodFrom = wire.Request.PeriodTo = '20.10.2026'
  wire.Request.RowGroupings = wire.RowSchema.map(field => field.Caption)
  wire.Request.ColumnGroupings = ['Постачальник']
  wire.Page.ReturnedRows = wire.Page.TotalVisibleRows = 2
  wire.Rows = ['-1', highId].map((id, index) => ({ Ordinal: index, SourceIndex: index, Values: [
    axis(index === 0 ? 'Нерозподілено' : authorCaption, id, 'rowAxisKey'),
    axis('Товар', '38242326', 'rowAxisKey'),
  ] }))
  wire.Columns = ['-1', highId].flatMap((id, member) => measures.map((measure, index) => ({
    Ordinal: member * measures.length + index, SourceIndex: member * measures.length + index,
    Values: [axis(member === 0 ? 'Нерозподілено' : supplierCaption, id, 'columnAxisKey'), measure],
  })))
  // Missing cells stay the existing — marker; explicit null remains ∅. Neither may become a financial zero.
  wire.Cells = [cell(0, 1, '66.00'), cell(0, 2, null), cell(0, 3, null), cell(1, 4, '66.00')]
  wire.Totals = { State: 'materialized',
    Values: wire.Columns.map(column => cell(-1, column.SourceIndex, [1, 4].includes(column.SourceIndex) ? '66.00' : null)),
    Groups: [0, 1].map(row => ({ Level: 0, RowSourceIndex: row, RowCount: 1,
      Values: wire.Cells.filter(value => value.RowSourceIndex === row) })),
  }
  return wire
}

it('admits owned source46 author/supplier metadata and reserved minus-one row/column identities through the normal request/API adapter without widening positive warehouse references', async () => {
  const api = vi.mocked(apiRequest)
  api.mockReset()
  await expect(searchNativePriceFilters(46, 21, { exactId: '-1' })).rejects.toThrow('позитивний ID')
  expect(api).not.toHaveBeenCalled()

  const metadata = { ...priceDatasetFixture(), Groupings: [
    { Type: 19, Name: 'Користувач, який додав товар у продаж' }, { Type: 5, Name: 'Товар' }, { Type: 21, Name: 'Постачальник' },
  ], Measurements: ownPresentationDataset(46).Measurements,
  configuration: { version: 1, axisMode: 'flexible', allowedRows: [19, 5, 21], allowedColumns: [19, 5, 21],
    minimumRows: 1, maximumRows: 3, maximumColumns: 1, maximumTotalDimensions: 4, allowRowReorder: true,
    rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [], variants: [],
    period: { required: true, supported: true, maximumDays: 366, maximumMonths: null, minimumDate: '2025-01-01' } } }
  api.mockResolvedValueOnce([metadata])
  const [dataset] = await getReportDatasets()
  const available = datasetGroupings(dataset)
  expect(available.map(field => field.type)).toEqual([19, 5, 21])
  const groups = (types: number[]) => types.flatMap(type => available.filter(field => field.type === type))
  const request = { ...buildReportBuilderRequest({ dataSource: 46, from: '2026-10-20', to: '2026-10-20',
    ordering: undefined,
    filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined,
    rowGroups: groups([19, 5]), colGroups: groups([21]), selections: [],
    measurements: datasetMeasurements(dataset, dataset.Measurements.map(field => ({ Type: field.Type, Name: field.Name, parentName: field.Name, IsChecked: true }))),
  }), nativePriceComparison: { Version: 2 as const, PricingId: '844' } }
  expect(reportConfigurationError(request, dataset)).toBeNull()
  const invalidFilter = priceSelectionFixture(21)
  invalidFilter.Values = [{ Name: 'Нерозподілено', Value: 0, Data: { Id: '-1' } }]
  expect(nativePriceFilterSelectionError(46, [invalidFilter], dataset)).toContain('ключ відбору')

  const wire = previewExample(), before = structuredClone(wire)
  const envelope = { PreviewVersion: 2, ResultId: '00000000-0000-4000-8000-000000000001',
    RequestSha256: wire.RequestSha256, ResultSha256: wire.ResultSha256, ExpiresAtUtc: '2099-01-01T00:00:00Z', Preview: wire }
  api.mockResolvedValueOnce({ Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900 })
    .mockResolvedValueOnce(envelope)
  const { preview } = await previewStockReport(request, dataset)
  const submitted = api.mock.calls.find(([path]) => path === '/report/stocks/preview')?.[1]?.body
  expect(submitted).toEqual(request)
  expect(preview.Rows.map(row => row.Values[0].Identity)).toEqual([
    { Kind: 'signedInteger', Value: '-1', Provenance: 'rowAxisKey' },
    { Kind: 'signedInteger', Value: highId, Provenance: 'rowAxisKey' },
  ])
  expect(preview.Columns.filter((_, index) => index % 4 === 0).map(column => column.Values[0].Identity?.Value)).toEqual(['-1', highId])
  expect(preview.Cells).toEqual(before.Cells)
  expect(preview.Totals).toEqual(before.Totals)
  expect(wire).toEqual(before)
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
  for (const name of ['Нерозподілено', authorCaption]) {
    expect(screen.getByRole('rowheader', { name })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + name })).toBeTruthy()
  }
  for (const name of ['Нерозподілено', supplierCaption])
    expect(screen.getByRole('columnheader', { name: name + ' / ' + before.Columns[0].Values[1].Caption })).toBeTruthy()
  const leafRows = Array.from(view.container.querySelectorAll('tbody tr:not(.report-inline-preview__group-total)'))
  expect(leafRows.map(row => within(row as HTMLElement).getAllByRole('cell').map(value => value.textContent))).toEqual([
    ['—', '66,00', '∅', '∅', '—', '—', '—', '—'], ['—', '—', '—', '—', '66,00', '—', '—', '—'],
  ])
  expect(within(view.container.querySelector('tfoot tr') as HTMLElement).getAllByRole('cell').map(value => value.textContent))
    .toEqual(['∅', '66,00', '∅', '∅', '66,00', '∅', '∅', '∅'])
  expect(api.mock.calls.map(([path]) => path)).toEqual(['/report/datasets', '/report/stocks/preview/capabilities', '/report/stocks/preview'])
})
