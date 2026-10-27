import { describe, expect, it } from 'vitest'
import { CURRENT_PRICE_EUR_TO_UAH_NOTE, STORED_EUR_TO_UAH_NOTE, getEurToUahNote, usesCurrentSalePrices } from './eurToUahNote'

describe('getEurToUahNote', () => {
  it('describes invoiced and imported sales as stored EUR at the current rate', () => {
    expect(getEurToUahNote({ BaseLifeCycleStatus: { SaleLifeCycleType: 3 } })).toBe(STORED_EUR_TO_UAH_NOTE)
    expect(getEurToUahNote({ BaseLifeCycleStatus: { SaleLifeCycleType: 0 }, IsImported: true })).toBe(STORED_EUR_TO_UAH_NOTE)
    expect(getEurToUahNote({ BaseLifeCycleStatus: { SaleLifeCycleType: 'New' }, IsPaymentBillDownloaded: true })).toBe(STORED_EUR_TO_UAH_NOTE)
    expect(STORED_EUR_TO_UAH_NOTE).toBe('Збережена сума EUR × поточний курс')
  })

  it('describes unbilled native new sales as current prices', () => {
    expect(usesCurrentSalePrices({ BaseLifeCycleStatus: { SaleLifeCycleType: 'New' } })).toBe(true)
    expect(getEurToUahNote({ BaseLifeCycleStatus: { SaleLifeCycleType: 0 }, IsImported: false })).toBe(CURRENT_PRICE_EUR_TO_UAH_NOTE)
  })
})
