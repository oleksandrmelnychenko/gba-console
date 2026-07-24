import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createPreorder } from './salesPreordersApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const operationId = '9b316272-8d8c-4d6d-95a4-6eea9a79d7d6'

describe('salesPreordersApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('creates a preorder through POST with a stable operation key', async () => {
    apiRequestMock.mockResolvedValueOnce({ Message: 'created' })

    await expect(
      createPreorder(
        {
          clientAgreementNetId: 'D98F586D-D49C-4AF9-9375-B8520679B1EF',
          comment: '  notify  ',
          productNetId: '1108DEB9-C47D-45F4-AB9E-86C08CB7A797',
          qty: 2,
        },
        { operationId: operationId.toUpperCase() },
      ),
    ).resolves.toBe('created')

    expect(apiRequestMock).toHaveBeenCalledWith('/preorders/new', {
      body: {
        ClientAgreementNetId: 'd98f586d-d49c-4af9-9375-b8520679b1ef',
        Comment: 'notify',
        ProductNetId: '1108deb9-c47d-45f4-ab9e-86c08cb7a797',
        Qty: 2,
      },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it.each([
    ['empty product', '00000000-0000-0000-0000-000000000000', 'd98f586d-d49c-4af9-9375-b8520679b1ef', 1],
    ['empty agreement', '1108deb9-c47d-45f4-ab9e-86c08cb7a797', '', 1],
    ['non-finite quantity', '1108deb9-c47d-45f4-ab9e-86c08cb7a797', 'd98f586d-d49c-4af9-9375-b8520679b1ef', Number.NaN],
    ['non-positive quantity', '1108deb9-c47d-45f4-ab9e-86c08cb7a797', 'd98f586d-d49c-4af9-9375-b8520679b1ef', 0],
  ])('rejects %s before sending a request', async (_case, productNetId, clientAgreementNetId, qty) => {
    await expect(
      createPreorder(
        {
          clientAgreementNetId,
          comment: '',
          productNetId,
          qty,
        },
        { operationId },
      ),
    ).rejects.toThrow()

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
