import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { exportClientProductMovementDocument } from './clientProductMovementApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

describe('client product movement export', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset().mockResolvedValue({ DocumentURL: 'http://x/a.xlsx' }))

  it('exports every matching document, not only the current grid page', async () => {
    await exportClientProductMovementDocument({
      article: 'QA-FLT-003', clientNetId: 'client-1', from: '2026-01-01', limit: 20, offset: 40, organizationId: [], to: '2026-12-31',
    } as never)

    const query = vi.mocked(apiRequest).mock.calls[0]?.[1]?.query as Record<string, unknown>
    expect(query).toMatchObject({ article: 'QA-FLT-003', clientNetId: 'client-1' })
    expect(query).not.toHaveProperty('limit')
    expect(query).not.toHaveProperty('offset')
  })
})
