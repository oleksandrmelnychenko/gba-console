import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ActReconciliationItem } from '../types'
import {
  changeReconciliationDisposition,
  createDepreciatedOrderFromItem,
  createDepreciatedOrderFromItems,
  createProductIncomeFromItem,
  createProductIncomeFromItems,
  createProductTransferFromItem,
  createProductTransferFromItems,
  getAppliedActions,
  getActReconciliationByNetId,
  getDispositionHistory,
  getActReconciliations,
  getReconciliationStorages,
} from './actReconciliationsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('actReconciliationsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('creates a depreciated order from a single reconciliation item', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await createDepreciatedOrderFromItem({
      comment: 'broken',
      fromDate: '2026-06-02T10:00',
      itemNetId: 'item-1',
      organizationNetId: 'org-1',
      qty: '2',
      reason: 'shortage',
      storageNetId: 'storage-1',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/depreciated/reconciliation-acts/create', {
      method: 'POST',
      query: {
        comment: 'broken',
        fromDate: '2026-06-02T10:00',
        itemNetId: 'item-1',
        organizationNetId: 'org-1',
        qty: '2',
        reason: 'shortage',
        storageNetId: 'storage-1',
      },
    })
  })

  it('creates a depreciated order from selected reconciliation items', async () => {
    apiRequestMock.mockResolvedValueOnce(null)
    const items: ActReconciliationItem[] = [{ Id: 11, ToOperationQty: 2 }]

    await createDepreciatedOrderFromItems(
      {
        comment: 'bulk',
        fromDate: '2026-06-02T10:00',
        organizationNetId: 'org-1',
        storageNetId: 'storage-1',
      },
      items,
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/depreciated/reconciliation-acts/create/many', {
      method: 'POST',
      query: {
        comment: 'bulk',
        fromDate: '2026-06-02T10:00',
        organizationNetId: 'org-1',
        storageNetId: 'storage-1',
      },
      body: items,
    })
  })

  it('loads reconciliations from wrapped collection payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Collection: [
          {
            NetUid: 'act-1',
            ActReconciliationItems: [{ NetUid: 'item-1', Availabilities: null }],
          },
        ],
      },
    })

    const result = await getActReconciliations({
      from: '2025-01-01',
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/reconciliation/page/registry', {
      query: {
        from: '2025-01-01T00:00:00.000',
        to: '2026-06-08T23:59:59.999',
      },
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.NetUid).toBe('act-1')
    expect(result[0]?.ActReconciliationItems?.[0]?.Availabilities).toEqual([])
  })

  it('loads reconciliation detail from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'act-2',
        ActReconciliationItems: null,
      },
    })

    const result = await getActReconciliationByNetId('act-2')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/reconciliation/page/details', {
      query: { netId: 'act-2' },
    })
    expect(result).toEqual({
      NetUid: 'act-2',
      ActReconciliationItems: [],
    })
  })

  it('closes selected items without stock movement using one exact idempotency key', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: { AffectedCount: 2, IsDismissed: true, IsReplay: false },
    })

    const result = await changeReconciliationDisposition({
      actNetId: 'act-2',
      comment: '  звірено з 1С  ',
      isDismissed: true,
      itemNetIds: ['item-1', 'item-2'],
      operationNetUid: 'f0000000-0000-0000-0000-000000000001',
      reasonCode: 'DataEntryError',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/reconciliation/page/disposition', {
      method: 'POST',
      query: { netId: 'act-2' },
      headers: { 'Idempotency-Key': 'f0000000-0000-0000-0000-000000000001' },
      body: {
        OperationNetUid: 'f0000000-0000-0000-0000-000000000001',
        ItemNetIds: ['item-1', 'item-2'],
        IsDismissed: true,
        ReasonCode: 'DataEntryError',
        Comment: 'звірено з 1С',
      },
    })
    expect(result.AffectedCount).toBe(2)
  })

  it('loads immutable disposition history', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Items: [{ Id: 7, IsDismissed: true, ProductVendorCode: 'SEM14844' }],
      },
    })

    const result = await getDispositionHistory('act-2')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/reconciliation/page/history/dispositions', {
      query: { netId: 'act-2' },
    })
    expect(result).toEqual([{ Id: 7, IsDismissed: true, ProductVendorCode: 'SEM14844' }])
  })

  it('uses exact scoped routes for history, storages and all warehouse mutations', async () => {
    apiRequestMock.mockResolvedValue({ Body: [] })
    const item: ActReconciliationItem = { Id: 11, NetUid: 'item-1' }

    await getAppliedActions('act-1')
    await getReconciliationStorages('organization-1')
    await createProductIncomeFromItem({
      cellNumber: '3',
      comment: 'income',
      fromDate: '2026-08-18',
      itemNetId: 'item-1',
      qty: '1',
      reason: 'surplus',
      rowNumber: '2',
      storageNetId: 'storage-1',
      storageNumber: '1',
    })
    await createProductIncomeFromItems({
      comment: 'income-many',
      fromDate: '2026-08-18',
      storageNetId: 'storage-1',
    }, [item])
    await createProductTransferFromItem({
      cellNumber: '3',
      comment: 'transfer',
      fromDate: '2026-08-18',
      fromStorageNetId: 'storage-1',
      itemNetId: 'item-1',
      organizationNetId: 'organization-1',
      qty: '1',
      reason: 'shift',
      rowNumber: '2',
      storageNumber: '1',
      toStorageNetId: 'storage-2',
    })
    await createProductTransferFromItems({
      comment: 'transfer-many',
      fromDate: '2026-08-18',
      fromStorageNetId: 'storage-1',
      organizationNetId: 'organization-1',
      toStorageNetId: 'storage-2',
    }, [item])

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/supplies/ukraine/reconciliation/page/history/actions',
      '/storages/reconciliation-acts/details',
      '/products/incomes/reconciliation-acts/create',
      '/products/incomes/reconciliation-acts/create/many',
      '/products/transfers/reconciliation-acts/create',
      '/products/transfers/reconciliation-acts/create/many',
    ])
  })
})
