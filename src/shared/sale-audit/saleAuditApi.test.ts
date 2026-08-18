import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import {
  confirmSaleAuditHistory,
  confirmSalesUkraineSaleAuditHistory,
  getSalesUkraineEditSaleStatistic,
  getSalesUkraineSaleAudit,
  getSalesUkraineSaleAuditInvoiceDocument,
  getSalesUkraineSaleAuditShiftedDocument,
} from './saleAuditApi'

vi.mock('../api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sale audit protocol mutation', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(null)
  })

  it('uses POST and preserves the durable retry key', async () => {
    const operationId =
      '11111111-1111-4111-8111-111111111111'
    const historyNetId =
      '22222222-2222-4222-8222-222222222222'

    await confirmSaleAuditHistory(
      { NetId: historyNetId, OperationNetUid: operationId },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/protocol/act/invoice/set/edit/act/for/editing',
      {
        body: {
          NetId: historyNetId,
          OperationNetUid: operationId,
        },
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
      },
    )
  })

  it('uses the Edit-protected Sales Ukraine confirm facade', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const historyNetId = '22222222-2222-4222-8222-222222222222'

    await confirmSalesUkraineSaleAuditHistory(
      { NetId: historyNetId, OperationNetUid: operationId },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/protocol/act/invoice/ukraine/set/edit/act/for/editing',
      {
        body: { NetId: historyNetId, OperationNetUid: operationId },
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
      },
    )
  })

  it('uses only ViewAudit-protected Sales Ukraine read facades', async () => {
    await getSalesUkraineSaleAudit('sale-1')
    await getSalesUkraineEditSaleStatistic('sale-1')
    await getSalesUkraineSaleAuditInvoiceDocument('sale-1', 'history-1')
    await getSalesUkraineSaleAuditShiftedDocument('sale-1', 'history-1')

    expect(apiRequestMock.mock.calls).toEqual([
      ['/sales/ukraine/audit', { query: { netId: 'sale-1' } }],
      ['/sales/ukraine/edit/shifted', { query: { netId: 'sale-1' } }],
      ['/sales/ukraine/audit/invoice-document', {
        query: { historyNetId: 'history-1', isFromStorages: false, netId: 'sale-1' },
      }],
      ['/sales/ukraine/audit/shifted-document', {
        query: { historyNetId: 'history-1', netId: 'sale-1' },
      }],
    ])
  })
})
