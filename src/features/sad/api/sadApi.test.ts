import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/sad/page/registry', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/packlists/sad/page/details', {
      query: {
        netId: 'sad-2',
      },
    })
    expect(result).toEqual(expect.objectContaining({ NetUid: 'sad-2', SadDocuments: [] }))
  })

  it('updates an existing SAD through the narrow scoped DTO', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Body: {
        Id: 41,
        NetUid:
          'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    })

    await updateSad({
      Id: 41,
      NetUid: 'sad-2',
      Comment: 'edited',
      FromDate: '2026-08-19T00:00:00.000Z',
      MarginAmount: 12,
      Organization: { Id: 7 },
      SadItems: [{
        Id: 19,
        Qty: 3,
        Comment: 'item',
      }],
      SadPallets: [],
    })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/supplies/ukraine/order/packlists/sad/page/edit',
      {
        body: {
          netUid: 'sad-2',
          comment: 'edited',
          fromDate: '2026-08-19T00:00:00.000Z',
          marginAmount: 12,
          organizationId: 7,
          stathamId: null,
          stathamCarId: null,
          clientId: null,
          clientAgreementId: null,
          organizationClientId: null,
          organizationClientAgreementId: null,
          items: [{
            id: 19,
            supplyOrderUkraineCartItemId: null,
            qty: 3,
            netWeight: 0,
            unitPrice: 0,
            comment: 'item',
          }],
        },
        method: 'POST',
      },
    )
  })

  it('uses one stable idempotency key for SAD income creation', async () => {
    const operationId = '44444444-4444-4444-8444-444444444444'
    const payment = {
      Amount: 100,
      Comment: 'income',
      FromDate: '2026-08-19T00:00:00.000Z',
      Organization: { Id: 11 },
      OrganizationClientAgreement: {
        Id: 22,
        OrganizationClientId: 33,
      },
      PaymentRegister: { Id: 44 },
      Currency: { Id: 55 },
      PaymentMovementOperation: {
        PaymentMovement: { Id: 66 },
      },
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'income-1' })

    await createIncomePaymentFromSad(
      'sad-1',
      payment,
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/orders/income/sad/create',
      {
        body: {
          amount: 100,
          comment: 'income',
          fromDate: '2026-08-19T00:00:00.000Z',
          organizationId: 11,
          paymentMovementId: 66,
          clientId: null,
          clientAgreementId: null,
          organizationClientId: 33,
          organizationClientAgreementId: 22,
          paymentRegisterId: 44,
          currencyId: 55,
          paymentCurrencyRegisterId: 0,
        },
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
