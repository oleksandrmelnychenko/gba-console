import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../../../shared/api/apiClient'
import { previewStockReport, REPORT_JOB_DETACHED, type ReportJobProgress } from './reportsApi'
import { documentDataset, documentPreviewPayload, documentRequest } from '../data/currentFinancialDocumentAxes.test-fixtures'
vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const jobId = '11111111-2222-3333-4444-555555555555'
const session = { ResultId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
const capability = { Version: 2, MaximumPageRows: 200, TimeToLiveSeconds: 900, ExplicitExport: true, BackgroundJobs: true }
const job = (State: string, extra: Record<string, unknown> = {}) => ({ JobId: jobId, State, ElapsedSeconds: 3, QueuePosition: 0, ...extra })
const result = () => {
  const base = documentPreviewPayload()
  return { ...session, PreviewVersion: 2, Preview: { ...base, RequestSha256: session.RequestSha256 } }
}

beforeEach(() => { api.mockReset(); vi.useRealTimers() })

describe('background report preview jobs', () => {
  it('starts a job, reports progress while it runs and renders the completed result page', async () => {
    const states = [job('queued', { QueuePosition: 1 }), job('running'), job('completed', { Result: result() })]
    api.mockImplementation(async (path, options) => {
      if (path === '/report/stocks/preview/capabilities') return capability
      if (path === '/report/stocks/preview/jobs' && options?.method === 'POST') return states.shift()
      if (path === `/report/stocks/preview/jobs/${jobId}`) return states.shift()
      throw new Error(`unexpected ${path}`)
    })
    const progress: ReportJobProgress[] = []
    const { preview } = await previewStockReport(documentRequest(), documentDataset, { onProgress: value => progress.push(value) })
    expect(progress).toEqual([{ state: 'queued', elapsedSeconds: 3, queuePosition: 1 }, { state: 'running', elapsedSeconds: 3, queuePosition: 0 }])
    expect(preview.ResultSession).toEqual(session)
    expect(api.mock.calls.some(([path]) => path === '/report/stocks/preview')).toBe(false)
    expect(api).toHaveBeenCalledWith(`/report/stocks/preview/jobs/${jobId}`, expect.objectContaining({ query: { rowOffset: 0, rowLimit: 50 } }))
  })

  it('shows the server explanation of a failed job and keeps request refusals as API errors', async () => {
    api.mockImplementation(async path => path === '/report/stocks/preview/capabilities' ? capability
      : job('failed', { ErrorStatus: 503, ErrorCode: 'native_report_timeout', ErrorMessage: 'Звіт не встиг сформуватися навіть у фоновому режимі.' }))
    await expect(previewStockReport(documentRequest(), documentDataset)).rejects.toThrow('Звіт не встиг сформуватися навіть у фоновому режимі.')
    api.mockImplementation(async path => path === '/report/stocks/preview/capabilities' ? capability
      : job('failed', { ErrorStatus: 409, ErrorMessage: 'Дані недоступні.' }))
    await expect(previewStockReport(documentRequest(), documentDataset)).rejects.toBeInstanceOf(ApiError)
  })

  it('cancels the server job when the user cancels but leaves it running when the page is left', async () => {
    for (const reason of [undefined, REPORT_JOB_DETACHED]) {
      api.mockReset()
      const controller = new AbortController()
      api.mockImplementation(async (path, options) => {
        if (path === '/report/stocks/preview/capabilities') return capability
        if (options?.method === 'DELETE') return job('cancelled')
        queueMicrotask(() => controller.abort(reason))
        return job('running')
      })
      await expect(previewStockReport(documentRequest(), documentDataset, { signal: controller.signal })).rejects.toThrow('Формування звіту скасовано.')
      expect(api.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(reason === undefined)
    }
  })
})
