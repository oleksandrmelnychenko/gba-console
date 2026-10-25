import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, normalizeSavedTemplate, saveServerReportTemplate } from './reportWorkspaceApi'
import { createStockReport, previewStockReport, getStockReportPreviewPage, exportStockReportPreview } from './reportsApi'
import { documentPreviewPayload } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { currencyCapability, currencyDataset, currencyRequest, currencySelection, resolvedCurrency } from '../data/reportPresentationCurrency.test-fixtures'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const session = { ResultId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
function response() { return { ...session, PreviewVersion: 2, Preview: { ...documentPreviewPayload(), RequestSha256: session.RequestSha256,
  Request: { ...documentPreviewPayload().Request, presentationCurrency: { ...resolvedCurrency } },
  valueSemantics: [{ columnSourceIndex: 0, measureType: 2, semantics: { kind: 'money', currencyPolicy: 'UAH', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 } }],
} } }
function setup(payload: unknown) {
 api.mockImplementation(async path => path === '/report/stocks/preview/capabilities'
   ? { Version: 2, MaximumPageRows: 200, TimeToLiveSeconds: 900, ExplicitExport: true } : payload)
}
beforeEach(() => api.mockReset())
describe('presentation currency API binding', () => {
 it('admits additive catalog metadata and refuses malformed policy without changing old datasets', async () => {
   api.mockResolvedValueOnce([currencyDataset]); expect((await getReportDatasets())[0].currentFinancialPresentationCurrency).toEqual(currencyCapability)
   api.mockResolvedValueOnce([{ ...currencyDataset, currentFinancialPresentationCurrency: { ...currencyCapability, rateFamily: 'nbu' } }])
   await expect(getReportDatasets()).rejects.toThrow()
   api.mockResolvedValueOnce([{ ...currencyDataset, currentFinancialPresentationCurrency: undefined }])
   expect((await getReportDatasets())[0].currentFinancialPresentationCurrency).toBeUndefined()
 })
 it('binds target on the initial and cached page, keeps unknown amounts unknown, exports the same result', async () => {
   const payload = response(); payload.Preview.Cells[0].Value = { Kind: 'null', Value: null, Provenance: 'producerCell' }
   setup(payload)
   const { preview } = await previewStockReport(currencyRequest(), currencyDataset)
   expect(preview.Request?.presentationCurrency).toEqual(resolvedCurrency)
   expect(preview.Cells[0].Value.Value).toBeNull()
   expect(api).toHaveBeenCalledWith('/report/stocks/preview', expect.objectContaining({ body: expect.objectContaining({ presentationCurrency: currencySelection }) }))
   expect((await getStockReportPreviewPage(session, currencyRequest(), 0)).Request?.presentationCurrency).toEqual(resolvedCurrency)
   api.mockResolvedValueOnce({ ...session, DocumentURL: '/uah.xlsx', PdfDocumentURL: '/uah.pdf' })
   expect((await exportStockReportPreview(session)).document.DocumentURL).toBe('/uah.xlsx')
   expect(api.mock.calls.filter(([path]) => path === '/report/stocks/preview')).toHaveLength(1)
 })
 it.each(['missing-target', 'wrong-target', 'wrong-money-unit', 'missing-semantics', 'duplicate-semantics', 'wrong-policy'])('refuses inconsistent initial and cached results: %s', async flaw => {
   const payload = response()
   if (flaw === 'missing-target') delete (payload.Preview.Request as { presentationCurrency?: unknown }).presentationCurrency
   if (flaw === 'wrong-target') payload.Preview.Request.presentationCurrency.currencyNetUid = 'bbbbbbbb-2222-3333-4444-555555555555'
   if (flaw === 'wrong-money-unit') payload.Preview.valueSemantics[0].semantics.currencyPolicy = 'EUR'
   if (flaw === 'missing-semantics') payload.Preview.valueSemantics = []
   if (flaw === 'duplicate-semantics') payload.Preview.valueSemantics.push(structuredClone(payload.Preview.valueSemantics[0]))
   if (flaw === 'wrong-policy') Object.assign(payload.Preview.Request.presentationCurrency, { rateFamily: 'nbu' })
   setup(payload)
   await Promise.all([expect(previewStockReport(currencyRequest(), currencyDataset)).rejects.toThrow(), expect(getStockReportPreviewPage(session, currencyRequest(), 0)).rejects.toThrow()])
 })
 it('refuses a target on legacy requests and explicit targets on old API before posting', async () => {
   setup(response())
   await expect(previewStockReport({ ...currencyRequest(), presentationCurrency: undefined }, currencyDataset)).rejects.toThrow('іншу валюту')
   api.mockClear()
   await expect(previewStockReport(currencyRequest(), { ...currencyDataset, currentFinancialPresentationCurrency: undefined })).rejects.toThrow('Сервер не підтвердив')
   expect(api).not.toHaveBeenCalled()
 })
 it('round trips templates and validates capability before save', async () => {
   const data = currencyRequest()
   const wire = { Id: session.ResultId, Revision: 1, Name: 'UAH', UpdatedAtUtc: '2026-10-25T00:00:00Z', Data: {
     DataSource: 35, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, ProfitReadMode: 0, DayOrganizationBasis: 0, presentationCurrency: currencySelection } }
   const template = normalizeSavedTemplate(wire)
   api.mockResolvedValueOnce(wire)
   await saveServerReportTemplate({ Name: template.Name, Data: template.Data }, undefined, currencyDataset)
   expect(api).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ method: 'POST', body: expect.objectContaining({ Data: expect.objectContaining({ presentationCurrency: currencySelection }) }) }))
   api.mockClear()
   await expect(saveServerReportTemplate({ Name: template.Name, Data: template.Data }, undefined, { ...currencyDataset, currentFinancialPresentationCurrency: undefined })).rejects.toThrow('Сервер не підтвердив')
   expect(api).not.toHaveBeenCalled()
 })
})

it('never falls back to unbound direct generation for an explicit currency', async () => {
  await expect(createStockReport(currencyRequest(), currencyDataset)).rejects.toThrow('попередній перегляд')
  expect(api).not.toHaveBeenCalled()
  api.mockResolvedValueOnce({ Version: 1 })
  await expect(previewStockReport(currencyRequest(), currencyDataset)).rejects.toThrow()
  expect(api.mock.calls.some(([path]) => path === '/report/stocks/generate' || path === '/report/stocks/preview')).toBe(false)
})
