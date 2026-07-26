import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createAdvancePaymentFromSad,
  createIncomePaymentFromSad,
  getSad,
  getSads,
  updateSad,
} from './sadApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('sadApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    localStorage.setItem(
      'gba_console_session',
      JSON.stringify({
        userNetUid:
          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    )
  })

  it('loads SAD rows from wrapped rows payloads', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Rows: [
          {
            NetUid: 'sad-1',
            SadItems: null,
            SadPallets: [{ NetUid: 'pallet-1', SadPalletItems: null }],
            Sales: null,
          },
        ],
      },
    })

    const result = await getSads({
      from: '2025-01-01',
      limit: 20,
      offset: 0,
      to: '2026-06-08',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/sad/all/filtered', {
      query: {
        from: '2025-01-01T00:00:00.000',
        limit: 20,
        offset: 0,
        to: '2026-06-08T23:59:59.999',
      },
    })
    expect(result).toEqual([
      expect.objectContaining({
        NetUid: 'sad-1',
        SadItems: [],
        SadPallets: [expect.objectContaining({ NetUid: 'pallet-1', SadPalletItems: [] })],
        Sales: [],
      }),
    ])
  })

  it('loads SAD detail from a wrapped body payload', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        NetUid: 'sad-2',
        SadDocuments: null,
      },
    })

    const result = await getSad('sad-2')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/sad/get', {
      query: {
        netId: 'sad-2',
      },
    })
    expect(result).toEqual(expect.objectContaining({ NetUid: 'sad-2', SadDocuments: [] }))
  })

  it('persists and sends an idempotency key for a new cart-backed SAD', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Id: 41,
        NetUid:
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    })

    await updateSad({
      Id: 0,
      SadItems: [],
      SadPallets: [],
    })

    const options = apiRequestMock.mock
      .calls[0]?.[1]
    const operationId = new Headers(
      options?.headers,
    ).get('Idempotency-Key')
    expect(operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/supplies/ukraine/order/packlists/sad/update',
      {
        body: {
          Id: 0,
          SadItems: [],
          SadPallets: [],
        },
        dedupe: false,
        headers: {
          'Idempotency-Key': operationId,
        },
        method: 'POST',
      },
    )
  })

  it('delegates SAD advance creation with an organization-client agreement', async () => {
    const payload = {
      Amount: 100,
      Comment: '',
      FromDate: '2026-07-24T00:00:00.000Z',
      Organization: { Id: 1 },
      OrganizationClientAgreement: { Id: 22, OrganizationClientId: 33 },
      VatAmount: 20,
      VatPercent: 20,
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'advance-1' })

    await createAdvancePaymentFromSad('sad-1', payload)

    const operationId = (
      apiRequestMock.mock.calls[0]?.[1]?.query as {
        operationNetUid?: string
      }
    )?.operationNetUid

    expect(operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(apiRequestMock).toHaveBeenCalledWith('/payments/advance/new', {
      body: payload,
      dedupe: false,
      headers: {
        'Idempotency-Key': operationId,
      },
      method: 'POST',
      query: {
        operationNetUid: operationId,
        sadNetId: 'sad-1',
      },
    })
  })

  it('uses one stable idempotency key for SAD income creation', async () => {
    const operationId = '44444444-4444-4444-8444-444444444444'
    const payment = {
      Amount: 100,
      OrganizationClientAgreement: {
        Id: 22,
        OrganizationClientId: 33,
      },
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'income-1' })

    await createIncomePaymentFromSad(
      'sad-1',
      payment,
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/orders/income/new/sad',
      {
        body: payment,
        dedupe: false,
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
        query: {
          sadNetId: 'sad-1',
        },
      },
    )
  })
})
