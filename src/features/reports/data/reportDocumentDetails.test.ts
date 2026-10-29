import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport } from '../api/reportsApi'
import { normalizeSavedTemplate, parseReportDatasets } from '../api/reportWorkspaceApi'
import { datasetConfigurationError, datasetGroupings } from './reportDatasets'
import { documentDetailsError, documentDetailsSupported } from './reportDocumentDetails'
import { effectiveReportConfiguration } from './reportConfiguration'
import { reconcileReportOrdering } from './reportOrdering'
import { canTransferReportGrouping, transferReportGrouping } from './reportGroupingLayout'
import { detailDataset, detailGrouping, detailRequest, documentDetails } from './reportDocumentDetails.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.mocked(apiRequest).mockReset() })
it.each(['sales', 'grossProfit'])('admits %s details from exact capability and preserves attributes, order, template and API wire', async profile => {
  const [dataset] = parseReportDatasets([detailDataset]), request = detailRequest(profile)
  const before = structuredClone(request)
  expect(documentDetailsSupported(dataset, request)).toBe(true)
  expect(datasetConfigurationError(request, dataset)).toBeNull()
  expect(datasetGroupings(dataset, request)).toContainEqual(expect.objectContaining({ type: 84 }))
  const saved = normalizeSavedTemplate({ Id: 'details-template', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Документи', Data: { DataSource: 2, ReportProfile: profile,
    From: request.from, To: request.to, Sorted: request.sorted, Selections: [], WorkbookPresentation: request.workbookPresentation } })
  expect(saved.Data.sorted.Row).toEqual(request.sorted.Row)
  expect(saved.Data.WorkbookPresentation).toEqual(request.workbookPresentation)
  vi.mocked(apiRequest).mockResolvedValue({ DocumentURL: '/files/report.xlsx' })
  await createStockReport(request, dataset)
  expect(apiRequest).toHaveBeenCalledWith('/report/stocks/generate', expect.objectContaining({ body: request }))
  expect(request).toEqual(before)
})
it('keeps the old source/profile limits and permits only two user rows plus the locked detail row', () => {
  const request = detailRequest(), dataset = detailDataset
  request.sorted.Row.unshift({ type: 4, key: 'Organization', label: 'Організація' })
  request.sorted.Col = [{ type: 3, key: 'Day', label: 'День' }]
  expect(documentDetailsError(request, dataset)).toBeNull()
  expect(effectiveReportConfiguration(dataset, request)).toMatchObject({ maximumRows: 3, maximumColumns: 1, maximumTotalDimensions: 4 })
  request.sorted.Row.splice(1, 0, { type: 21, key: 'Supplier', label: 'Постачальник' })
  expect(documentDetailsError(request, dataset)).toContain('двох')
  const legacy = detailRequest(); legacy.sorted.Row = legacy.sorted.Row.filter(row => row.type !== 84)
  expect(effectiveReportConfiguration(dataset, legacy)?.maximumRows).toEqual(effectiveReportConfiguration({ ...dataset, documentDetails: undefined }, legacy)?.maximumRows)
})
it('rejects malformed, column, duplicate, unsupported or transformed details without rewriting saved data', async () => {
  const variants = [
    (r: ReturnType<typeof detailRequest>) => { r.reportProfile = 'unknown' },
    (r: ReturnType<typeof detailRequest>) => { r.dataSource = 3 },
    (r: ReturnType<typeof detailRequest>) => { r.sorted.Row.reverse() },
    (r: ReturnType<typeof detailRequest>) => { r.sorted.Col.push(detailGrouping) },
    (r: ReturnType<typeof detailRequest>) => { r.sorted.Row.push(detailGrouping) },
    ...['topGroups', 'abcClassification', 'threshold', 'TopGroups'].map(key => (r: ReturnType<typeof detailRequest>) => { Object.assign(r, { [key]: { Version: 1 } }) }),
  ]
  for (const mutate of variants) {
    const request = detailRequest(); mutate(request); const before = structuredClone(request)
    await expect(createStockReport(request, detailDataset)).rejects.toThrow()
    expect(request).toEqual(before)
  }
  expect(apiRequest).not.toHaveBeenCalled()
  expect(documentDetailsError(detailRequest(), { ...detailDataset, documentDetails: undefined })).toContain('не підтвердив')
  for (const metadata of [{ ...documentDetails, grouping: '84' }, { ...documentDetails, maximumUserRows: 3 }, { ...documentDetails, extra: true }])
    expect(() => parseReportDatasets([{ ...detailDataset, documentDetails: metadata }])).toThrow()
  expect(datasetGroupings(detailDataset).some(field => field.type === 84)).toBe(false)
})
it('keeps detail last when transferring another axis to rows and never transfers the detail identity', () => {
  const layout = { Row: detailRequest().sorted.Row, Col: [{ type: 4, key: 'Organization', label: 'Організація' }] }
  const allowed = new Set([4, 7, 84])
  expect(transferReportGrouping(layout, 'Col', 4, allowed).Row.map(row => row.type)).toEqual([7, 4, 84])
  expect(canTransferReportGrouping(layout, 'Row', 84, allowed)).toBe(false)
  expect(transferReportGrouping(layout, 'Row', 84, allowed)).toBe(layout)
})

it('preserves ordinary ordering when detail is enabled and disabled', () => {
  const request = detailRequest(), ordinary = { ...request.sorted, Row: request.sorted.Row.filter(row => row.type !== 84) }
  const ordering = { Version: 1, Rows: [{ Grouping: 7, By: 1, Direction: 1, Nulls: 2 }], Columns: [] }
  expect(documentDetailsError({ ...request, ordering }, detailDataset)).toBeNull()
  expect(reconcileReportOrdering(ordering, ordinary, request.sorted)).toMatchObject({ ordering, removed: [], moved: [] })
  expect(reconcileReportOrdering(ordering, request.sorted, ordinary)).toMatchObject({ ordering, removed: [], moved: [] })
})
