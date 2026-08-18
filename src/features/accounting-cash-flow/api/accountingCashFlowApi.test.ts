import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  exportAccountingCashFlowDocument,
  exportCounterpartyAccountingCashFlowDocument,
  getAccountingCashFlow,
  getAccountingCashFlowCounterparty,
} from './accountingCashFlowApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('accountingCashFlowApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('accepts the shared export document shapes returned by the server', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/cash-flow.pdf',
      XlsxDocument: 'https://example.test/cash-flow.xlsx',
    })

    await expect(
      exportAccountingCashFlowDocument({
        from: '2026-07-01',
        netId: 'client-1',
        to: '2026-07-08',
      }),
    ).resolves.toEqual({
      DocumentURL: 'https://example.test/cash-flow.xlsx',
      PdfDocumentURL: 'https://example.test/cash-flow.pdf',
    })
  })

  it('fails loudly when the export endpoint does not return a document URL', async () => {
    apiRequestMock.mockResolvedValueOnce({})

    await expect(
      exportAccountingCashFlowDocument({
        from: '2026-07-01',
        netId: 'client-1',
        to: '2026-07-08',
      }),
    ).rejects.toThrow('Не вдалося сформувати документ взаєморозрахунків')
  })

  it('uses permission-scoped supplier routes for hydration, rows, and export', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ NetUid: 'supplier-1', ClientAgreements: [] })
      .mockResolvedValueOnce({ AccountingCashFlowHeadItems: [] })
      .mockResolvedValueOnce({ PdfDocumentURL: '/supplier-cash-flow.pdf' })

    await getAccountingCashFlowCounterparty('supplier-1', 'supplier')
    await getAccountingCashFlow({
      from: '2026-07-01',
      mode: 'supplier',
      netId: 'supplier-1',
      to: '2026-07-08',
    })
    await exportAccountingCashFlowDocument({
      from: '2026-07-01',
      mode: 'supplier',
      netId: 'supplier-1',
      to: '2026-07-08',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/clients/suppliers/cash-flow/details', {
      query: { netId: 'supplier-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/accounting/cashflow/suppliers/get/filtered', {
      query: {
        from: '2026-07-01',
        netId: 'supplier-1',
        to: '2026-07-08',
        typePaymentTask: 2,
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/accounting/cashflow/suppliers/document/export', {
      query: {
        from: '2026-07-01',
        netId: 'supplier-1',
        to: '2026-07-08',
        typePaymentTask: 2,
      },
    })
  })

  it('uses permission-scoped client reads and independently guarded export', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ NetUid: 'client-1', ClientAgreements: [] })
      .mockResolvedValueOnce({ AccountingCashFlowHeadItems: [] })
      .mockResolvedValueOnce({ PdfDocumentURL: '/client-cash-flow.pdf' })

    await getAccountingCashFlowCounterparty('client-1', 'client')
    await getAccountingCashFlow({
      from: '2026-07-01',
      mode: 'client',
      netId: 'client-1',
      to: '2026-07-08',
    })
    await exportCounterpartyAccountingCashFlowDocument({
      from: '2026-07-01',
      mode: 'client',
      netId: 'client-1',
      to: '2026-07-08',
    })

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/clients/cash-flow/details',
      '/accounting/cashflow/clients/get/filtered',
      '/accounting/cashflow/counterparties/document/export',
    ])
  })
})
