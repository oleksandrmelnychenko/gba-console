import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, getStockReportPreviewPage, previewStockReport } from './reportsApi'
import { getServerReportTemplates, saveServerReportTemplate, normalizeSavedTemplate } from './reportWorkspaceApi'
import { CURRENT_VPARIVANIE_FULL_NOTE, currentVparivanieConfigurationError, withCurrentVparivanieMovementScope } from '../data/currentVparivanie'
import { currentVparivanieRequest, exactSelection } from '../data/currentVparivanie.test-fixtures'
import { movementDataset, movementPreview } from '../data/currentVparivanieMovements.test-fixtures'
import type { ReportRequestBody } from '../types'

vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const both = { Incoming: true, Outgoing: true }
const request = (): ReportRequestBody => ({ ...currentVparivanieRequest(), currentVparivanieMovements: both })
const session = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:15:00Z' }
function fullPreview(offset = 0) {
  const preview = movementPreview()
  preview.CurrentVparivanieProducts.Version = 2
  preview.Request.Notes.push(CURRENT_VPARIVANIE_FULL_NOTE)
  preview.Page = { Offset: offset, Limit: 50, TotalVisibleRows: 51, ReturnedRows: 1, HasMore: offset === 0 }
  preview.Rows[0].Ordinal = offset
  preview.CurrentVparivanieMovements.TotalProducts = 51
  return { ...session, PreviewVersion: 2, Preview: { ...preview, RequestSha256: session.RequestSha256 } }
}
function wireTemplate(data: ReportRequestBody, extra: Record<string, unknown> = {}) {
  return { Id: 'movement-template', Revision: 1, Name: 'Рух', UpdatedAtUtc: '2026-10-23T10:00:00Z', Data: { DataSource: 39,
    From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections,
    CurrentVparivanieMovements: both, ...extra } }
}
beforeEach(() => api.mockReset())

it.each([{ Incoming: true, Outgoing: false }, { Incoming: false, Outgoing: true }, both])(
  'generates the complete selection for movement %j without mutating its definition', async selection => {
    const body = { ...request(), currentVparivanieMovements: selection,
      selections: [exactSelection(1, 2, Array.from({ length: 257 }, (_, i) => String(i + 1)))] }
    api.mockResolvedValue({ DocumentURL: '/report.xlsx' })
    await createStockReport(body, movementDataset)
    expect(api).toHaveBeenCalledWith('/report/stocks/generate', expect.objectContaining({ body: { ...body, currentVparivanieFullScope: true } }))
    expect(body).not.toHaveProperty('currentVparivanieFullScope')
  })

it('does not enable full scope when movements are off; preserves explicit full selection', () => {
  const off = currentVparivanieRequest()
  expect(withCurrentVparivanieMovementScope(off)).toEqual(off)
  expect(withCurrentVparivanieMovementScope({ ...off, currentVparivanieFullScope: true }).currentVparivanieFullScope).toBe(true)
})

it('uses the same effective full scope for first preview and cached pagination without recalculating', async () => {
  api.mockResolvedValueOnce(fullPreview())
  const result = await previewStockReport(request(), movementDataset)
  expect(api).toHaveBeenCalledWith('/report/stocks/preview', expect.objectContaining({ body: { ...request(), currentVparivanieFullScope: true } }))
  expect(result.preview.CurrentVparivanieProducts?.Version).toBe(2)
  api.mockResolvedValueOnce(fullPreview(50))
  const next = await getStockReportPreviewPage(session, request(), 50)
  expect(next.Page.Offset).toBe(50)
  expect(next.ResultSession).toEqual(session)
  expect(api.mock.calls.filter(([path]) => path === '/report/stocks/preview')).toHaveLength(1)
})

it('refuses a bounded preview for an automatically complete movement request', async () => {
  api.mockResolvedValue({ Preview: movementPreview() })
  await expect(previewStockReport(request(), movementDataset)).rejects.toThrow('непідтверджені')
})

it('upgrades a saved legacy movement selection on restore and save with canonical aliases', async () => {
  api.mockResolvedValueOnce([wireTemplate(request())])
  const [template] = await getServerReportTemplates()
  expect(template.Data).toMatchObject({ currentVparivanieMovements: both, currentVparivanieFullScope: true })
  expect(template.Data).not.toHaveProperty('CurrentVparivanieMovements')
  api.mockResolvedValueOnce(wireTemplate(request(), { CurrentVparivanieFullScope: true }))
  await saveServerReportTemplate({ ...template, Data: request() })
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: { ...request(), currentVparivanieFullScope: true } }) }))
})

it.each([
  { currentVparivanieMovements: { Incoming: false, Outgoing: false } },
  { currentVparivanieMovements: { Incoming: true } },
  { CurrentVparivanieMovements: both },
  { CURRENTVPARIVANIEMOVEMENTS: both },
  { currentVparivanieFullScope: false },
  { currentVparivanieFullScope: null },
  { currentVparivanieFullScope: true, CurrentVparivanieFullScope: true },
  { CURRENTVPARIVANIEFULLSCOPE: true },
])('preserves and refuses malformed/duplicate modes before generate, preview or save: %j', async invalid => {
  const body = { ...request(), ...invalid }
  expect(withCurrentVparivanieMovementScope(body)).toEqual(body)
  await expect(createStockReport(body, movementDataset)).rejects.toThrow()
  await expect(previewStockReport(body, movementDataset)).rejects.toThrow()
  await expect(saveServerReportTemplate({ Name: 'Invalid', Data: body })).rejects.toThrow()
  await expect(getStockReportPreviewPage(session, body, 50)).rejects.toThrow()
  expect(api).not.toHaveBeenCalled()
})

it.each(['FullScopeVersion', 'MovementQuantityVersion'])('requires paired advertised capabilities: %s', async missing => {
  const capability = { ...movementDataset.currentVparivanie } as Record<string, unknown>
  delete capability[missing]
  const dataset = { ...movementDataset, currentVparivanie: capability }
  expect(currentVparivanieConfigurationError(request(), dataset)).toMatch(/не підтримує/)
  await expect(createStockReport(request(), dataset)).rejects.toThrow(/не підтримує/)
  await expect(previewStockReport(request(), dataset)).rejects.toThrow(/не підтримує/)
  expect(api).not.toHaveBeenCalled()
})

it('canonicalizes sole supported PascalCase aliases, but never changes another dataset', () => {
  const legacy = { ...currentVparivanieRequest(), CurrentVparivanieMovements: both, CurrentVparivanieFullScope: true }
  expect(withCurrentVparivanieMovementScope(legacy)).toEqual({ ...request(), currentVparivanieFullScope: true })
  const foreign = { ...legacy, dataSource: 2 }
  expect(withCurrentVparivanieMovementScope(foreign)).toEqual(foreign)
  expect(currentVparivanieConfigurationError(foreign)).not.toBeNull()
})


it.each([
  { currentVparivanieMovements: both },
  { CURRENTVPARIVANIEMOVEMENTS: both },
  { CurrentVparivanieFullScope: false },
  { currentVparivanieFullScope: true, CurrentVparivanieFullScope: true },
])('does not repair ambiguous saved-template aliases during restoration: %j', extra => {
  const template = normalizeSavedTemplate(wireTemplate(request(), extra))
  expect(currentVparivanieConfigurationError(template.Data, movementDataset, 'workspace')).not.toBeNull()
})
