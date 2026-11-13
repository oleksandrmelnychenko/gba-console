import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues, searchReportUsers } from './reportsApi'
import type { ReportRequestBody } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('reportsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('accepts native price catalogue string IDs without rounding through the real lookup adapter', async () => {
    const items = ['844', '9007199254740993', '9223372036854775807'].map(Id => ({ Id, Name: `Тип ${Id}` }))
    const signal = new AbortController().signal
    apiRequestMock.mockResolvedValue(items)
    await expect(searchDatasetReportValues(46, 46, { value: '  ЦО ', offset: 0, limit: 30 }, signal)).resolves.toEqual(items)
    expect(apiRequestMock).toHaveBeenLastCalledWith('/report/datasets/lookup', {
      query: { dataSource: 46, field: 46, value: 'ЦО', offset: 0, limit: 30 }, signal,
    })
    apiRequestMock.mockResolvedValue([items[1]])
    await expect(searchDatasetReportValues(46, 46, { value: 'id:9007199254740993', offset: 0, limit: 2 })).resolves.toEqual([items[1]])
  })

  it.each([844, 9007199254740992, '0', '0844', '-1', '9223372036854775808', '1e3', 'A'.repeat(32)])(
    'rejects malformed or non-native catalogue identity %s', async Id => {
      apiRequestMock.mockResolvedValue([{ Id: '844', Name: 'ЦЗ' }, { Id, Name: 'Invalid' }])
      await expect(searchDatasetReportValues(46, 46, { value: '', offset: 0, limit: 30 })).rejects.toThrow('некоректні значення')
    },
  )

  it('restores only the exact saved legacy price identity without mixing native choices', async () => {
    const Id = 'ABCDEF0123456789ABCDEF0123456789'
    const params = { value: `legacy:${Id}`, offset: 0, limit: 2 }
    apiRequestMock.mockResolvedValue([{ Id, Name: 'Історичний тип' }])
    await expect(searchDatasetReportValues(46, 46, params)).resolves.toEqual([{ Id, Name: 'Історичний тип' }])
    for (const invalid of ['844', '0'.repeat(32), 'B'.repeat(32), 844]) {
      apiRequestMock.mockResolvedValue([{ Id: invalid, Name: 'Не цей тип' }])
      await expect(searchDatasetReportValues(46, 46, params)).rejects.toThrow('некоректні значення')
    }
    apiRequestMock.mockResolvedValue([{ Id, Name: 'Історичний' }, { Id: '844', Name: 'Поточний' }])
    await expect(searchDatasetReportValues(46, 46, params)).rejects.toThrow('некоректні значення')
  })

  it('uses exact native purchase contract identities without substituting AgreementId', async () => {
    const signal = new AbortController().signal
    apiRequestMock.mockResolvedValue([{ Id: 42, Name: 'Постачальник · договір 42' }])
    await expect(searchDatasetReportValues(3, 18, { limit: 30, offset: 0, value: '  42 ' }, signal))
      .resolves.toEqual([{ Id: 42, Name: 'Постачальник · договір 42' }])
    expect(apiRequestMock).toHaveBeenLastCalledWith('/report/datasets/lookup', {
      query: { dataSource: 3, field: 18, limit: 30, offset: 0, value: '42' }, signal,
    })
    apiRequestMock.mockResolvedValue([{ AgreementId: 42, Name: 'Неправильна ідентичність' }])
    await expect(searchDatasetReportValues(3, 18, { limit: 30, offset: 0, value: '42' })).rejects.toThrow('некоректні значення')
  })

  it.each([0, 2, 3])('looks up exact measure unit ids in source %s', async dataSource => {
    const signal = new AbortController().signal
    apiRequestMock.mockResolvedValue([{ Id: 77, Name: 'м' }])
    await expect(searchDatasetReportValues(dataSource, 20, { limit: 30, offset: 0, value: ' м ' }, signal))
      .resolves.toEqual([{ Id: 77, Name: 'м' }])
    expect(apiRequestMock).toHaveBeenLastCalledWith('/report/datasets/lookup', {
      query: { dataSource, field: 20, limit: 30, offset: 0, value: 'м' }, signal,
    })
  })

  it('keeps supplier batch Product lookup Int64 IDs as exact strings', async () => {
    const params = { limit: 30, offset: 0, value: ' ISS1012LSLH ' }
    apiRequestMock.mockResolvedValueOnce([{ Id: '35430089', Name: 'ISS1012LSLH [35430089]' }])
    await expect(searchDatasetReportValues(38, 1, params))
      .resolves.toEqual([{ Id: '35430089', Name: 'ISS1012LSLH [35430089]' }])
    expect(apiRequestMock).toHaveBeenLastCalledWith('/report/datasets/lookup', {
      query: { dataSource: 38, field: 1, value: 'ISS1012LSLH', offset: 0, limit: 30 },
      signal: undefined,
    })
    apiRequestMock.mockResolvedValueOnce([{ Id: '9223372036854775807', Name: 'Exact high ID' }])
    await expect(searchDatasetReportValues(38, 1, { ...params, value: '' }))
      .resolves.toEqual([{ Id: '9223372036854775807', Name: 'Exact high ID' }])
    apiRequestMock.mockResolvedValueOnce([{ Id: 9007199254740992, Name: 'Rounded ID' }])
    await expect(searchDatasetReportValues(38, 1, params)).rejects.toThrow('некоректні значення')
    apiRequestMock.mockResolvedValueOnce([{ Id: '0', Name: 'Zero ID' }])
    await expect(searchDatasetReportValues(38, 1, params)).rejects.toThrow('некоректні значення')
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
      method: 'POST', dedupe: false,
      body,
    })
  })

  it('gets bounded inline data and file links from one preview request', async () => {
    const body: ReportRequestBody = { from: '2026-08-01', to: '2026-08-18', selections: [], sorted: { Col: [], Measurements: [], Row: [] } }
    apiRequestMock.mockResolvedValueOnce({ DocumentURL: '/reports/result.xlsx', PdfDocumentURL: '/reports/result.pdf', Preview: {
      Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
      Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
      RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
    } })
    const response = await previewStockReport(body)
    expect(response.result.document.DocumentURL).toBe('/reports/result.xlsx')
    expect(response.preview.Page.ReturnedRows).toBe(0)
    expect(apiRequestMock).toHaveBeenCalledWith('/report/stocks/preview', {
      method: 'POST', dedupe: false, query: { rowOffset: 0, rowLimit: 50 }, body,
    })
  })
})
