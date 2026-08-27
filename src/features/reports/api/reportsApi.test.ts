import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchReportUsers } from './reportsApi'
import type { ReportRequestBody } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('reportsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uses bounded targeted lookup for report users', async () => {
    const signal = new AbortController().signal

    apiRequestMock.mockResolvedValueOnce({
      Items: [
        {
          Email: 'ivan@example.com',
          FirstName: 'Ivan',
          LastName: 'Petrenko',
          NetUid: 'user-1',
        },
      ],
    })

    await expect(searchReportUsers({ limit: 30, offset: 5, value: '  ivan  ' }, signal)).resolves.toEqual([
      {
        Email: 'ivan@example.com',
        FirstName: 'Ivan',
        LastName: 'Petrenko',
        Name: 'Ivan Petrenko',
        NetUid: 'user-1',
      },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/usermanagement/profiles/search/lookup', {
      query: {
        limit: 30,
        offset: 5,
        value: 'ivan',
      },
      signal,
    })
  })

  it('uses the permission-scoped stock report generation route', async () => {
    const body: ReportRequestBody = {
      from: '2026-08-01',
      selections: [],
      sorted: {
        Col: [],
        Measurements: [],
        Row: [],
      },
      to: '2026-08-18',
    }
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: '/reports/result.xlsx',
      PdfDocumentURL: '/reports/result.pdf',
    })

    await expect(createStockReport(body)).resolves.toMatchObject({
      document: {
        DocumentURL: '/reports/result.xlsx',
        PdfDocumentURL: '/reports/result.pdf',
      },
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/report/stocks/generate', {
      method: 'POST',
      body,
    })
  })
})
