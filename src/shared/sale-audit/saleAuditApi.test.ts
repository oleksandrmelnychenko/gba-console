import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import {
  confirmSalesUkraineSaleAuditHistory,
  getSalesUkraineEditSaleStatistic,
  getSalesUkraineSaleAudit,
  getSalesUkraineSaleAuditInvoiceDocument,
  getSalesUkraineSaleAuditShiftedDocument,
  getWarehouseUkraineAuditInvoiceDocument,
  getWarehouseUkraineAuditShiftedDocument,
  getWarehouseUkraineSaleAudit,
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
        query: { historyNetId: 'history-1', netId: 'sale-1' },
      }],
      ['/sales/ukraine/audit/shifted-document', {
        query: { historyNetId: 'history-1', netId: 'sale-1' },
      }],
    ])
  })

  it('uses exact Warehouse Ukraine audit read and print facades', async () => {
    await getWarehouseUkraineSaleAudit('sale-1')
    await getWarehouseUkraineAuditInvoiceDocument('sale-1', 'history-1')
    await getWarehouseUkraineAuditShiftedDocument('sale-1', 'history-1')

    expect(apiRequestMock.mock.calls).toEqual([
      ['/sales/warehouse-ukraine/editing/audit', { query: { netId: 'sale-1' } }],
      ['/sales/warehouse-ukraine/editing/audit/invoice-document', {
        query: { historyNetId: 'history-1', netId: 'sale-1' },
      }],
      ['/sales/warehouse-ukraine/editing/audit/shifted-document', {
        query: { historyNetId: 'history-1', netId: 'sale-1' },
      }],
    ])
  })
})
