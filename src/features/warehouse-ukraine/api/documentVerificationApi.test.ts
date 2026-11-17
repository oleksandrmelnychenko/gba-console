import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportDocumentVerification } from './documentVerificationApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

describe('exportDocumentVerification', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
    vi.mocked(apiRequest).mockResolvedValue({ DocumentURL: '/Data/verification.pdf' })
  })

  it('exports the whole filtered list: no grid paging is sent', async () => {
    await exportDocumentVerification({ from: '2026-11-01', storageIds: [1, 2], to: '2026-11-17' })

    expect(apiRequest).toHaveBeenCalledWith('/history/order/item/warehouse-ukraine/verification/export', {
      query: { from: '2026-11-01', storageId: [1, 2], to: '2026-11-17' },
    })
  })
})
