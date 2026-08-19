import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ClientShoppingCart } from '../types'
import { createOffer, getCockpitOffers, processOffer, restartOfferValidity } from './salesOffersApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const operationId = '11111111-1111-4111-8111-111111111111'
const offerNetUid = '22222222-2222-4222-8222-222222222222'
const agreementNetUid = '33333333-3333-4333-8333-333333333333'
const itemNetUid = '44444444-4444-4444-8444-444444444444'
const productNetUid = '55555555-5555-4555-8555-555555555555'

function newOffer(): ClientShoppingCart {
  return {
    ClientAgreement: { Id: 10, NetUid: agreementNetUid },
    OrderItems: [{ Product: { Id: 20, NetUid: productNetUid }, Qty: 2 }],
  }
}

function persistedOffer(): ClientShoppingCart {
  return {
    ...newOffer(),
    Id: 30,
    NetUid: offerNetUid,
    OrderItems: [
      {
        Id: 40,
        NetUid: itemNetUid,
        Product: { Id: 20, NetUid: productNetUid },
        Qty: 2,
      },
    ],
  }
}

describe('sales offer mutation contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(null)
  })

  it('creates an offer with a stable idempotency key after validating references', async () => {
    await createOffer(newOffer(), { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/offers/new', {
      body: newOffer(),
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      signal: undefined,
    })
  })

  it('processes a persisted offer with the operation key', async () => {
    await processOffer(persistedOffer(), { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/offers/process', {
      body: persistedOffer(),
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      signal: undefined,
    })
  })

  it('rejects duplicate products before sending a create request', async () => {
    const offer = newOffer()
    offer.OrderItems = [...(offer.OrderItems ?? []), { Product: { Id: 21, NetUid: productNetUid }, Qty: 1 }]

    await expect(createOffer(offer, { operationId })).rejects.toThrow(
      'Один товар не можна додати до оферти двічі',
    )
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('rejects non-finite or non-positive item quantities', async () => {
    const offer = persistedOffer()
    offer.OrderItems![0].Qty = Number.NaN

    await expect(processOffer(offer, { operationId })).rejects.toThrow(
      'Кількість товару в оферті має бути більшою за нуль',
    )
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('restarts validity only for a persisted offer guid', async () => {
    await restartOfferValidity(offerNetUid, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/offers/update/validity', {
      headers: { 'Idempotency-Key': operationId },
      method: 'PATCH',
      query: { netId: offerNetUid, validDays: 2 },
      signal: undefined,
    })
  })

  it('loads cockpit offers through the cockpit-scoped route', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await expect(getCockpitOffers({
      from: new Date(2026, 7, 1),
      to: new Date(2026, 7, 19),
    })).resolves.toEqual([])

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/offers/cockpit/filtered', {
      query: {
        from: '2026-08-01',
        to: '2026-08-19',
      },
    })
  })
})
