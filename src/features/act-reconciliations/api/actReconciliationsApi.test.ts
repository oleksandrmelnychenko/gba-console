import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ActReconciliationItem } from '../types'
import {
  createDepreciatedOrderFromItem,
  createDepreciatedOrderFromItems,
  getActReconciliationByNetId,
  getActReconciliations,
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

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/depreciated/new/reconciliation', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/orders/depreciated/new/reconciliation/many', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/reconciliation/all/filtered', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/reconciliation/get', {
      query: { netId: 'act-2' },
    })
    expect(result).toEqual({
      NetUid: 'act-2',
      ActReconciliationItems: [],
    })
  })
})
