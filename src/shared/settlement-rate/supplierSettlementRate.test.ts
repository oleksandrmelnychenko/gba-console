import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import {
  describeMissingSettlementRate,
  describeSettlementRateQuote,
  describeStoredSettlementRate,
  formatSettlementRate,
  formatSettlementRateDate,
  getSupplierSettlementRateQuote,
  SETTLEMENT_RATE_KIND,
} from './supplierSettlementRate'

vi.mock('../api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('getSupplierSettlementRateQuote', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('asks the quote endpoint with the client agreement, the document date and the document kind', async () => {
    apiRequestMock.mockResolvedValueOnce({ Kind: 1, Rate: 50.222, Source: 'nbu' })

    await expect(getSupplierSettlementRateQuote({
      clientAgreementNetId: 'client-agreement-1',
      date: '2026-11-17T08:30:00.000Z',
      document: 'receipt',
    })).resolves.toEqual({ Kind: 1, Rate: 50.222, Source: 'nbu' })

    expect(apiRequestMock).toHaveBeenCalledWith('/agreements/settlement-rate/quote', {
      query: {
        clientAgreementNetId: 'client-agreement-1',
        date: '2026-11-17T08:30:00.000Z',
        document: 'receipt',
      },
    })
  })

  it('sends the chosen kind and the payment register currency only when given', async () => {
    const controller = new AbortController()
    apiRequestMock.mockResolvedValueOnce(null)

    await expect(getSupplierSettlementRateQuote({
      clientAgreementNetId: 'client-agreement-1',
      currencyNetId: 'currency-usd',
      date: '2026-11-18T10:00:00.000Z',
      document: 'payment',
      kind: SETTLEMENT_RATE_KIND.Nbu,
      signal: controller.signal,
    })).resolves.toBeNull()

    expect(apiRequestMock).toHaveBeenCalledWith('/agreements/settlement-rate/quote', {
      query: {
        clientAgreementNetId: 'client-agreement-1',
        currencyNetId: 'currency-usd',
        date: '2026-11-18T10:00:00.000Z',
        document: 'payment',
        kind: 1,
      },
      signal: controller.signal,
    })
  })
})

describe('settlement rate texts', () => {
  it('formats a rate with a decimal comma and drops a missing one', () => {
    expect(formatSettlementRate(50.222)).toBe('50,222')
    expect(formatSettlementRate(0)).toBe('')
    expect(formatSettlementRate(null)).toBe('')
  })

  it('reads a bare server date-time as the local wall time', () => {
    expect(formatSettlementRateDate('2026-11-17T10:00:00')).toBe('17.11.2026')
    expect(formatSettlementRateDate('2026-11-17T10:00:00Z')).toBe('17.11.2026')
    expect(formatSettlementRateDate('')).toBe('')
  })

  it('keeps a late-evening document on its own day', () => {
    // The server writes dates in the user's time zone (X-Time-Zone) without a designator: a payment at
    // 23:30 local comes back as «2026-11-18T23:30:00» and is still 18.11.
    expect(formatSettlementRateDate('2026-11-18T23:30:00')).toBe('18.11.2026')
    expect(formatSettlementRateDate('2026-11-18T20:16:00')).toBe('18.11.2026')
  })

  it('describes a quote, an EUR agreement and a missing rate', () => {
    expect(describeSettlementRateQuote({ Kind: 1, Rate: 50.222, RateDate: '2026-11-17T10:00:00Z', Source: 'nbu' }))
      .toBe('НБУ 50,222 за 17.11.2026')
    expect(describeSettlementRateQuote({ Kind: 1, Rate: 1, Source: 'eur' })).toBe('EUR — без перерахунку')
    expect(describeSettlementRateQuote({ Kind: 2, Rate: null, Source: 'none' })).toBeNull()
    expect(describeMissingSettlementRate({ CurrencyCode: 'uah', Kind: 2, RateDate: '2026-11-18T10:00:00Z' }))
      .toBe('Немає курсу Комерційний UAH/EUR на 18.11.2026')
  })

  it('describes a stored rate and marks a manual one', () => {
    expect(describeStoredSettlementRate({ date: '2026-11-18T10:00:00', kind: 2, overridden: true, rate: 51.2 }))
      .toBe('Комерційний 51,2 за 18.11.2026 · змінено вручну')
    expect(describeStoredSettlementRate({ kind: 1, rate: null })).toBeNull()
  })
})
